# People Tracker

Local people counting with YOLOv8 (FastAPI + WebSocket) and a **React** frontend (Vite).

## Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
.venv/bin/python -m app.main
```

API and WebSocket: `http://127.0.0.1:8000` · `/ws`

## Frontend (React)

**Development** (hot reload, proxies WebSocket to the backend):

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173` while the Python server is running on port 8000.

**Production** (single server serves the built UI):

```bash
cd frontend
npm install
npm run build
cd ..
.venv/bin/python -m app.main
```

Open `http://127.0.0.1:8000`.

The legacy vanilla UI remains in `static/` as a fallback until you run `npm run build`.

## MOT17 (walk / re-ID benchmarks)

For **Metrics → Walk** and comparing relinks to **ground-truth person IDs**, use the **full MOT17** archive (train labels + test video). MOT17 is **CC BY-NC-SA 3.0** (non-commercial).

1. Download [MOT17.zip](https://motchallenge.net/data/MOT17.zip) (~5.5 GB) into `output/MOT17.zip`.
2. Prepare browser videos + manifest (extracts to `output/motchallenge/`; prefers **SDP** train sequences):

```bash
.venv/Scripts/python.exe -m pip install imageio-ffmpeg
.venv/Scripts/python.exe scripts/prepare_mot17.py
```

3. In the app **Source** tab, choose **MOT17 train video** → **Use**, then **Metrics → Walk**.

Offline score vs. `gt/gt.txt` on a train sequence:

```bash
.venv/Scripts/python.exe scripts/eval_mot17_walk.py --sequence MOT17-05-SDP
```

A smaller **train-frames-only** mirror exists for quick demos, but it has **no** official `gt.txt` — use full MOT17 when evaluating walk-based identity.

## Recent sessions

On the **Source** tab, choose a session under **Select session** and press **Use** to load camera or video plus zones and settings.

Uploaded videos are kept in **IndexedDB** so they can replay without choosing the file again. The list keeps up to 12 entries; older ones drop off.

## Session snapshot

**Walk** (Metrics) builds an experimental **movement signature** from each person’s path and pace, and flags when someone **returns with a similar walk** to an earlier track in the same session. This is not facial ID; treat it as a demo only.

On **Metrics**, press **Session snapshot** after the feed has run for a few seconds. You get a full-page **insights** view: peak crowd, dwell, zone comparison, traffic heatmap, written takeaways, and **Export JSON** for your own analysis. **Back to tracker** returns to the live app. The snapshot is kept in **sessionStorage** for this browser tab, so refreshing the insights page does not clear it.
