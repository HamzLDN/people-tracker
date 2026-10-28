"""Associate person boxes across frames and smooth each track."""

from __future__ import annotations

import random

import numpy as np

from app.appearance import appearance_similarity, blend_embedding, embed_person
from app.one_euro import OneEuroFilter

CONFIRM_HITS = 2
# Keep a confirmed box on screen only through a brief detector miss.
# Time-based so a slower frame rate cannot leave a ghost for several seconds.
COAST_SECONDS = 0.35
# The id stays with that spot a little longer, so a flicker can reclaim it
# without looking like a new person.
FLICKER_SECONDS = 1.2
UNCONFIRMED_COAST_SECONDS = 0.12
IOU_THRESHOLD = 0.2
# After the box is gone, keep the look of that person for a short while.
PARK_SECONDS = 20.0
REID_THRESHOLD = 0.78
REID_REACQUIRE = 0.7
REID_MARGIN = 0.04


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


def _box_of(det: dict) -> tuple[float, float, float, float]:
    return (float(det["x"]), float(det["y"]), float(det["w"]), float(det["h"]))


def _center_dist(
    a: tuple[float, float, float, float],
    b: tuple[float, float, float, float],
) -> float:
    ax, ay = a[0] + a[2] / 2, a[1] + a[3] / 2
    bx, by = b[0] + b[2] / 2, b[1] + b[3] / 2
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


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
        self.vx = 0.0
        self.vy = 0.0
        self.updated_at = t
        self.embedding: dict | None = None

    def set_smoothing(self, min_cutoff: float, beta: float) -> None:
        for filt in (self.fx, self.fy, self.fw, self.fh):
            filt.min_cutoff = min_cutoff
            filt.beta = beta

    def update(self, det: dict, t: float, *, snap: bool = False, min_cutoff: float = 1.0, beta: float = 1.0) -> None:
        cx = float(det["x"]) + float(det["w"]) / 2
        cy = float(det["y"]) + float(det["h"]) / 2
        dt = max(1e-3, t - self.updated_at)
        self.vx = 0.55 * self.vx + 0.45 * ((cx - self.cx) / dt)
        self.vy = 0.55 * self.vy + 0.45 * ((cy - self.cy) / dt)
        if snap:
            self.fx = OneEuroFilter(min_cutoff, beta)
            self.fy = OneEuroFilter(min_cutoff, beta)
            self.fw = OneEuroFilter(min_cutoff, beta)
            self.fh = OneEuroFilter(min_cutoff, beta)
            self.vx = 0.0
            self.vy = 0.0
        self.cx = self.fx(cx, t)
        self.cy = self.fy(cy, t)
        self.w = max(0.01, self.fw(float(det["w"]), t))
        self.h = max(0.01, self.fh(float(det["h"]), t))
        self.score = float(det["score"])
        self.hits += 1
        self.misses = 0
        self.lost_since = None
        self.updated_at = t

    def association_box(self, t: float) -> tuple[float, float, float, float]:
        dt = 0.0
        if self.lost_since is not None:
            dt = min(0.5, max(0.0, t - self.lost_since))
        return _clip_box(self.cx + self.vx * dt - self.w / 2, self.cy + self.vy * dt - self.h / 2, self.w, self.h)

    def observe(self, embedding: dict) -> None:
        if self.embedding is None:
            self.embedding = embedding
        else:
            self.embedding = blend_embedding(self.embedding, embedding)

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
        if self.hits >= CONFIRM_HITS:
            return self._lost_for(t) > FLICKER_SECONDS
        return self._lost_for(t) > UNCONFIRMED_COAST_SECONDS

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


class _Parked:
    def __init__(self, track_id: int, embedding: dict, t: float) -> None:
        self.id = track_id
        self.embedding = embedding
        self.t = t


