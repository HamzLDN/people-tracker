"""Offline MOT17 run: detector + tracker + walk signature vs ground-truth IDs."""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.detector import PersonDetector
from app.tracker import PersonTracker

GAIT_SAMPLE_MAX = 96
GAIT_MIN_SAMPLES = 14
GAIT_MATCH_THRESHOLD = 0.68
IOU_GT = 0.5


def foot_from_box(x: float, y: float, w: float, h: float) -> tuple[float, float]:
    return x + w / 2, y + h * 0.92


def iou_norm(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    ax2, ay2 = a[0] + a[2], a[1] + a[3]
    bx2, by2 = b[0] + b[2], b[1] + b[3]
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    union = a[2] * a[3] + b[2] * b[3] - inter
    return inter / union if union > 0 else 0.0


def load_gt_with_size(
    gt_path: Path, width: int, height: int
) -> dict[int, list[tuple[int, tuple[float, float, float, float]]]]:
    by_frame: dict[int, list[tuple[int, tuple[float, float, float, float]]]] = {}
    for line in gt_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(",")
        if len(parts) < 6:
            continue
        frame = int(parts[0])
        pid = int(parts[1])
        if pid <= 0:
            continue
        bb = float(parts[2]), float(parts[3]), float(parts[4]), float(parts[5])
        x, y, w, h = bb[0] / width, bb[1] / height, bb[2] / width, bb[3] / height
        by_frame.setdefault(frame, []).append((pid, (x, y, w, h)))
    return by_frame


def variance(nums: list[float]) -> float:
    if len(nums) < 2:
        return 0.0
    mean = sum(nums) / len(nums)
    return sum((v - mean) ** 2 for v in nums) / len(nums)


def count_speed_peaks(speeds: list[float]) -> int:
    if len(speeds) < 5:
        return 0
    mean = sum(speeds) / len(speeds)
    floor = mean * 0.45
    peaks = 0
    for i in range(1, len(speeds) - 1):
        if speeds[i] < floor:
            continue
        if speeds[i] >= speeds[i - 1] and speeds[i] > speeds[i + 1]:
            peaks += 1
    return peaks


def compute_gait_features(samples: list[dict]) -> dict | None:
    if len(samples) < GAIT_MIN_SAMPLES:
        return None
    speeds = [s["speed"] for s in samples if s["speed"] > 0.0005]
    mean_speed = sum(speeds) / len(speeds) if speeds else 0.0
    speed_std = math.sqrt(variance(speeds)) if len(speeds) > 1 else 0.0
    duration = samples[-1]["t"] - samples[0]["t"]
    peaks = count_speed_peaks(speeds)
    cadence_hz = peaks / duration if duration > 0.6 else 0.0
    dx = samples[-1]["x"] - samples[0]["x"]
    dy = samples[-1]["y"] - samples[0]["y"]
    path_len = sum(
        math.hypot(samples[i]["x"] - samples[i - 1]["x"], samples[i]["y"] - samples[i - 1]["y"])
        for i in range(1, len(samples))
    )
    directness = math.hypot(dx, dy) / path_len if path_len > 0.015 else 0.0
    xs = [s["x"] for s in samples]
    ys = [s["y"] for s in samples]
    lateral_var = variance(xs) + variance(ys) * 0.35
    return {
        "meanSpeed": mean_speed,
        "speedStd": speed_std,
        "cadenceHz": cadence_hz,
        "directness": directness,
        "lateralVar": lateral_var,
        "n": len(samples),
        "duration": duration,
    }


def feature_vector(f: dict) -> list[float]:
    return [
        f["meanSpeed"],
        f["cadenceHz"] * 0.55,
        f["directness"],
        f["speedStd"] * 2.5,
        math.sqrt(f["lateralVar"]) * 3,
    ]


def gait_similarity(fa: dict, fb: dict) -> float:
    a = feature_vector(fa)
    b = feature_vector(fb)
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a)
    nb = sum(x * x for x in b)
    if na < 1e-10 or nb < 1e-10:
        return 0.0
    return dot / (math.sqrt(na) * math.sqrt(nb))


@dataclass
class GaitProfile:
    foot_samples: list[dict] = field(default_factory=list)
    features: dict | None = None


@dataclass
class GaitState:
    profiles: dict[int, GaitProfile] = field(default_factory=dict)
    archive: list[dict] = field(default_factory=list)
    matched: set[int] = field(default_factory=set)
    relinks: list[tuple[int, int, float]] = field(default_factory=list)

    def update(self, track_id: int, box: tuple[float, float, float, float], t: float) -> None:
        prof = self.profiles.setdefault(track_id, GaitProfile())
        x, y, w, h = box
        fx, fy = foot_from_box(x, y, w, h)
        last = prof.foot_samples[-1] if prof.foot_samples else None
        speed = 0.0
        if last:
            dt = t - last["t"]
            if 0.02 < dt < 1.5:
                speed = math.hypot(fx - last["x"], fy - last["y"]) / dt
        prof.foot_samples.append({"t": t, "x": fx, "y": fy, "speed": speed})
        if len(prof.foot_samples) > GAIT_SAMPLE_MAX:
            prof.foot_samples.pop(0)
        prof.features = compute_gait_features(prof.foot_samples)

    def archive_track(self, track_id: int) -> None:
        prof = self.profiles.pop(track_id, None)
        if prof and prof.features:
            self.archive.append({"id": track_id, "features": prof.features})
            if len(self.archive) > 32:
                self.archive.pop(0)

    def try_match(self, track_id: int) -> tuple[int, float] | None:
        if track_id in self.matched:
            return None
        prof = self.profiles.get(track_id)
        if not prof or not prof.features or prof.features["n"] < GAIT_MIN_SAMPLES:
            return None
        best = None
        for entry in self.archive:
            score = gait_similarity(prof.features, entry["features"])
            if score >= GAIT_MATCH_THRESHOLD and (best is None or score > best[1]):
                best = (entry["id"], score)
        if best:
            self.matched.add(track_id)
            self.relinks.append((track_id, best[0], best[1]))
            return best
        return None


