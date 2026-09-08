"""WebSocket server: frames in, person boxes out."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from app.detector import PersonDetector
from app.tracker import PersonTracker

logger = logging.getLogger(__name__)
ROOT = Path(__file__).resolve().parents[1]
detector = PersonDetector()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    detector.load()
    yield


app = FastAPI(lifespan=lifespan)


def _clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


@app.websocket("/ws")
async def stream(websocket: WebSocket) -> None:
    await websocket.accept()
    tracker = PersonTracker()
    confidence = 0.4
    smoothing = 0.55
    loop = asyncio.get_running_loop()

    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break

            text = message.get("text")
            if text:
                try:
                    payload = json.loads(text)
                except json.JSONDecodeError:
                    continue
                kind = payload.get("type")
                if kind == "config":
                    confidence = _clamp(float(payload.get("confidence", confidence)), 0.15, 0.9)
                    smoothing = _clamp(float(payload.get("smoothing", smoothing)), 0.0, 1.0)
                elif kind == "reset":
                    tracker = PersonTracker()
                continue

            data = message.get("bytes")
            if not data or len(data) > 5_000_000:
                continue

            frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
            if frame is None:
                await websocket.send_json({"type": "error", "message": "Frame could not be read."})
                continue

            started = time.perf_counter()
            try:
                raw = await loop.run_in_executor(None, detector.detect, frame, confidence)
            except Exception:
                logger.exception("detection failed")
                await websocket.send_json({"type": "error", "message": "Detection failed."})
                continue

            tracks = tracker.update(raw, time.perf_counter(), smoothing)
            await websocket.send_json(
                {
                    "type": "tracks",
                    "ms": round((time.perf_counter() - started) * 1000, 1),
                    "raw": raw,
                    "tracks": tracks,
                }
            )
    except WebSocketDisconnect:
        return
    except RuntimeError:
        return


FRONTEND_DIST = ROOT / "frontend" / "dist"
STATIC_DIR = FRONTEND_DIST if FRONTEND_DIST.is_dir() else ROOT / "static"
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
