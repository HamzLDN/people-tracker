"""Associate person boxes across frames and smooth each track."""

from __future__ import annotations

import random

from app.one_euro import OneEuroFilter

CONFIRM_HITS = 2
# Keep a confirmed box only through a brief detector miss, then drop it.
# Time-based so a slower frame rate cannot leave a ghost for several seconds.
COAST_SECONDS = 0.35
UNCONFIRMED_COAST_SECONDS = 0.12
IOU_THRESHOLD = 0.25


def smoothing_params(amount: float) -> tuple[float, float]:
    """Map a 0–1 slider onto One Euro min_cutoff and beta.

    0 follows the detector closely. 1 settles when the person is still.
    Beta stays high enough that a walk does not drag the box behind them.
    """
    amount = min(1.0, max(0.0, amount))
    min_cutoff = 2.2 - 1.7 * amount
    beta = 3.2 - 1.4 * amount
    return min_cutoff, beta


def _iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    ax2, ay2 = a[0] + a[2], a[1] + a[3]
    bx2, by2 = b[0] + b[2], b[1] + b[3]
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    union = a[2] * a[3] + b[2] * b[3] - inter
    if union <= 0:
        return 0.0
    return inter / union


def _clip_box(x: float, y: float, w: float, h: float) -> tuple[float, float, float, float]:
    w = min(max(w, 0.01), 1.0)
    h = min(max(h, 0.01), 1.0)
    x = min(max(x, 0.0), 1.0 - w)
    y = min(max(y, 0.0), 1.0 - h)
    return x, y, w, h


class _Track:
    def __init__(
        self,
        track_id: int,
        det: dict,
        t: float,
        min_cutoff: float,
        beta: float,
    ) -> None:
        self.id = track_id
        self.hits = 1
        self.misses = 0
        self.lost_since: float | None = None
        self.score = float(det["score"])
        self.fx = OneEuroFilter(min_cutoff, beta)
        self.fy = OneEuroFilter(min_cutoff, beta)
        self.fw = OneEuroFilter(min_cutoff, beta)
        self.fh = OneEuroFilter(min_cutoff, beta)
        cx = float(det["x"]) + float(det["w"]) / 2
        cy = float(det["y"]) + float(det["h"]) / 2
        self.cx = self.fx(cx, t)
        self.cy = self.fy(cy, t)
        self.w = self.fw(float(det["w"]), t)
        self.h = self.fh(float(det["h"]), t)

    def set_smoothing(self, min_cutoff: float, beta: float) -> None:
        for filt in (self.fx, self.fy, self.fw, self.fh):
            filt.min_cutoff = min_cutoff
            filt.beta = beta

    def update(self, det: dict, t: float) -> None:
        cx = float(det["x"]) + float(det["w"]) / 2
        cy = float(det["y"]) + float(det["h"]) / 2
        self.cx = self.fx(cx, t)
        self.cy = self.fy(cy, t)
        self.w = max(0.01, self.fw(float(det["w"]), t))
        self.h = max(0.01, self.fh(float(det["h"]), t))
        self.score = float(det["score"])
        self.hits += 1
        self.misses = 0
        self.lost_since = None

    def mark_missed(self, t: float) -> None:
        self.misses += 1
        if self.lost_since is None:
            self.lost_since = t

    def box(self) -> tuple[float, float, float, float]:
        return _clip_box(self.cx - self.w / 2, self.cy - self.h / 2, self.w, self.h)

    def _lost_for(self, t: float) -> float:
        if self.lost_since is None:
            return 0.0
        return max(0.0, t - self.lost_since)

    def visible(self, t: float) -> bool:
        if self.hits < CONFIRM_HITS:
            return False
        return self._lost_for(t) <= COAST_SECONDS

    def expired(self, t: float) -> bool:
        limit = COAST_SECONDS if self.hits >= CONFIRM_HITS else UNCONFIRMED_COAST_SECONDS
        return self._lost_for(t) > limit

    def to_dict(self) -> dict:
        x, y, w, h = self.box()
        return {
            "id": self.id,
            "x": round(x, 4),
            "y": round(y, 4),
            "w": round(w, 4),
            "h": round(h, 4),
            "score": round(self.score, 3),
            "held": self.misses > 0,
        }


