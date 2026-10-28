"""Appearance embedding for a person crop.

Clothing color (shirt and pants), build (aspect), and a face patch only when
the head crop is large and sharp enough to be useful.
"""

from __future__ import annotations

import cv2
import numpy as np

FACE_SHARPNESS = 80.0


def _hist(bgr: np.ndarray) -> np.ndarray | None:
    if bgr.size == 0 or bgr.shape[0] < 4 or bgr.shape[1] < 4:
        return None
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [8, 4], [0, 180, 0, 256])
    flat = hist.astype(np.float32).ravel()
    norm = float(np.linalg.norm(flat))
    if norm < 1e-6:
        return None
    return flat / norm


def _unit(vec: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vec))
    if norm < 1e-6:
        return vec
    return vec / norm


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-8))


def embed_person(frame_bgr: np.ndarray, box: tuple[float, float, float, float]) -> dict | None:
    height, width = frame_bgr.shape[:2]
    if height < 8 or width < 8:
        return None
    x, y, w, h = box
    x0 = max(0, int(x * width))
    y0 = max(0, int(y * height))
    x1 = min(width, int((x + w) * width))
    y1 = min(height, int((y + h) * height))
    if x1 - x0 < 8 or y1 - y0 < 12:
        return None

    crop = frame_bgr[y0:y1, x0:x1]
    crop = cv2.resize(crop, (32, 64), interpolation=cv2.INTER_AREA)
    ch, cw = crop.shape[:2]
    shirt = crop[int(ch * 0.18) : int(ch * 0.55), int(cw * 0.12) : int(cw * 0.88)]
    pants = crop[int(ch * 0.55) : int(ch * 0.95), int(cw * 0.18) : int(cw * 0.82)]
    shirt_hist = _hist(shirt)
    pants_hist = _hist(pants)
    if shirt_hist is None or pants_hist is None:
        return None

    aspect = np.array([min(h / max(w, 1e-3), 6.0) / 6.0], dtype=np.float32)
    body = _unit(np.concatenate([shirt_hist, pants_hist, aspect * 0.35]))

    face = None
    head = crop[: max(4, int(ch * 0.22)), int(cw * 0.22) : int(cw * 0.78)]
    if head.shape[0] >= 10 and head.shape[1] >= 10:
        gray = cv2.cvtColor(head, cv2.COLOR_BGR2GRAY)
        if float(cv2.Laplacian(gray, cv2.CV_64F).var()) >= FACE_SHARPNESS:
            small = cv2.resize(gray, (8, 8), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
            small = small - float(small.mean())
            face = _unit(small.ravel())
            if float(np.linalg.norm(face)) < 1e-6:
                face = None

    return {"body": body, "face": face}


def blend_embedding(previous: dict, current: dict, keep: float = 0.75) -> dict:
    body = _unit(keep * previous["body"] + (1.0 - keep) * current["body"])
    face = previous.get("face")
    incoming = current.get("face")
    if incoming is not None:
        face = incoming if face is None else _unit(keep * face + (1.0 - keep) * incoming)
    return {"body": body, "face": face}


def appearance_similarity(a: dict, b: dict) -> float:
    body = _cosine(a["body"], b["body"])
    face_a = a.get("face")
    face_b = b.get("face")
    if face_a is None or face_b is None:
        return body
    face = _cosine(face_a, face_b)
    if face <= body:
        return body
    return 0.75 * body + 0.25 * face