class PersonTracker:
    def __init__(self) -> None:
        self.tracks: list[_Track] = []
        self.parked: list[_Parked] = []
        self._next_id = 1

    def _embed(self, frame: np.ndarray | None, det: dict) -> dict | None:
        if frame is None:
            return None
        return embed_person(frame, _box_of(det))

    def _reattach_flicker(
        self,
        detections: list[dict],
        matched_dets: set[int],
        t: float,
        frame: np.ndarray | None,
        min_cutoff: float,
        beta: float,
    ) -> None:
        """Give a short miss back to the person who was just there."""
        lost = [
            track
            for track in self.tracks
            if track.lost_since is not None and track.hits >= CONFIRM_HITS
        ]
        if not lost:
            return
        proposals: list[tuple[float, int, dict, _Track]] = []
        for di, det in enumerate(detections):
            if di in matched_dets:
                continue
            det_box = _box_of(det)
            scored: list[tuple[float, _Track]] = []
            for track in lost:
                dist = _center_dist(track.association_box(t), det_box)
                reach = max(track.h, det_box[3], 0.08) * 0.9
                if dist <= reach:
                    scored.append((dist, track))
            if not scored:
                continue
            scored.sort(key=lambda item: item[0])
            best_dist, best_track = scored[0]
            if len(scored) > 1:
                gap = scored[1][0] - best_dist
                if gap < max(best_track.h, det_box[3]) * 0.3:
                    continue
            proposals.append((best_dist, di, det, best_track))
        proposals.sort(key=lambda item: item[0])
        used: set[int] = set()
        for _dist, di, det, track in proposals:
            if di in matched_dets or id(track) in used:
                continue
            used.add(id(track))
            matched_dets.add(di)
            track.update(det, t, snap=True, min_cutoff=min_cutoff, beta=beta)
            embedding = self._embed(frame, det)
            if embedding is not None:
                track.observe(embedding)

    def update(
        self,
        detections: list[dict],
        t: float,
        smoothing: float,
        frame: np.ndarray | None = None,
    ) -> list[dict]:
        min_cutoff, beta = smoothing_params(smoothing)
        for track in self.tracks:
            track.set_smoothing(min_cutoff, beta)

        pairs: list[tuple[float, int, int]] = []
        for ti, track in enumerate(self.tracks):
            tb = track.association_box(t)
            for di, det in enumerate(detections):
                det_box = _box_of(det)
                overlap = _iou(tb, det_box)
                if overlap < IOU_THRESHOLD:
                    tcx, tcy = tb[0] + tb[2] / 2, tb[1] + tb[3] / 2
                    dcx, dcy = det_box[0] + det_box[2] / 2, det_box[1] + det_box[3] / 2
                    reach = max(tb[3], det_box[3]) * 0.55
                    dist = ((tcx - dcx) ** 2 + (tcy - dcy) ** 2) ** 0.5
                    if dist > reach:
                        continue
                    overlap = IOU_THRESHOLD
                pairs.append((overlap, ti, di))
        pairs.sort(reverse=True)

        matched_tracks: set[int] = set()
        matched_dets: set[int] = set()
        for _overlap, ti, di in pairs:
            if ti in matched_tracks or di in matched_dets:
                continue
            matched_tracks.add(ti)
            matched_dets.add(di)
            det = detections[di]
            self.tracks[ti].update(det, t)
            embedding = self._embed(frame, det)
            if embedding is not None:
                self.tracks[ti].observe(embedding)

        prior = len(self.tracks)
        for ti in range(prior):
            if ti not in matched_tracks:
                self.tracks[ti].mark_missed(t)

        self._reattach_flicker(detections, matched_dets, t, frame, min_cutoff, beta)

        fresh: list[tuple[int, dict, dict]] = []
        for di, det in enumerate(detections):
            if di in matched_dets:
                continue
            embedding = self._embed(frame, det)
            if embedding is not None:
                fresh.append((di, det, embedding))

        coasting = [
            track
            for track in self.tracks
            if track.lost_since is not None and track.embedding is not None and track.hits >= CONFIRM_HITS
        ]
        order: list[tuple[float, int, dict, dict, _Track]] = []
        for di, det, embedding in fresh:
            ranked = [(appearance_similarity(embedding, track.embedding), track) for track in coasting]
            if not ranked:
                continue
            ranked.sort(key=lambda item: item[0], reverse=True)
            best = ranked[0][0]
            second = ranked[1][0] if len(ranked) > 1 else -1.0
            if best >= REID_REACQUIRE and best - second >= REID_MARGIN:
                order.append((best, di, det, embedding, ranked[0][1]))
        order.sort(key=lambda item: item[0], reverse=True)
        used_tracks: set[int] = set()
        claimed: set[int] = set()
        for _score, di, det, embedding, track in order:
            if di in claimed or id(track) in used_tracks:
                continue
            claimed.add(di)
            used_tracks.add(id(track))
            track.update(det, t, snap=True, min_cutoff=min_cutoff, beta=beta)
            track.observe(embedding)
            matched_dets.add(di)

        kept: list[_Track] = []
        for track in self.tracks:
            if not track.expired(t):
                kept.append(track)
                continue
            if track.hits >= CONFIRM_HITS and track.embedding is not None:
                self.parked.append(_Parked(track.id, track.embedding, t))
        self.tracks = kept
        self.parked = [parked for parked in self.parked if t - parked.t <= PARK_SECONDS]
        if len(self.parked) > 48:
            self.parked = self.parked[-48:]

        order = []
        for di, det, embedding in fresh:
            if di in matched_dets:
                continue
            ranked = [
                (appearance_similarity(embedding, parked.embedding), index)
                for index, parked in enumerate(self.parked)
            ]
            if not ranked:
                continue
            ranked.sort(reverse=True)
            best = ranked[0][0]
            second = ranked[1][0] if len(ranked) > 1 else -1.0
            if best >= REID_THRESHOLD and best - second >= REID_MARGIN:
                order.append((best, di, det, embedding, ranked[0][1]))
        order.sort(key=lambda item: item[0], reverse=True)
        used_park: set[int] = set()
        for _score, di, det, embedding, park_index in order:
            if di in claimed or park_index in used_park:
                continue
            claimed.add(di)
            used_park.add(park_index)
            parked = self.parked[park_index]
            track = _Track(parked.id, det, t, min_cutoff, beta)
            track.hits = CONFIRM_HITS
            track.embedding = embedding
            self._next_id = max(self._next_id, parked.id + 1)
            self.tracks.append(track)
            matched_dets.add(di)
        if used_park:
            self.parked = [parked for index, parked in enumerate(self.parked) if index not in used_park]

        for di, det in enumerate(detections):
            if di in matched_dets:
                continue
            track = _Track(self._next_id, det, t, min_cutoff, beta)
            self._next_id += 1
            embedding = self._embed(frame, det)
            if embedding is not None:
                track.observe(embedding)
            self.tracks.append(track)

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

    # A flicker past the on-screen coast, with no color cue, keeps the same id
    # when the person is still in that spot. Someone far away does not inherit it.
    tracker = PersonTracker()
    spot = {"x": 0.2, "y": 0.15, "w": 0.2, "h": 0.5, "score": 0.9}
    tracker.update([spot], 1.0, 0.4)
    shown = tracker.update([spot], 1.1, 0.4)
    if not shown:
        raise AssertionError("flicker track never confirmed")
    person_id = shown[0]["id"]
    tracker.update([], 1.2, 0.4)
    flickered = tracker.update([{"x": 0.24, "y": 0.16, "w": 0.2, "h": 0.5, "score": 0.9}], 1.8, 0.4)
    if not flickered or flickered[0]["id"] != person_id:
        raise AssertionError(f"flicker minted a new id: {flickered}")
    tracker.update([], 1.9, 0.4)
    far = {"x": 0.72, "y": 0.15, "w": 0.18, "h": 0.45, "score": 0.9}
    tracker.update([far], 2.05, 0.4)
    stranger = tracker.update([far], 2.15, 0.4)
    far_boxes = [box for box in stranger if box["x"] > 0.5]
    if not far_boxes or far_boxes[0]["id"] == person_id:
        raise AssertionError(f"distant person took id {person_id}: {stranger}")

    def paint(frame: np.ndarray, box: dict, shirt: tuple[int, int, int], pants: tuple[int, int, int]) -> None:
        height, width = frame.shape[:2]
        x0, y0 = int(box["x"] * width), int(box["y"] * height)
        x1 = int((box["x"] + box["w"]) * width)
        y1 = int((box["y"] + box["h"]) * height)
        mid = y0 + int(0.55 * (y1 - y0))
        frame[y0:mid, x0:x1] = shirt
        frame[mid:y1, x0:x1] = pants

    frame = np.zeros((240, 240, 3), dtype=np.uint8)
    left = {"x": 0.08, "y": 0.1, "w": 0.28, "h": 0.7, "score": 0.95}
    right = {"x": 0.62, "y": 0.12, "w": 0.28, "h": 0.68, "score": 0.95}
    paint(frame, left, (40, 40, 210), (20, 20, 50))
    tracker = PersonTracker()
    tracker.update([left], 1.0, 0.4, frame)
    seen = tracker.update([left], 1.1, 0.4, frame)
    if not seen:
        raise AssertionError("appearance track never confirmed")
    original = seen[0]["id"]
    tracker.update([], 1.2, 0.4, frame)
    tracker.update([], 1.2 + FLICKER_SECONDS + 0.05, 0.4, frame)
    if tracker.tracks or not tracker.parked:
        raise AssertionError("lost appearance was not parked")
    frame[:] = 0
    paint(frame, right, (40, 40, 210), (20, 20, 50))
    jumped = tracker.update([right], 1.2 + FLICKER_SECONDS + 0.2, 0.4, frame)
    if not jumped or jumped[0]["id"] != original:
        raise AssertionError(f"id changed when the box jumped: {jumped}")
    lost_at = 1.2 + FLICKER_SECONDS + 0.3
    tracker.update([], lost_at, 0.4, frame)
    tracker.update([], lost_at + FLICKER_SECONDS + 0.05, 0.4, frame)
    frame[:] = 0
    paint(frame, right, (40, 40, 210), (20, 20, 50))
    back = tracker.update([right], lost_at + FLICKER_SECONDS + 0.2, 0.4, frame)
    if not back or back[0]["id"] != original:
        raise AssertionError(f"did not restore id {original}: {back} sim parked={len(tracker.parked)}")

    frame[:] = 0
    stranger = {"x": 0.08, "y": 0.1, "w": 0.28, "h": 0.7, "score": 0.95}
    paint(frame, stranger, (210, 180, 40), (160, 140, 20))
    cleared = lost_at + FLICKER_SECONDS + 0.3
    tracker.update([], cleared, 0.4, frame)
    tracker.update([], cleared + FLICKER_SECONDS + 0.05, 0.4, frame)
    tracker.update([stranger], cleared + FLICKER_SECONDS + 0.2, 0.4, frame)
    newbie = tracker.update([stranger], cleared + FLICKER_SECONDS + 0.3, 0.4, frame)
    if not newbie or newbie[0]["id"] == original:
        raise AssertionError(f"different clothing reused id {original}: {newbie}")

    print(f"tracker ok (raw jitter {raw_jitter:.4f}, smooth jitter {smooth_jitter:.4f})")


if __name__ == "__main__":
    _self_check()