class PersonTracker:
    def __init__(self) -> None:
        self.tracks: list[_Track] = []
        self._next_id = 1

    def update(self, detections: list[dict], t: float, smoothing: float) -> list[dict]:
        min_cutoff, beta = smoothing_params(smoothing)
        for track in self.tracks:
            track.set_smoothing(min_cutoff, beta)

        pairs: list[tuple[float, int, int]] = []
        for ti, track in enumerate(self.tracks):
            tb = track.box()
            for di, det in enumerate(detections):
                overlap = _iou(tb, (float(det["x"]), float(det["y"]), float(det["w"]), float(det["h"])))
                if overlap >= IOU_THRESHOLD:
                    pairs.append((overlap, ti, di))
        pairs.sort(reverse=True)

        matched_tracks: set[int] = set()
        matched_dets: set[int] = set()
        for _overlap, ti, di in pairs:
            if ti in matched_tracks or di in matched_dets:
                continue
            matched_tracks.add(ti)
            matched_dets.add(di)
            self.tracks[ti].update(detections[di], t)

        previous_count = len(self.tracks)
        for di, det in enumerate(detections):
            if di in matched_dets:
                continue
            self.tracks.append(_Track(self._next_id, det, t, min_cutoff, beta))
            self._next_id += 1

        for ti in range(previous_count):
            if ti not in matched_tracks:
                self.tracks[ti].mark_missed(t)

        self.tracks = [track for track in self.tracks if not track.expired(t)]
        return [track.to_dict() for track in self.tracks if track.visible(t)]


def _self_check() -> None:
    same = _iou((0, 0, 1, 1), (0, 0, 1, 1))
    disjoint = _iou((0, 0, 0.2, 0.2), (0.8, 0.8, 0.2, 0.2))
    if abs(same - 1) > 1e-6 or disjoint != 0:
        raise AssertionError(f"IoU failed: {same}, {disjoint}")

    tracker = PersonTracker()
    rng = random.Random(0)
    raw_steps: list[float] = []
    smooth_steps: list[float] = []
    previous_raw = None
    previous_smooth = None
    t = 0.0
    for i in range(50):
        t += 1 / 15
        true_x = 0.1 + i * 0.008
        noise = rng.uniform(-0.02, 0.02)
        raw_x = true_x + noise
        tracks = tracker.update(
            [{"x": raw_x, "y": 0.2, "w": 0.18, "h": 0.4, "score": 0.9}],
            t,
            smoothing=0.85,
        )
        if previous_raw is not None:
            raw_steps.append(abs((raw_x - previous_raw) - 0.008))
        previous_raw = raw_x
        if tracks and previous_smooth is not None:
            smooth_steps.append(abs((tracks[0]["x"] - previous_smooth) - 0.008))
        if tracks:
            previous_smooth = tracks[0]["x"]

    if not smooth_steps:
        raise AssertionError("Tracker never confirmed a track")
    raw_jitter = sum(raw_steps) / len(raw_steps)
    smooth_jitter = sum(smooth_steps) / len(smooth_steps)
    if smooth_jitter >= raw_jitter:
        raise AssertionError(f"Smoothing did not reduce jitter ({smooth_jitter} vs {raw_jitter})")

    # A one-frame false positive must stay hidden.
    tracker = PersonTracker()
    hidden = tracker.update([{"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.3, "score": 0.5}], 1.0, 0.5)
    if hidden:
        raise AssertionError("Unconfirmed detection was shown")

    # After two hits, a short gap keeps the same id. A longer gap drops the box.
    tracker = PersonTracker()
    tracker.update([{"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.4, "score": 0.9}], 1.0, 0.5)
    shown = tracker.update([{"x": 0.11, "y": 0.1, "w": 0.2, "h": 0.4, "score": 0.9}], 1.1, 0.5)
    held = tracker.update([], 1.2, 0.5)
    if not shown or not held or shown[0]["id"] != held[0]["id"] or not held[0]["held"]:
        raise AssertionError(f"Coast failed: {shown} {held}")
    gone = tracker.update([], 1.2 + COAST_SECONDS + 0.05, 0.5)
    if gone:
        raise AssertionError(f"Box stayed after the person left: {gone}")

    print(f"tracker ok (raw jitter {raw_jitter:.4f}, smooth jitter {smooth_jitter:.4f})")


if __name__ == "__main__":
    _self_check()
