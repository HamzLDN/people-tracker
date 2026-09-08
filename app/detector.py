"""Person detection with OpenCV's DNN module and a YOLOv8n ONNX model."""

from __future__ import annotations

import hashlib
import logging
import threading
import urllib.request
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "yolov8n.onnx"
MODEL_URL = "https://github.com/CVHub520/X-AnyLabeling/releases/download/v0.1.0/yolov8n.onnx"
MODEL_SHA1 = "68f864475d06e2ec4037181052739f268eeac38d"
INPUT_SIZE = 640
PERSON_CLASS = 0
NMS_IOU = 0.45


def _sha1(path: Path) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_model() -> Path:
    if MODEL_PATH.exists() and _sha1(MODEL_PATH) == MODEL_SHA1:
        return MODEL_PATH

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading YOLOv8n ONNX model")
    request = urllib.request.Request(MODEL_URL, headers={"User-Agent": "people-tracker"})
    tmp = MODEL_PATH.with_suffix(".onnx.part")
    with urllib.request.urlopen(request, timeout=120) as response, tmp.open("wb") as handle:
        while True:
            chunk = response.read(1 << 20)
            if not chunk:
                break
            handle.write(chunk)
    digest = _sha1(tmp)
    if digest != MODEL_SHA1:
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"Model checksum mismatch: {digest}")
    tmp.replace(MODEL_PATH)
    return MODEL_PATH


class PersonDetector:
    def __init__(self) -> None:
        self._net: cv2.dnn.Net | None = None
        self._lock = threading.Lock()

    def load(self) -> None:
        path = ensure_model()
        net = cv2.dnn.readNetFromONNX(str(path))
        self._net = net
        warmup = np.zeros((360, 640, 3), dtype=np.uint8)
        self.detect(warmup, 0.45)
        logger.info("Person detector ready (%s)", path.name)

    def detect(self, frame_bgr: np.ndarray, confidence: float) -> list[dict]:
        net = self._net
        if net is None:
            raise RuntimeError("Detector is not loaded")

        height, width = frame_bgr.shape[:2]
        if height == 0 or width == 0:
            return []

        # Pad onto the bottom and right so the resize to 640 keeps aspect ratio.
        # The network returns box center/size in that 640-pixel square.
        length = max(height, width)
        square = np.zeros((length, length, 3), dtype=np.uint8)
        square[0:height, 0:width] = frame_bgr
        scale = length / INPUT_SIZE

        blob = cv2.dnn.blobFromImage(
            square,
            scalefactor=1 / 255.0,
            size=(INPUT_SIZE, INPUT_SIZE),
            swapRB=True,
            crop=False,
        )

        with self._lock:
            net.setInput(blob)
            output = net.forward()

        pred = np.squeeze(output[0] if isinstance(output, (list, tuple)) else output)
        if pred.ndim != 2:
            raise RuntimeError(f"Unexpected detector output shape {pred.shape}")
        if pred.shape[0] < pred.shape[1]:
            pred = pred.T

        class_scores = pred[:, 4:]
        class_ids = np.argmax(class_scores, axis=1)
        scores = class_scores[:, PERSON_CLASS]
        keep = (class_ids == PERSON_CLASS) & (scores >= confidence)
        if not np.any(keep):
            return []

        boxes = pred[keep, :4]
        scores = scores[keep]
        if len(scores) > 200:
            top = np.argpartition(scores, -200)[-200:]
            boxes = boxes[top]
            scores = scores[top]

        left = boxes[:, 0] - boxes[:, 2] / 2
        top = boxes[:, 1] - boxes[:, 3] / 2
        nms_boxes = np.stack([left, top, boxes[:, 2], boxes[:, 3]], axis=1)
        indices = cv2.dnn.NMSBoxes(nms_boxes.tolist(), scores.tolist(), float(confidence), NMS_IOU)
        if indices is None or len(indices) == 0:
            return []

        detections: list[dict] = []
        for index in np.array(indices).reshape(-1):
            x, y, w, h = nms_boxes[int(index)]
            x = float(x) * scale / width
            y = float(y) * scale / height
            w = float(w) * scale / width
            h = float(h) * scale / height
            if w <= 0.01 or h <= 0.01:
                continue
            x = min(max(x, 0.0), 1.0)
            y = min(max(y, 0.0), 1.0)
            w = min(w, 1.0 - x)
            h = min(h, 1.0 - y)
            detections.append(
                {
                    "x": round(x, 4),
                    "y": round(y, 4),
                    "w": round(w, 4),
                    "h": round(h, 4),
                    "score": round(float(scores[int(index)]), 3),
                }
            )
        return detections