def associate_gt(
    box: tuple[float, float, float, float], gt_boxes: list[tuple[int, tuple[float, float, float, float]]]
) -> int | None:
    best_pid, best_iou = None, 0.0
    for pid, gt_box in gt_boxes:
        iou = iou_norm(box, gt_box)
        if iou >= IOU_GT and iou > best_iou:
            best_iou = iou
            best_pid = pid
    return best_pid


def run_sequence(seq_dir: Path, *, max_frames: int | None, confidence: float) -> dict:
    img_dir = seq_dir / "img1"
    gt_path = seq_dir / "gt" / "gt.txt"
    frames = sorted(img_dir.glob("*.jpg"))
    if not frames:
        raise FileNotFoundError(f"No frames in {img_dir}")
    first = cv2.imread(str(frames[0]))
    if first is None:
        raise RuntimeError(f"Could not read {frames[0]}")
    height, width = first.shape[:2]
    gt = load_gt_with_size(gt_path, width, height)

    detector = PersonDetector()
    detector.load()
    tracker = PersonTracker()
    gait = GaitState()
    smoothing = 0.55

    track_to_gt: dict[int, int | None] = {}
    active: set[int] = set()
    id_switches = 0
    gait_correct = 0
    gait_attempts = 0
    fps = 14.0
    ini = seq_dir / "seqinfo.ini"
    if ini.is_file():
        for line in ini.read_text(encoding="utf-8").splitlines():
            if line.startswith("frameRate="):
                fps = float(line.split("=", 1)[1].strip())

    limit = len(frames) if max_frames is None else min(len(frames), max_frames)
    for fi in range(limit):
        frame_bgr = cv2.imread(str(frames[fi])) if fi else first
        if frame_bgr is None:
            continue
        t = fi / fps
        frame_idx = fi + 1
        raw = detector.detect(frame_bgr, confidence)
        tracks = tracker.update(raw, t, smoothing)
        seen: set[int] = set()
        for tr in tracks:
            tid = int(tr["id"])
            seen.add(tid)
            box = (float(tr["x"]), float(tr["y"]), float(tr["w"]), float(tr["h"]))
            gait.update(tid, box, t)
            match = gait.try_match(tid)
            if match:
                prior_tid, _score = match
                gait_attempts += 1
                a, b = track_to_gt.get(tid), track_to_gt.get(prior_tid)
                if a is not None and a == b:
                    gait_correct += 1
            gt_boxes = gt.get(frame_idx, [])
            pid = associate_gt(box, gt_boxes) if gt_boxes else None
            prev = track_to_gt.get(tid)
            if pid is not None:
                if prev is not None and prev != pid:
                    id_switches += 1
                track_to_gt[tid] = pid
            elif tid not in track_to_gt:
                track_to_gt[tid] = None

        for tid in list(active - seen):
            gait.archive_track(tid)
        active = seen

    return {
        "sequence": seq_dir.name,
        "frames": limit,
        "gtPersons": len({pid for boxes in gt.values() for pid, _ in boxes}),
        "trackerIdSwitches": id_switches,
        "gaitRelinkAttempts": gait_attempts,
        "gaitRelinkCorrectVsGt": gait_correct,
        "gaitRelinksLogged": len(gait.relinks),
    }


def resolve_seq_dir(root: Path, name: str) -> Path:
    train_candidates = [root / "MOT17" / "train", root / "train", root]
    train = next((p for p in train_candidates if p.is_dir()), root)
    direct = train / name
    if direct.is_dir():
        return direct
    matches = [p for p in train.iterdir() if p.is_dir() and p.name.startswith(name)]
    if len(matches) == 1:
        return matches[0]
    raise FileNotFoundError(f"Sequence {name!r} not found under {train}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate walk matching against MOT17 ground truth.")
    parser.add_argument(
        "--mot17",
        type=Path,
        default=ROOT / "output" / "motchallenge",
        help="Extracted MOT17 root (contains MOT17/train/ or train/).",
    )
    parser.add_argument("--sequence", default="MOT17-05-SDP", help="Train sequence folder name.")
    parser.add_argument("--max-frames", type=int, default=None)
    parser.add_argument("--confidence", type=float, default=0.4)
    args = parser.parse_args()

    seq_dir = resolve_seq_dir(args.mot17, args.sequence)
    stats = run_sequence(seq_dir, max_frames=args.max_frames, confidence=args.confidence)
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
