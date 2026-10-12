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
