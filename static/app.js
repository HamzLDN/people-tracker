const TRACK_COLOR = "#4ade80";
const ZONE_COLORS = ["#f0e07a", "#7ad7f0", "#c79bff", "#f07aa8", "#7af0b8", "#f0a37a"];
const MAX_ZONES = 8;

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const stage = document.getElementById("stage");
const empty = document.getElementById("empty");
const hud = document.getElementById("hud");
const peopleStat = document.getElementById("peopleStat");
const detectStat = document.getElementById("detectStat");
const fpsStat = document.getElementById("fpsStat");
const sourceError = document.getElementById("sourceError");
const sidebarControls = document.getElementById("sidebarControls");
const cameraBtn = document.getElementById("cameraBtn");
const cameraBtnEmpty = document.getElementById("cameraBtnEmpty");
const fileInput = document.getElementById("file");
const fileInputEmpty = document.getElementById("fileEmpty");
const mirrorInput = document.getElementById("mirror");
const followPopup = document.getElementById("followPopup");
const followPopupHead = document.getElementById("followPopupHead");
const followPopupClose = document.getElementById("followPopupClose");
const followPopupLabel = document.getElementById("followPopupLabel");
const followPopupCanvas = document.getElementById("followPopupCanvas");
const followPopupCtx = followPopupCanvas.getContext("2d", { alpha: false });
const zoneModeBtn = document.getElementById("zoneModeBtn");
const zoneClearBtn = document.getElementById("zoneClearBtn");
const zoneList = document.getElementById("zoneList");
const zoneHint = document.getElementById("zoneHint");
const sidebarTabs = document.getElementById("sidebarTabs");
const tabSource = document.getElementById("tabSource");
const tabMetrics = document.getElementById("tabMetrics");
const panelSource = document.getElementById("panelSource");
const panelMetrics = document.getElementById("panelMetrics");
const metricsChart = document.getElementById("metricsChart");
const metricsChartWrap = metricsChart.parentElement;
const metricsCtx = metricsChart.getContext("2d");
const metricsSummary = document.getElementById("metricsSummary");
const metricsBusiest = document.getElementById("metricsBusiest");
const metricsBusiestArea = document.getElementById("metricsBusiestArea");
const trafficBusiestArea = document.getElementById("trafficBusiestArea");
const trafficZoneRank = document.getElementById("trafficZoneRank");
const showPopulatedAreaInput = document.getElementById("showPopulatedArea");
const metricsEntries = document.getElementById("metricsEntries");
const metricsDwell = document.getElementById("metricsDwell");
const metricsZonesChart = document.getElementById("metricsZonesChart");
const metricsHeat = document.getElementById("metricsHeat");
const metricsEntryCtx = metricsEntries.getContext("2d");
const metricsDwellCtx = metricsDwell.getContext("2d");
const metricsZonesCtx = metricsZonesChart?.getContext("2d");
const metricsHeatCtx = metricsHeat.getContext("2d");
const metricsChartEmpty = document.getElementById("metricsChartEmpty");
const metricsEntriesEmpty = document.getElementById("metricsEntriesEmpty");
const metricsDwellEmpty = document.getElementById("metricsDwellEmpty");
const metricsZonesEmpty = document.getElementById("metricsZonesEmpty");
const zonesMetricsList = document.getElementById("zonesMetricsList");
const metricsHeatEmpty = document.getElementById("metricsHeatEmpty");
const statUnique = document.getElementById("statUnique");
const statAvg = document.getElementById("statAvg");
const statZoneCount = document.getElementById("statZoneCount");
const statZoneLeader = document.getElementById("statZoneLeader");
const metricViews = [...document.querySelectorAll(".metric-view")];
const metricSubtabs = [...document.querySelectorAll(".metrics-subtab")];
const zoneMetricsMenu = document.getElementById("zoneMetricsMenu");
const zoneMetricsHint = document.getElementById("zoneMetricsHint");
const zoneMetricsPrompt = document.getElementById("zoneMetricsPrompt");
const metricsPickStep = document.getElementById("metricsPickStep");
const metricsMainStep = document.getElementById("metricsMainStep");
const metricsScopeLabel = document.getElementById("metricsScopeLabel");
const metricsChangeScope = document.getElementById("metricsChangeScope");
const zoneMetricsNext = document.getElementById("zoneMetricsNext");

const HEAT_W = 28;
const HEAT_H = 16;
const ENTRY_BUCKET_SEC = 30;
const DWELL_BINS = [
  { label: "0–2s", max: 2 },
  { label: "2–5s", max: 5 },
  { label: "5–10s", max: 10 },
  { label: "10–30s", max: 30 },
  { label: "30s+", max: Infinity },
];

const ctx = overlay.getContext("2d");
const capture = document.createElement("canvas");
const captureCtx = capture.getContext("2d", { alpha: false });
const heatVideoScratch = document.createElement("canvas");
const heatVideoScratchCtx = heatVideoScratch.getContext("2d");

const state = {
  ws: null,
  running: false,
  busy: false,
  sentAt: 0,
  mirror: true,
  confidence: 0.4,
  smoothing: 0.55,
  raw: [],
  tracks: new Map(),
  trails: new Map(),
  lastPacket: 0,
  packetMarks: [],
  detectMs: null,
  objectUrl: null,
  stream: null,
  selectedId: null,
  finishedTrail: null,
  sessionStartedAt: 0,
  crowdHistory: [],
  lastMetricVideoTime: null,
  metricsBlend: [],
  trackLife: new Map(),
  entryTimes: [],
  dwellTimes: [],
  perfHistory: [],
  heatGrid: new Float32Array(HEAT_W * HEAT_H),
  zones: [],
  zoneNextId: 1,
  zoneMode: false,
  zoneDraft: null,
  highlightZoneId: null,
  metricsZoneId: null,
  metricsZoneView: null,
  metricsSelectedZoneIds: [],
  metricsScopeStep: "pick",
  showPopulatedAreaOnVideo: false,
  followPopupX: null,
  followPopupY: null,
};

let zoneDragPointer = null;
let zoneCornerDrag = null;
let zoneCornerDidDrag = false;
let followPopupDrag = null;
let zoneListSignature = "";
let zoneMenuSignature = "";
let zoneRenameEditingId = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function setPlaybackUi(active) {
  hud.hidden = !active;
  empty.hidden = active;
  sidebarControls.hidden = !active;
  sidebarTabs.hidden = !active;
  if (!active) {
    selectTab("source");
  }
}

function showSourceError(message) {
  if (!message) {
    sourceError.hidden = true;
    sourceError.textContent = "";
    return;
  }
  sourceError.textContent = message;
  sourceError.hidden = false;
}

function send(payload) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(payload));
  }
}

function sendConfig() {
  send({ type: "config", confidence: state.confidence, smoothing: state.smoothing });
}

function resetOverlay() {
  state.raw = [];
  state.tracks.clear();
  state.trails.clear();
  state.lastPacket = 0;
  state.packetMarks = [];
  state.detectMs = null;
  state.selectedId = null;
  state.finishedTrail = null;
  resetCrowdMetrics();
  updateFollowPopupChrome();
  send({ type: "reset" });
}

function resetCrowdMetrics() {
  state.crowdHistory = [];
  state.lastMetricVideoTime = null;
  state.metricsBlend = [];
  state.trackLife.clear();
  state.entryTimes = [];
  state.dwellTimes = [];
  state.perfHistory = [];
  state.heatGrid.fill(0);
  metricsSummary.textContent =
    "People in frame over time. Run the video for a few seconds to fill the charts.";
  metricsBusiest.textContent = "—";
  metricsCtx.clearRect(0, 0, metricsChart.width, metricsChart.height);
  clearMiniCharts();
  updateChartEmptyStates();
  if (statUnique) statUnique.textContent = "—";
  if (statAvg) statAvg.textContent = "—";
  resetAllZoneStats();
}

function clearMiniCharts() {
  for (const canvas of [metricsEntries, metricsDwell, metricsZonesChart, metricsHeat]) {
    if (!canvas) continue;
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function resetPlaybackSessionForLoop() {
  resetCrowdMetrics();
  state.tracks.clear();
  state.trails.clear();
  state.raw = [];
  state.selectedId = null;
  state.finishedTrail = null;
  send({ type: "reset" });
  updateFollowPopupChrome();
  if (!panelMetrics.hidden) {
    refreshMetrics();
  }
}

function noteTrackLife(id, isNew) {
  const t = sessionSeconds();
  if (isNew) {
    state.trackLife.set(id, { firstT: t, lastT: t });
    if (t >= metricsWarmupSeconds()) {
      state.entryTimes.push(t);
    }
    return;
  }
  const life = state.trackLife.get(id);
  if (life) life.lastT = t;
}

function closeTrackLife(id) {
  const life = state.trackLife.get(id);
  if (life) {
    const dwell = life.lastT - life.firstT;
    if (dwell >= 0.25) state.dwellTimes.push(dwell);
  }
  state.trackLife.delete(id);
}

function initZoneMetrics(zone) {
  zone.stats = {
    history: [],
    metricsBlend: [],
    entryTimes: [],
    dwellTimes: [],
    trackInside: new Map(),
  };
}

function resetZoneStats(zone) {
  if (!zone.stats) return;
  zone.stats.history = [];
  zone.stats.metricsBlend = [];
  zone.stats.entryTimes = [];
  zone.stats.dwellTimes = [];
  zone.stats.trackInside.clear();
}

function resetAllZoneStats() {
  for (const zone of state.zones) {
    resetZoneStats(zone);
  }
}

function pushZoneCount(zone, count, t) {
  if (!zone.stats) initZoneMetrics(zone);
  if (t < metricsWarmupSeconds()) return;
  zone.stats.metricsBlend.push(count);
  if (zone.stats.metricsBlend.length > 4) zone.stats.metricsBlend.shift();
  const blended = Math.round(
    zone.stats.metricsBlend.reduce((sum, value) => sum + value, 0) / zone.stats.metricsBlend.length
  );
  const tail = zone.stats.history[zone.stats.history.length - 1];
  if (tail && Math.abs(tail.t - t) < 0.07 && tail.count === blended) return;
  zone.stats.history.push({ t, count: blended });
  if (zone.stats.history.length > 5000) zone.stats.history.shift();
}

function closeZoneTrackForAllZones(id) {
  const t = sessionSeconds();
  for (const zone of state.zones) {
    if (!zone.stats) continue;
    const enteredAt = zone.stats.trackInside.get(id);
    if (enteredAt == null) continue;
    const dwell = t - enteredAt;
    if (dwell >= 0.25 && t >= metricsWarmupSeconds()) {
      zone.stats.dwellTimes.push(dwell);
    }
    zone.stats.trackInside.delete(id);
  }
}

function recordZoneMetrics(tracks) {
  if (!state.running || !state.zones.length) return;
  const t = sessionSeconds();
  for (const zone of state.zones) {
    if (!zone.stats) initZoneMetrics(zone);
    const insideIds = new Set();
    for (const tr of tracks) {
      const box = { x: tr.x, y: tr.y, w: tr.w, h: tr.h };
      if (personInZone(box, zone)) insideIds.add(tr.id);
    }
    pushZoneCount(zone, insideIds.size, t);

    for (const id of insideIds) {
      if (!zone.stats.trackInside.has(id)) {
        zone.stats.trackInside.set(id, t);
        if (t >= metricsWarmupSeconds()) zone.stats.entryTimes.push(t);
      }
    }
    for (const [id, enteredAt] of [...zone.stats.trackInside.entries()]) {
      if (insideIds.has(id)) continue;
      const dwell = t - enteredAt;
      if (dwell >= 0.25 && t >= metricsWarmupSeconds()) {
        zone.stats.dwellTimes.push(dwell);
      }
      zone.stats.trackInside.delete(id);
    }
  }
}

function recordHeatmap(trackList) {
  const t = sessionSeconds();
  if (t < metricsWarmupSeconds()) return;
  for (const tr of trackList) {
    const cx = tr.x + tr.w / 2;
    const cy = tr.y + tr.h / 2;
    const ix = clamp(Math.floor(cx * HEAT_W), 0, HEAT_W - 1);
    const iy = clamp(Math.floor(cy * HEAT_H), 0, HEAT_H - 1);
    state.heatGrid[iy * HEAT_W + ix] += 1;
  }
}

function recordPerformance(ms) {
  if (!state.running) return;
  const t = sessionSeconds();
  const last = state.perfHistory[state.perfHistory.length - 1];
  if (last && t < last.t - 0.08) return;
  if (last && t < last.t) return;
  if (t < metricsWarmupSeconds()) return;
  const fps = state.packetMarks.length;
  if (last && Math.abs(last.t - t) < 0.07 && last.ms === ms && last.fps === fps) return;
  state.perfHistory.push({ t, ms, fps });
  if (state.perfHistory.length > 5000) state.perfHistory.shift();
}

function metricsWarmupSeconds() {
  return state.stream ? 1.25 : 0.75;
}

function noteVideoClock() {
  if (!state.running || state.stream) return;
  const t = video.currentTime;
  if (state.lastMetricVideoTime != null && t < state.lastMetricVideoTime - 0.08) {
    resetPlaybackSessionForLoop();
  }
  state.lastMetricVideoTime = t;
}

function sessionSeconds() {
  if (state.stream) {
    return (performance.now() - state.sessionStartedAt) / 1000;
  }
  if (video.readyState >= 1 && Number.isFinite(video.currentTime)) {
    return video.currentTime;
  }
  return (performance.now() - state.sessionStartedAt) / 1000;
}

function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  if (m > 0) {
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `${s}s`;
}

function formatAxisTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function sortedCrowdHistory() {
  return [...state.crowdHistory].sort((a, b) => a.t - b.t);
}

function smoothCounts(history, windowSize) {
  if (!history.length) return [];
  const half = Math.floor(windowSize / 2);
  return history.map((point, index) => {
    let sum = 0;
    let n = 0;
    for (let j = index - half; j <= index + half; j += 1) {
      if (j < 0 || j >= history.length) continue;
      sum += history[j].count;
      n += 1;
    }
    return { t: point.t, count: sum / n };
  });
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function analyzeCrowd(history) {
  if (history.length < 6) {
    return null;
  }

  const smooth = smoothCounts(history, 5);
  let peakCount = 0;
  let peakTime = history[0].t;
  for (const point of history) {
    if (point.count > peakCount) {
      peakCount = point.count;
      peakTime = point.t;
    }
  }

  const earlyLen = Math.max(4, Math.ceil(smooth.length * 0.15));
  const earlyMedian = median(smooth.slice(0, earlyLen).map((point) => point.count));
  const lateMedian = median(smooth.slice(-earlyLen).map((point) => point.count));
  const rise = peakCount - earlyMedian;
  const minRampTime = history[0].t + 0.35;

  if (rise < 3 || lateMedian < earlyMedian + 2) {
    return { peakCount, peakTime, rampTime: null, baseline: earlyMedian };
  }

  const threshold = earlyMedian + Math.max(3, rise * 0.3);

  let rampTime = null;
  for (let i = 2; i < smooth.length; i += 1) {
    if (smooth[i].t < minRampTime) continue;
    const prevAvg =
      smooth.slice(Math.max(0, i - 3), i).reduce((sum, point) => sum + point.count, 0) /
      Math.min(3, i);
    if (prevAvg >= threshold - 0.5) continue;
    if (smooth[i].count >= threshold && smooth[i - 1].count >= threshold - 1) {
      rampTime = smooth[i].t;
      break;
    }
  }

  if (rampTime == null) {
    let bestSlope = 0;
    for (let i = 0; i < smooth.length; i += 1) {
      if (smooth[i].t < minRampTime) continue;
      for (let j = i + 1; j < smooth.length; j += 1) {
        const dt = smooth[j].t - smooth[i].t;
        if (dt < 0.8) continue;
        if (dt > 6) break;
        const slope = (smooth[j].count - smooth[i].count) / dt;
        if (slope > bestSlope) {
          bestSlope = slope;
          rampTime = smooth[i].t;
        }
      }
    }
    if (bestSlope < 1.2) {
      rampTime = null;
    }
  }

  return { peakCount, peakTime, rampTime, baseline: earlyMedian };
}

function recordCrowd(count) {
  if (!state.running) return;
  const t = sessionSeconds();
  const last = state.crowdHistory[state.crowdHistory.length - 1];
  if (last && t < last.t - 0.08) {
    resetPlaybackSessionForLoop();
  } else if (last && t < last.t) {
    return;
  }
  if (t < metricsWarmupSeconds()) return;

  state.metricsBlend.push(count);
  if (state.metricsBlend.length > 4) state.metricsBlend.shift();
  const blended = Math.round(
    state.metricsBlend.reduce((sum, value) => sum + value, 0) / state.metricsBlend.length
  );

  const tail = state.crowdHistory[state.crowdHistory.length - 1];
  if (tail && Math.abs(tail.t - t) < 0.07 && tail.count === blended) return;
  state.crowdHistory.push({ t, count: blended });
  if (state.crowdHistory.length > 5000) {
    state.crowdHistory.shift();
  }
}

function resizeChartCanvas(canvas, wrap) {
  if (!canvas || !wrap) return;
  const bounds = wrap.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width * dpr));
  const height = Math.max(1, Math.round(bounds.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawCountTimeChart(canvas, ctx, history, analysis, strokeColor) {
  if (!canvas || !ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  if (history.length < 2) return;

  const series = [...history].sort((a, b) => a.t - b.t);
  const pad = { l: 34, r: 8, t: 8, b: 22 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const span = Math.max(t1 - t0, 0.25);
  let yMax = 4;
  for (const point of history) {
    yMax = Math.max(yMax, point.count);
  }
  yMax = Math.ceil(yMax);

  const xAt = (t) => pad.l + ((t - t0) / span) * plotW;
  const yAt = (count) => pad.t + plotH - (count / yMax) * plotH;

  const fontSize = Math.max(10, width * 0.028);
  ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  ctx.strokeStyle = "rgba(244, 241, 232, 0.1)";
  ctx.lineWidth = 1;
  for (let tick = 0; tick <= yMax; tick += Math.max(1, Math.ceil(yMax / 4))) {
    const y = yAt(tick);
    ctx.fillText(String(tick), pad.l - 6, y);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(width - pad.r, y);
    ctx.stroke();
  }

  ctx.beginPath();
  series.forEach((point, index) => {
    const x = xAt(point.t);
    const y = yAt(point.count);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(xAt(series[series.length - 1].t), pad.t + plotH);
  ctx.lineTo(xAt(series[0].t), pad.t + plotH);
  ctx.closePath();
  ctx.fillStyle = rgbaFromHex(strokeColor, 0.18);
  ctx.fill();

  ctx.beginPath();
  series.forEach((point, index) => {
    const x = xAt(point.t);
    const y = yAt(point.count);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  const markerTime = analysis?.peakTime ?? analysis?.rampTime;
  if (markerTime != null) {
    const rx = xAt(markerTime);
    ctx.strokeStyle = "rgba(240, 163, 122, 0.9)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rx, pad.t);
    ctx.lineTo(rx, pad.t + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.fillText(formatAxisTime(t0), pad.l, height - 4);
  ctx.textAlign = "right";
  ctx.fillText(formatAxisTime(t1), width - pad.r, height - 4);
}

function drawMetricsChart(history, analysis) {
  resizeChartCanvas(metricsChart, metricsChartWrap);
  drawCountTimeChart(metricsChart, metricsCtx, history, analysis, "#d6ee6a");
}

function drawMultiCountTimeChart(canvas, ctx, seriesList) {
  if (!canvas || !ctx) return;
  const valid = seriesList.filter((s) => s.history.length >= 2);
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  if (!valid.length) return;

  const allPoints = valid.flatMap((s) => s.history);
  const t0 = Math.min(...allPoints.map((p) => p.t));
  const t1 = Math.max(...allPoints.map((p) => p.t));
  const span = Math.max(t1 - t0, 0.25);
  let yMax = 4;
  for (const p of allPoints) yMax = Math.max(yMax, p.count);
  yMax = Math.ceil(yMax);

  const pad = { l: 34, r: 8, t: 8, b: 22 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const xAt = (t) => pad.l + ((t - t0) / span) * plotW;
  const yAt = (count) => pad.t + plotH - (count / yMax) * plotH;

  const fontSize = Math.max(10, width * 0.028);
  ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(244, 241, 232, 0.1)";
  ctx.lineWidth = 1;
  for (let tick = 0; tick <= yMax; tick += Math.max(1, Math.ceil(yMax / 4))) {
    const y = yAt(tick);
    ctx.fillText(String(tick), pad.l - 6, y);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(width - pad.r, y);
    ctx.stroke();
  }

  for (const series of valid) {
    const sorted = [...series.history].sort((a, b) => a.t - b.t);
    ctx.beginPath();
    sorted.forEach((point, index) => {
      const x = xAt(point.t);
      const y = yAt(point.count);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.fillText(formatAxisTime(t0), pad.l, height - 4);
  ctx.textAlign = "right";
  ctx.fillText(formatAxisTime(t1), width - pad.r, height - 4);
}

function averageCrowd(history) {
  if (!history.length) return null;
  const sum = history.reduce((acc, p) => acc + p.count, 0);
  return sum / history.length;
}

function updateChartEmptyStates() {
  const history = scopedCrowdHistory();
  const view = state.metricsZoneView;
  let overviewReady = history.length >= 2;
  if (view === "multi") {
    overviewReady = getSelectedZones().some((z) => sortedZoneHistory(z).length >= 2);
  }
  if (metricsChartEmpty) metricsChartEmpty.hidden = overviewReady;
  if (metricsEntriesEmpty) metricsEntriesEmpty.hidden = scopedEntryTimes().length > 0;
  const dwellTotal = scopedDwellTimes().length;
  if (metricsDwellEmpty) metricsDwellEmpty.hidden = dwellTotal > 0;
  const zonesTab = zonesForMetricsZonesTab();
  const zonesChartReady =
    zonesTab.length > 0 &&
    zonesTab.some((z) => sortedZoneHistory(z).length >= 1 && (averageCrowd(sortedZoneHistory(z)) || 0) > 0);
  if (metricsZonesEmpty) metricsZonesEmpty.hidden = zonesChartReady;
  let heatPeak = 0;
  for (const v of state.heatGrid) heatPeak = Math.max(heatPeak, v);
  if (metricsHeatEmpty) metricsHeatEmpty.hidden = heatPeak > 0;
}

function activeMetricsZone() {
  if (state.metricsZoneView !== "zone" || state.metricsZoneId == null) return null;
  return state.zones.find((z) => z.id === state.metricsZoneId) || null;
}

function getSelectedZones() {
  const ids = new Set(state.metricsSelectedZoneIds);
  return state.zones.filter((z) => ids.has(z.id));
}

function toggleZoneIncluded(zoneId) {
  const ids = new Set(state.metricsSelectedZoneIds);
  if (ids.has(zoneId)) ids.delete(zoneId);
  else ids.add(zoneId);
  state.metricsSelectedZoneIds = [...ids];
  zoneMenuSignature = "";
  syncZoneMetricsMenu();
  updateZoneMetricsNextButton();
}

function updateZoneMetricsNextButton() {
  if (!zoneMetricsNext) return;
  const needsZonePick = state.zones.length > 0 && state.metricsSelectedZoneIds.length === 0;
  zoneMetricsNext.disabled = needsZonePick;
}

function zoneMetricsSelectionTitle() {
  if (state.metricsZoneView === "frame") return "Entire frame";
  const selected = getSelectedZones();
  if (!selected.length) return "Metrics";
  if (selected.length === 1) return selected[0].name;
  return selected.map((z) => z.name).join(", ");
}

function applyMetricsZoneSelection() {
  const ids = state.metricsSelectedZoneIds;
  if (ids.length === 1) {
    state.metricsZoneView = "zone";
    state.metricsZoneId = ids[0];
    state.highlightZoneId = ids[0];
  } else {
    state.metricsZoneView = "multi";
    state.metricsZoneId = null;
  }
  zoneListSignature = "";
}

function updateMetricsScopeLabel() {
  const label = zoneMetricsSelectionTitle();
  if (metricsScopeLabel) metricsScopeLabel.textContent = label;
}

function showMetricsPickStep() {
  state.metricsScopeStep = "pick";
  if (metricsPickStep) metricsPickStep.hidden = false;
  if (metricsMainStep) metricsMainStep.hidden = true;
  syncMetricsPickStep();
}

function showMetricsMainStep() {
  state.metricsScopeStep = "main";
  if (metricsPickStep) metricsPickStep.hidden = true;
  if (metricsMainStep) metricsMainStep.hidden = false;
  updateMetricsScopeLabel();
  refreshMetrics();
}

function goToMetricsMain() {
  if (!state.zones.length) {
    state.metricsZoneView = "frame";
    state.metricsZoneId = null;
    state.highlightZoneId = null;
  } else if (!state.metricsSelectedZoneIds.length) {
    return;
  } else {
    applyMetricsZoneSelection();
  }
  showMetricsMainStep();
  const active = metricSubtabs.find((b) => b.classList.contains("active"));
  selectMetricView(active?.dataset.metric || "overview");
}

function backToMetricsPick() {
  showMetricsPickStep();
}

function setMetricsZoneId(id) {
  state.metricsSelectedZoneIds = [id];
  applyMetricsZoneSelection();
  if (state.metricsScopeStep === "main") {
    updateMetricsScopeLabel();
    refreshMetrics();
  }
}

function metricsScopeIsZone() {
  return state.metricsZoneView === "zone" && activeMetricsZone();
}

function scopedCrowdHistory() {
  const view = state.metricsZoneView;
  if (view === "zone") {
    const z = activeMetricsZone();
    return z ? sortedZoneHistory(z) : [];
  }
  return sortedCrowdHistory();
}

function scopedEntryTimes() {
  if (state.metricsZoneView === "zone") {
    const z = activeMetricsZone();
    return z?.stats?.entryTimes || [];
  }
  return state.entryTimes;
}

function scopedDwellTimes() {
  if (state.metricsZoneView === "zone") {
    const z = activeMetricsZone();
    return z?.stats?.dwellTimes || [];
  }
  return state.dwellTimes;
}

function scopedUniqueCount() {
  if (state.metricsZoneView === "zone") {
    const z = activeMetricsZone();
    if (!z?.stats) return 0;
    return z.stats.dwellTimes.length + z.stats.trackInside.size;
  }
  return state.dwellTimes.length + state.trackLife.size;
}

function zoneById(id) {
  return state.zones.find((z) => z.id === id) || null;
}

function ensureZoneStats(zone) {
  if (zone && !zone.stats) initZoneMetrics(zone);
}

function zoneLiveCount(zone, now = performance.now()) {
  return countInZone(zone, now);
}

function zoneSummaryStats(zone, now = performance.now()) {
  ensureZoneStats(zone);
  const history = sortedZoneHistory(zone);
  const analysis = analyzeCrowd(history);
  const avg = averageCrowd(history);
  let busiest = "—";
  if (analysis) {
    const peakLabel =
      analysis.peakCount === 1 ? "1" : String(Math.round(analysis.peakCount));
    busiest = `${peakLabel} @ ${formatClock(analysis.peakTime)}`;
  }
  return {
    now: zoneLiveCount(zone, now),
    avg,
    entries: zone.stats?.entryTimes.length || 0,
    busiest,
    analysis,
    history,
  };
}

function syncZoneMetricsMenu() {
  if (!zoneMetricsMenu) return;
  const signature = [
    state.metricsSelectedZoneIds.join(","),
    state.zones.map((z) => `${z.id}:${z.name}`).join("|"),
  ].join(";");
  if (signature === zoneMenuSignature) return;
  zoneMenuSignature = signature;

  zoneMetricsMenu.replaceChildren();

  if (!state.zones.length) {
    if (zoneMetricsHint) {
      zoneMetricsHint.hidden = false;
      zoneMetricsHint.innerHTML =
        "No zones drawn. Press <strong>Next</strong> for metrics across the entire frame.";
    }
    if (zoneMetricsPrompt) zoneMetricsPrompt.hidden = true;
    return;
  }

  if (zoneMetricsHint) {
    zoneMetricsHint.hidden = false;
    zoneMetricsHint.innerHTML =
      "Tap each zone to include it. Then press <strong>Next</strong>.";
  }
  if (zoneMetricsPrompt) zoneMetricsPrompt.hidden = true;

  const selected = new Set(state.metricsSelectedZoneIds);
  for (const zone of state.zones) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "zone-pick-btn";
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(selected.has(zone.id)));
    if (selected.has(zone.id)) btn.classList.add("selected");

    const swatch = document.createElement("span");
    swatch.className = "zone-swatch";
    swatch.style.background = zoneColor(zone);

    const label = document.createElement("span");
    label.textContent = zone.name;

    const check = document.createElement("span");
    check.className = "zone-pick-check";
    check.textContent = "Included";

    btn.append(swatch, label, check);
    btn.addEventListener("click", () => toggleZoneIncluded(zone.id));
    zoneMetricsMenu.append(btn);
  }
}

function sortedZoneHistory(zone) {
  if (!zone?.stats) return [];
  return [...zone.stats.history].sort((a, b) => a.t - b.t);
}

function zonePersonSeconds(zone) {
  const history = sortedZoneHistory(zone);
  if (history.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < history.length; i += 1) {
    const dt = history[i].t - history[i - 1].t;
    if (dt <= 0 || dt > 4) continue;
    sum += ((history[i].count + history[i - 1].count) / 2) * dt;
  }
  return sum;
}

function zonePopulationMetrics(zone) {
  ensureZoneStats(zone);
  const history = sortedZoneHistory(zone);
  const avg = averageCrowd(history) || 0;
  const peak = history.length ? Math.max(...history.map((p) => p.count)) : 0;
  const personSeconds = zonePersonSeconds(zone);
  return {
    avg,
    peak,
    personSeconds,
    entries: zone.stats.entryTimes.length,
  };
}

function rankZonesByPopulation(zones) {
  return zones
    .map((zone) => ({ zone, ...zonePopulationMetrics(zone) }))
    .sort((a, b) => b.personSeconds - a.personSeconds || b.avg - a.avg || b.peak - a.peak);
}

function describeFramePosition(nx, ny) {
  const h = nx < 0.33 ? "Left" : nx > 0.66 ? "Right" : "Center";
  const v = ny < 0.33 ? "top" : ny > 0.66 ? "bottom" : "middle";
  return `${h} ${v}`;
}

function heatmapTrackingDurationSec() {
  return Math.max(0.5, sessionSeconds() - metricsWarmupSeconds());
}

function buildAveragedHeatGrid() {
  const duration = heatmapTrackingDurationSec();
  const grid = new Float32Array(HEAT_W * HEAT_H);
  let peak = 0;
  for (let i = 0; i < state.heatGrid.length; i += 1) {
    const v = state.heatGrid[i] / duration;
    grid[i] = v;
    if (v > peak) peak = v;
  }
  return { grid, peak, duration };
}

function heatmapHotspotFromGrid(grid) {
  let peak = 0;
  let hx = 0;
  let hy = 0;
  for (let y = 0; y < HEAT_H; y += 1) {
    for (let x = 0; x < HEAT_W; x += 1) {
      const v = grid[y * HEAT_W + x];
      if (v > peak) {
        peak = v;
        hx = x;
        hy = y;
      }
    }
  }
  if (peak <= 0) return null;
  const cx = (hx + 0.5) / HEAT_W;
  const cy = (hy + 0.5) / HEAT_H;
  return { peak, cx, cy, label: describeFramePosition(cx, cy) };
}

function heatmapHotspot() {
  const { grid, peak } = buildAveragedHeatGrid();
  if (peak <= 0) return null;
  return heatmapHotspotFromGrid(grid);
}

function zonesForPopulationReport() {
  if (state.metricsZoneView === "frame") return [];
  if (state.metricsScopeStep === "main" && state.metricsSelectedZoneIds.length) {
    return getSelectedZones();
  }
  return state.zones;
}

function zonesForMetricsZonesTab() {
  if (!state.zones.length) return [];
  if (state.metricsZoneView === "frame") return state.zones;
  if (state.metricsScopeStep === "main" && state.metricsSelectedZoneIds.length) {
    return getSelectedZones();
  }
  return state.zones;
}

function formatBusiestAreaSummary(leader, hotspot) {
  if (leader && leader.personSeconds > 0.5) {
    const avg =
      leader.avg > 0 ? ` · ~${leader.avg.toFixed(1)} avg` : "";
    return `${leader.zone.name}${avg}`;
  }
  if (hotspot) {
    return `${hotspot.label} of frame (foot traffic)`;
  }
  return null;
}

function refreshPopulationInsights() {
  const ranked = rankZonesByPopulation(zonesForPopulationReport());
  const leader = ranked[0];
  const hotspot = heatmapHotspot();
  const summary = formatBusiestAreaSummary(leader, hotspot);

  if (metricsBusiestArea) metricsBusiestArea.textContent = summary || "—";
  if (trafficBusiestArea) {
    if (leader && leader.personSeconds > 0.5) {
      trafficBusiestArea.textContent = `${leader.zone.name} — most time with people inside (${leader.personSeconds.toFixed(0)} person·s)`;
    } else if (hotspot) {
      trafficBusiestArea.textContent = `${hotspot.label} of frame — strongest foot-traffic cell`;
    } else {
      trafficBusiestArea.textContent = "—";
    }
  }

  if (trafficZoneRank) {
    trafficZoneRank.replaceChildren();
    const maxPs = ranked[0]?.personSeconds || 1;
    ranked.forEach((row, index) => {
      const li = document.createElement("li");
      li.className = "zone-rank-item";
      if (index === 0 && row.personSeconds > 0) li.classList.add("leader");

      const rank = document.createElement("span");
      rank.className = "zone-rank-meta";
      rank.textContent = `#${index + 1}`;

      const body = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = row.zone.name;
      const barWrap = document.createElement("div");
      barWrap.className = "zone-rank-bar-wrap";
      const bar = document.createElement("span");
      bar.className = "zone-rank-bar";
      bar.style.width = `${Math.max(4, (row.personSeconds / maxPs) * 100)}%`;
      bar.style.background = zoneColor(row.zone);
      barWrap.append(bar);
      body.append(title, barWrap);

      const meta = document.createElement("span");
      meta.className = "zone-rank-meta";
      meta.textContent =
        row.personSeconds > 0
          ? `${row.personSeconds.toFixed(0)}p·s`
          : row.avg > 0
            ? `~${row.avg.toFixed(1)} avg`
            : "—";

      li.append(rank, body, meta);
      trafficZoneRank.append(li);
    });
  }
}

function drawBucketChart(canvas, ctx, entryTimes, barColor) {
  fitCanvas(canvas, ctx);
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  if (!entryTimes.length) return;

  const bucketMap = new Map();
  for (const t of entryTimes) {
    const key = Math.floor(t / ENTRY_BUCKET_SEC) * ENTRY_BUCKET_SEC;
    bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
  }
  const keys = [...bucketMap.keys()].sort((a, b) => a - b);
  const values = keys.map((k) => bucketMap.get(k));
  const maxVal = Math.max(1, ...values);
  const pad = { l: 28, r: 6, t: 8, b: 18 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const barW = plotW / keys.length;

  keys.forEach((key, i) => {
    const val = values[i];
    const bh = (val / maxVal) * plotH;
    const x = pad.l + i * barW + barW * 0.12;
    const w = barW * 0.76;
    ctx.fillStyle = barColor;
    ctx.fillRect(x, pad.t + plotH - bh, w, bh);
  });

  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.font = `${Math.max(9, width * 0.03)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  keys.forEach((key, i) => {
    if (keys.length > 6 && i % 2 === 1) return;
    const x = pad.l + i * barW + barW / 2;
    ctx.fillText(formatAxisTime(key), x, height - 3);
  });
}

function drawDwellBucketChart(canvas, ctx, dwellTimes, barColor) {
  fitCanvas(canvas, ctx);
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const counts = DWELL_BINS.map(() => 0);
  for (const dwell of dwellTimes) {
    for (let i = 0; i < DWELL_BINS.length; i += 1) {
      const low = i === 0 ? 0 : DWELL_BINS[i - 1].max;
      const high = DWELL_BINS[i].max;
      if (high === Infinity) {
        if (dwell >= low) counts[i] += 1;
        break;
      }
      if (dwell >= low && dwell < high) {
        counts[i] += 1;
        break;
      }
    }
  }
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return;

  const maxVal = Math.max(1, ...counts);
  const pad = { l: 6, r: 6, t: 8, b: 22 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const barW = plotW / counts.length;

  counts.forEach((val, i) => {
    const bh = (val / maxVal) * plotH;
    const x = pad.l + i * barW + barW * 0.15;
    const w = barW * 0.7;
    ctx.fillStyle = barColor;
    ctx.fillRect(x, pad.t + plotH - bh, w, bh);
  });

  ctx.fillStyle = "rgba(163, 158, 145, 0.85)";
  ctx.font = `${Math.max(8, width * 0.028)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  DWELL_BINS.forEach((bin, i) => {
    const x = pad.l + i * barW + barW / 2;
    ctx.fillText(bin.label, x, height - 4);
  });
}

function syncMetricsPickStep() {
  syncZoneMetricsMenu();
  if (zoneMetricsPrompt) zoneMetricsPrompt.hidden = true;
  updateZoneMetricsNextButton();
}

function drawOverviewChart() {
  const view = state.metricsZoneView;
  resizeChartCanvas(metricsChart, metricsChartWrap);
  if (view === "multi") {
    const seriesList = getSelectedZones().map((zone) => ({
      history: sortedZoneHistory(zone),
      color: zoneColor(zone),
      label: zone.name,
    }));
    drawMultiCountTimeChart(metricsChart, metricsCtx, seriesList);
    return;
  }
  const history = scopedCrowdHistory();
  const analysis = analyzeCrowd(history);
  const color =
    view === "zone" && activeMetricsZone() ? zoneColor(activeMetricsZone()) : "#d6ee6a";
  if (history.length >= 2) {
    drawCountTimeChart(metricsChart, metricsCtx, history, analysis, color);
  } else {
    metricsCtx.clearRect(0, 0, metricsChart.width, metricsChart.height);
  }
}

function refreshMetrics() {
  if (state.metricsScopeStep === "pick") {
    syncMetricsPickStep();
    return;
  }

  const history = scopedCrowdHistory();
  const analysis = analyzeCrowd(history);

  if (analysis) {
    const peakLabel =
      analysis.peakCount === 1 ? "1 person" : `${Math.round(analysis.peakCount)} people`;
    metricsBusiest.textContent = `${peakLabel} at ${formatClock(analysis.peakTime)}`;
    const scope = zoneMetricsSelectionTitle();
    metricsSummary.textContent = `Live counts for “${scope}”.`;
  } else {
    metricsSummary.textContent = "Counting… keep the video running.";
    metricsBusiest.textContent = "—";
  }

  const avg = averageCrowd(history);
  if (statUnique) {
    const n = scopedUniqueCount();
    statUnique.textContent = n > 0 ? String(n) : "—";
  }
  if (statAvg) statAvg.textContent = avg != null ? avg.toFixed(1) : "—";
  drawOverviewChart();
  drawEntryChart();
  drawDwellChart();
  drawZonesCompareChart();
  drawHeatChart();
  updateChartEmptyStates();
  refreshPopulationInsights();
  refreshZonesMetricsPanel();
}

function fitCanvas(canvas, ctx, cssHeight = 92) {
  const wrap = canvas.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(wrap.clientWidth * dpr));
  const height = Math.max(1, Math.round(cssHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width: canvas.width, height: canvas.height, dpr };
}

function drawEntryChart() {
  fitCanvas(metricsEntries, metricsEntryCtx);
  const { width, height } = metricsEntries;
  metricsEntryCtx.clearRect(0, 0, width, height);
  const entryTimes = scopedEntryTimes();
  if (!entryTimes.length) return;

  const bucketMap = new Map();
  for (const t of entryTimes) {
    const key = Math.floor(t / ENTRY_BUCKET_SEC) * ENTRY_BUCKET_SEC;
    bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
  }
  const keys = [...bucketMap.keys()].sort((a, b) => a - b);
  const values = keys.map((k) => bucketMap.get(k));
  const maxVal = Math.max(1, ...values);
  const pad = { l: 28, r: 6, t: 16, b: 18 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const barW = plotW / keys.length;
  const countFont = `${Math.max(9, width * 0.032)}px ui-sans-serif, system-ui, sans-serif`;

  keys.forEach((key, i) => {
    const val = values[i];
    const bh = (val / maxVal) * plotH;
    const x = pad.l + i * barW + barW * 0.12;
    const w = barW * 0.76;
    metricsEntryCtx.fillStyle = "rgba(214, 238, 106, 0.85)";
    metricsEntryCtx.fillRect(x, pad.t + plotH - bh, w, bh);
    const cx = pad.l + i * barW + barW / 2;
    metricsEntryCtx.font = countFont;
    metricsEntryCtx.fillStyle = "rgba(244, 241, 232, 0.95)";
    metricsEntryCtx.textAlign = "center";
    metricsEntryCtx.textBaseline = "bottom";
    metricsEntryCtx.fillText(String(val), cx, pad.t + plotH - bh - 2);
  });

  metricsEntryCtx.fillStyle = "rgba(163, 158, 145, 0.9)";
  metricsEntryCtx.font = `${Math.max(9, width * 0.03)}px ui-sans-serif, system-ui, sans-serif`;
  metricsEntryCtx.textAlign = "center";
  metricsEntryCtx.textBaseline = "alphabetic";
  keys.forEach((key, i) => {
    if (keys.length > 6 && i % 2 === 1) return;
    const x = pad.l + i * barW + barW / 2;
    metricsEntryCtx.fillText(formatAxisTime(key), x, height - 3);
  });
}

function drawDwellChart() {
  fitCanvas(metricsDwell, metricsDwellCtx);
  const { width, height } = metricsDwell;
  metricsDwellCtx.clearRect(0, 0, width, height);

  const counts = DWELL_BINS.map(() => 0);
  for (const dwell of scopedDwellTimes()) {
    for (let i = 0; i < DWELL_BINS.length; i += 1) {
      const low = i === 0 ? 0 : DWELL_BINS[i - 1].max;
      const high = DWELL_BINS[i].max;
      if (high === Infinity) {
        if (dwell >= low) counts[i] += 1;
        break;
      }
      if (dwell >= low && dwell < high) {
        counts[i] += 1;
        break;
      }
    }
  }
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return;

  const maxVal = Math.max(1, ...counts);
  const pad = { l: 6, r: 6, t: 16, b: 22 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const barW = plotW / counts.length;
  const countFont = `${Math.max(9, width * 0.032)}px ui-sans-serif, system-ui, sans-serif`;

  counts.forEach((val, i) => {
    const bh = val > 0 ? (val / maxVal) * plotH : 0;
    const x = pad.l + i * barW + barW * 0.15;
    const w = barW * 0.7;
    const cx = pad.l + i * barW + barW / 2;
    if (val > 0) {
      metricsDwellCtx.fillStyle = "rgba(122, 215, 240, 0.85)";
      metricsDwellCtx.fillRect(x, pad.t + plotH - bh, w, bh);
    }
    metricsDwellCtx.font = countFont;
    metricsDwellCtx.fillStyle = "rgba(244, 241, 232, 0.95)";
    metricsDwellCtx.textAlign = "center";
    metricsDwellCtx.textBaseline = "bottom";
    const labelY = val > 0 ? pad.t + plotH - bh - 2 : pad.t + plotH - 2;
    metricsDwellCtx.fillText(String(val), cx, labelY);
  });

  metricsDwellCtx.fillStyle = "rgba(163, 158, 145, 0.85)";
  metricsDwellCtx.font = `${Math.max(8, width * 0.028)}px ui-sans-serif, system-ui, sans-serif`;
  metricsDwellCtx.textAlign = "center";
  metricsDwellCtx.textBaseline = "alphabetic";
  DWELL_BINS.forEach((bin, i) => {
    const x = pad.l + i * barW + barW / 2;
    metricsDwellCtx.fillText(bin.label, x, height - 4);
  });
}

function drawZonesCompareChart() {
  if (!metricsZonesChart || !metricsZonesCtx) return;
  fitCanvas(metricsZonesChart, metricsZonesCtx, 120);
  const { width, height } = metricsZonesChart;
  metricsZonesCtx.clearRect(0, 0, width, height);

  const zones = zonesForMetricsZonesTab();
  if (!zones.length) return;

  const rows = zones
    .map((zone) => ({
      zone,
      avg: averageCrowd(sortedZoneHistory(zone)) || 0,
    }))
    .sort((a, b) => b.avg - a.avg);
  const maxAvg = Math.max(...rows.map((r) => r.avg), 0.05);
  const hasData = rows.some((r) => r.avg > 0);
  if (!hasData) return;

  const pad = { l: 8, r: 36, t: 8, b: 8 };
  const rowH = (height - pad.t - pad.b) / rows.length;
  const barH = Math.max(10, rowH * 0.55);
  const labelW = Math.min(width * 0.34, 108);

  rows.forEach((row, i) => {
    const y = pad.t + i * rowH + (rowH - barH) / 2;
    const barMaxW = width - pad.l - pad.r - labelW - 8;
    const barW = (row.avg / maxAvg) * barMaxW;
    const color = zoneColor(row.zone);

    metricsZonesCtx.font = `${Math.max(9, rowH * 0.38)}px ui-sans-serif, system-ui, sans-serif`;
    metricsZonesCtx.fillStyle = "rgba(244, 241, 232, 0.88)";
    metricsZonesCtx.textAlign = "left";
    metricsZonesCtx.textBaseline = "middle";
    const name =
      row.zone.name.length > 14 ? `${row.zone.name.slice(0, 13)}…` : row.zone.name;
    metricsZonesCtx.fillText(name, pad.l, y + barH / 2);

    const bx = pad.l + labelW;
    metricsZonesCtx.fillStyle = rgbaFromHex(color, 0.88);
    metricsZonesCtx.fillRect(bx, y, Math.max(2, barW), barH);

    metricsZonesCtx.fillStyle = "rgba(244, 241, 232, 0.92)";
    metricsZonesCtx.textAlign = "left";
    metricsZonesCtx.fillText(row.avg.toFixed(1), bx + barW + 6, y + barH / 2);
  });
}

function refreshZonesMetricsPanel() {
  const zones = zonesForMetricsZonesTab();
  if (statZoneCount) {
    statZoneCount.textContent = zones.length ? String(zones.length) : "—";
  }
  const byAvg = zones
    .map((zone) => ({ zone, avg: averageCrowd(sortedZoneHistory(zone)) || 0 }))
    .sort((a, b) => b.avg - a.avg);
  const leader = byAvg[0];
  if (statZoneLeader) {
    statZoneLeader.textContent =
      leader && leader.avg > 0 ? `${leader.zone.name} (${leader.avg.toFixed(1)})` : "—";
  }

  if (!zonesMetricsList) return;
  zonesMetricsList.replaceChildren();
  if (!zones.length) return;

  const now = performance.now();
  for (const zone of zones) {
    const summary = zoneSummaryStats(zone, now);
    const li = document.createElement("li");
    li.className = "zone-rank-item zone-metrics-item";

    const swatch = document.createElement("span");
    swatch.className = "zone-swatch";
    swatch.style.background = zoneColor(zone);

    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = zone.name;
    const meta = document.createElement("span");
    meta.className = "zone-metrics-meta";
    const avgText = summary.avg != null ? summary.avg.toFixed(1) : "—";
    meta.textContent = `Now ${summary.now} · Avg ${avgText} · ${summary.entries} entries · Peak ${summary.busiest}`;

    body.append(title, meta);
    li.append(swatch, body);
    zonesMetricsList.append(li);
  }
}

function drawHeatChart() {
  fitCanvas(metricsHeat, metricsHeatCtx, 120);
  const { width, height } = metricsHeat;
  metricsHeatCtx.clearRect(0, 0, width, height);

  const { grid, peak } = buildAveragedHeatGrid();
  if (peak <= 0) return;

  const pad = 6;
  const cellW = (width - pad * 2) / HEAT_W;
  const cellH = (height - pad * 2) / HEAT_H;

  const hot = heatmapHotspotFromGrid(grid);
  let hotX = 0;
  let hotY = 0;
  if (hot) {
    hotX = Math.floor(hot.cx * HEAT_W - 0.5);
    hotY = Math.floor(hot.cy * HEAT_H - 0.5);
  }
  for (let y = 0; y < HEAT_H; y += 1) {
    for (let x = 0; x < HEAT_W; x += 1) {
      const raw = grid[y * HEAT_W + x];
      const v = raw / peak;
      if (v <= 0) continue;
      metricsHeatCtx.fillStyle = `rgba(214, 238, 106, ${0.08 + v * 0.82})`;
      metricsHeatCtx.fillRect(pad + x * cellW, pad + y * cellH, cellW + 0.5, cellH + 0.5);
    }
  }

  if (hot) {
    const cx = pad + hotX * cellW + cellW / 2;
    const cy = pad + hotY * cellH + cellH / 2;
    const r = Math.max(cellW, cellH) * 0.85;
    metricsHeatCtx.strokeStyle = "#f0e07a";
    metricsHeatCtx.lineWidth = 2;
    metricsHeatCtx.beginPath();
    metricsHeatCtx.arc(cx, cy, r, 0, Math.PI * 2);
    metricsHeatCtx.stroke();
  }
}

function selectMetricView(name) {
  for (const btn of metricSubtabs) {
    const on = btn.dataset.metric === name;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", String(on));
  }
  for (const view of metricViews) {
    const on = view.dataset.metric === name;
    view.hidden = !on;
    view.classList.toggle("active", on);
  }
  refreshMetrics();
}

function selectTab(tab) {
  const source = tab === "source";
  tabSource.classList.toggle("active", source);
  tabMetrics.classList.toggle("active", !source);
  tabSource.setAttribute("aria-selected", String(source));
  tabMetrics.setAttribute("aria-selected", String(!source));
  panelSource.hidden = !source;
  panelMetrics.hidden = source;
  if (!source) {
    if (state.metricsScopeStep === "pick") {
      showMetricsPickStep();
      return;
    }
    showMetricsMainStep();
    const active = metricSubtabs.find((b) => b.classList.contains("active"));
    selectMetricView(active?.dataset.metric || "overview");
  }
}

function clearZones() {
  state.zones = [];
  state.zoneDraft = null;
  state.highlightZoneId = null;
  state.metricsZoneId = null;
  state.metricsZoneView = null;
  state.metricsSelectedZoneIds = [];
  state.metricsScopeStep = "pick";
  zoneDragPointer = null;
  zoneListSignature = "";
  zoneMenuSignature = "";
  if (zoneList) zoneList.replaceChildren();
  syncZoneControls();
  syncMetricsPickStep();
}

function zoneColor(zone) {
  return zone.color || ZONE_COLORS[(zone.id - 1) % ZONE_COLORS.length];
}

function rectToCorners(x, y, w, h) {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function ensureZoneCorners(zone) {
  if (zone.corners?.length === 4) return zone.corners;
  const x = zone.x ?? 0;
  const y = zone.y ?? 0;
  const w = zone.w ?? 0.1;
  const h = zone.h ?? 0.1;
  zone.corners = rectToCorners(x, y, w, h);
  return zone.corners;
}

function syncZoneAabb(zone) {
  const corners = ensureZoneCorners(zone);
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of corners) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  zone.x = minX;
  zone.y = minY;
  zone.w = Math.max(0.01, maxX - minX);
  zone.h = Math.max(0.01, maxY - minY);
}

function zoneCorners(zone) {
  if (zone.corners?.length === 4) return zone.corners;
  return rectToCorners(zone.x, zone.y, zone.w, zone.h);
}

function mapPoint(nx, ny, rect) {
  let x = nx;
  if (state.mirror) x = 1 - x;
  return { px: rect.x + x * rect.w, py: rect.y + ny * rect.h };
}

function pointInPolygon(nx, ny, corners) {
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const xi = corners[i].x;
    const yi = corners[i].y;
    const xj = corners[j].x;
    const yj = corners[j].y;
    const intersect = yi > ny !== yj > ny && nx < ((xj - xi) * (ny - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function zoneCentroid(corners) {
  let sx = 0;
  let sy = 0;
  for (const c of corners) {
    sx += c.x;
    sy += c.y;
  }
  return { x: sx / corners.length, y: sy / corners.length };
}

function personInZone(box, zone) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h * 0.88;
  return pointInPolygon(cx, cy, zoneCorners(zone));
}

function overlayPointFromEvent(event) {
  const rect = contentRect();
  if (!rect) return null;
  const bounds = overlay.getBoundingClientRect();
  const px = ((event.clientX - bounds.left) / bounds.width) * overlay.width;
  const py = ((event.clientY - bounds.top) / bounds.height) * overlay.height;
  if (px < rect.x || py < rect.y || px > rect.x + rect.w || py > rect.y + rect.h) return null;
  let nx = (px - rect.x) / rect.w;
  const ny = (py - rect.y) / rect.h;
  if (state.mirror) nx = 1 - nx;
  return { nx, ny, px, py, rect };
}

function cornerHandleHit(event) {
  if (state.zoneMode || state.highlightZoneId == null || !state.running) return null;
  const zone = zoneById(state.highlightZoneId);
  if (!zone) return null;
  const hit = overlayPointFromEvent(event);
  if (!hit) return null;
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  const hitR = 13 * dpr;
  const corners = ensureZoneCorners(zone);
  for (let i = 0; i < corners.length; i += 1) {
    const { px, py } = mapPoint(corners[i].x, corners[i].y, hit.rect);
    if (Math.hypot(hit.px - px, hit.py - py) <= hitR) {
      return { zone, cornerIndex: i };
    }
  }
  return null;
}

function boxAtTime(track, now) {
  const t = { ...track };
  return follow(t, now);
}

function countInZone(zone, now) {
  let n = 0;
  for (const [, track] of state.tracks) {
    if (personInZone(boxAtTime(track, now), zone)) n += 1;
  }
  return n;
}

function zonesContainingBox(box) {
  if (!state.zones.length) return [];
  return state.zones.filter((zone) => personInZone(box, zone));
}

function primaryZoneForBox(box) {
  const hits = zonesContainingBox(box);
  if (!hits.length) return null;
  if (state.highlightZoneId != null) {
    const highlighted = hits.find((z) => z.id === state.highlightZoneId);
    if (highlighted) return highlighted;
  }
  return hits[0];
}

function rgbaFromHex(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function syncZoneControls() {
  if (!zoneModeBtn || !zoneClearBtn) return;
  zoneModeBtn.classList.toggle("active", state.zoneMode);
  zoneModeBtn.textContent = state.zoneMode ? "Drawing zone…" : "Draw zone";
  zoneClearBtn.disabled = state.zones.length === 0;
  stage.classList.toggle("zone-mode", state.zoneMode);
  if (zoneHint) {
    zoneHint.hidden = state.zoneMode;
  }
}

function setZoneMode(on) {
  state.zoneMode = on;
  if (!on) {
    state.zoneDraft = null;
    zoneDragPointer = null;
  }
  syncZoneControls();
}

function toggleZoneMode() {
  if (!state.running) return;
  if (state.zoneMode) setZoneMode(false);
  else {
    if (state.zones.length >= MAX_ZONES) {
      showSourceError(`Maximum ${MAX_ZONES} zones. Remove one to add another.`);
      return;
    }
    showSourceError("");
    setZoneMode(true);
  }
}

function removeZone(id) {
  state.zones = state.zones.filter((z) => z.id !== id);
  state.metricsSelectedZoneIds = state.metricsSelectedZoneIds.filter((zid) => zid !== id);
  if (state.highlightZoneId === id) state.highlightZoneId = null;
  if (state.metricsZoneId === id) state.metricsZoneId = null;
  if (state.metricsSelectedZoneIds.length === 0) {
    if (state.zones.length === 0) {
      state.metricsZoneView = "frame";
      if (state.metricsScopeStep === "main") refreshMetrics();
    } else {
      state.metricsZoneView = null;
      if (state.metricsScopeStep === "main") backToMetricsPick();
    }
  } else if (state.metricsSelectedZoneIds.length === 1) {
    applyMetricsZoneSelection();
  } else {
    state.metricsZoneView = "multi";
  }
  zoneListSignature = "";
  zoneMenuSignature = "";
  updateZoneListUi(performance.now());
  syncZoneControls();
  if (!panelMetrics.hidden) {
    if (state.metricsScopeStep === "main") refreshMetrics();
    else syncMetricsPickStep();
  }
}

function addZoneFromDraft(draft) {
  if (!draft || draft.w < 0.015 || draft.h < 0.015) return;
  if (state.zones.length >= MAX_ZONES) {
    showSourceError(`Maximum ${MAX_ZONES} zones.`);
    setZoneMode(false);
    return;
  }
  const placed = placeBox(draft.x, draft.y, draft.w, draft.h);
  const id = state.zoneNextId++;
  const zone = {
    id,
    ...placed,
    corners: rectToCorners(placed.x, placed.y, placed.w, placed.h),
    name: `Zone ${state.zones.length + 1}`,
    color: ZONE_COLORS[(id - 1) % ZONE_COLORS.length],
  };
  initZoneMetrics(zone);
  state.zones.push(zone);
  state.highlightZoneId = id;
  state.metricsZoneId = id;
  zoneMenuSignature = "";
  updateZoneListUi(performance.now());
  syncZoneControls();
  setZoneMode(false);
}

function beginZoneRename(zone, titleEl, now) {
  if (zoneRenameEditingId != null) return;
  zoneRenameEditingId = zone.id;
  const input = document.createElement("input");
  input.className = "zone-rename-input";
  input.type = "text";
  input.value = zone.name;
  input.maxLength = 40;
  input.setAttribute("aria-label", "Zone name");
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  const finish = (save) => {
    if (save) {
      const next = input.value.trim();
      if (next) zone.name = next;
    }
    zoneRenameEditingId = null;
    zoneListSignature = "";
    zoneMenuSignature = "";
    updateZoneListUi(now);
    if (!panelMetrics.hidden) {
      if (state.metricsScopeStep === "main") refreshMetrics();
      else syncMetricsPickStep();
    }
  };

  input.addEventListener("click", (e) => e.stopPropagation());
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
}

function updateZoneListUi(now) {
  if (!zoneList || zoneRenameEditingId != null) return;
  const signature = state.zones
    .map((z) => `${z.id}:${z.name}:${countInZone(z, now)}:${z.id === state.highlightZoneId}`)
    .join("|");
  if (signature === zoneListSignature) return;
  zoneListSignature = signature;

  zoneList.replaceChildren();
  for (const zone of state.zones) {
    const count = countInZone(zone, now);
    const li = document.createElement("li");
    li.className = "zone-item";
    if (zone.id === state.highlightZoneId) li.classList.add("active");

    const swatch = document.createElement("span");
    swatch.className = "zone-swatch";
    swatch.style.background = zoneColor(zone);

    const main = document.createElement("div");
    main.className = "zone-item-main";
    const title = document.createElement("strong");
    title.textContent = zone.name;
    title.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      beginZoneRename(zone, title, now);
    });
    const sub = document.createElement("span");
    sub.textContent = count === 1 ? "1 person inside" : `${count} people inside`;
    main.append(title, sub);

    const actions = document.createElement("div");
    actions.className = "zone-item-actions";

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.textContent = "Rename";
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      beginZoneRename(zone, title, now);
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeZone(zone.id);
    });

    actions.append(renameBtn, removeBtn);

    li.addEventListener("click", () => {
      state.highlightZoneId = zone.id;
      state.metricsZoneId = zone.id;
      zoneListSignature = "";
      updateZoneListUi(now);
      if (!panelMetrics.hidden && state.metricsScopeStep === "main") {
        setMetricsZoneId(zone.id);
      }
    });

    li.append(swatch, main, actions);
    zoneList.append(li);
  }
}

function drawOverlayBadge(rect, x, y, text, { accent = "#f0e07a" } = {}) {
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  ctx.save();
  ctx.font = `600 ${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  const padX = 8 * dpr;
  const labelH = 20 * dpr;
  const labelW = ctx.measureText(text).width + padX * 2;
  const lx = clamp(x, rect.x + 4 * dpr, rect.x + rect.w - labelW - 4 * dpr);
  const ly = clamp(y, rect.y + 4 * dpr, rect.y + rect.h - labelH - 4 * dpr);
  ctx.fillStyle = "rgba(7, 8, 7, 0.88)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(lx, ly, labelW, labelH, 5 * dpr);
  else ctx.rect(lx, ly, labelW, labelH);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5 * dpr;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.textBaseline = "middle";
  ctx.fillText(text, lx + padX, ly + labelH / 2);
  ctx.restore();
}

function contentMapXLocal(nx, nw, width) {
  if (!state.mirror) return nx * width;
  return width - (nx + nw) * width;
}

function drawVideoTrafficHeatmap(rect) {
  const { grid, peak } = buildAveragedHeatGrid();
  if (peak <= 0) return;

  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  const sw = Math.max(1, Math.ceil(rect.w));
  const sh = Math.max(1, Math.ceil(rect.h));
  if (heatVideoScratch.width !== sw || heatVideoScratch.height !== sh) {
    heatVideoScratch.width = sw;
    heatVideoScratch.height = sh;
  }
  heatVideoScratchCtx.clearRect(0, 0, sw, sh);

  const cellW = sw / HEAT_W;
  const cellH = sh / HEAT_H;
  const spread = Math.max(cellW, cellH) * 1.45;

  for (let y = 0; y < HEAT_H; y += 1) {
    for (let x = 0; x < HEAT_W; x += 1) {
      const rate = grid[y * HEAT_W + x];
      if (rate <= 0) continue;
      const v = rate / peak;
      if (v <= 0.025) continue;

      const nx = x / HEAT_W;
      const ny = y / HEAT_H;
      const nw = 1 / HEAT_W;
      const px = contentMapXLocal(nx, nw, sw);
      const py = ny * sh;
      const cx = px + (nw * sw) / 2;
      const cy = py + cellH / 2;

      const grad = heatVideoScratchCtx.createRadialGradient(cx, cy, 0, cx, cy, spread);
      grad.addColorStop(0, `rgba(214, 238, 106, ${0.12 + v * 0.62})`);
      grad.addColorStop(0.55, `rgba(214, 238, 106, ${0.04 + v * 0.28})`);
      grad.addColorStop(1, "rgba(214, 238, 106, 0)");
      heatVideoScratchCtx.fillStyle = grad;
      heatVideoScratchCtx.beginPath();
      heatVideoScratchCtx.arc(cx, cy, spread, 0, Math.PI * 2);
      heatVideoScratchCtx.fill();
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = `blur(${7 * dpr}px)`;
  ctx.drawImage(heatVideoScratch, rect.x, rect.y, rect.w, rect.h);
  ctx.filter = "none";
  ctx.globalAlpha = 0.88;
  ctx.drawImage(heatVideoScratch, rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawZoneShape(rect, zone, { draft = false, highlight = false, count = null } = {}) {
  const corners = zoneCorners(zone);
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  const color = zoneColor(zone);
  ctx.save();
  ctx.beginPath();
  corners.forEach((c, i) => {
    const { px, py } = mapPoint(c.x, c.y, rect);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = draft ? "rgba(240, 224, 122, 0.12)" : rgbaFromHex(color, 0.16);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = (highlight || draft ? 3 : 2) * dpr;
  ctx.setLineDash(draft ? [6 * dpr, 4 * dpr] : []);
  ctx.stroke();
  ctx.setLineDash([]);

  const label =
    count == null
      ? draft
        ? "Release to set zone"
        : zone.name
      : `${zone.name} · ${count}`;
  ctx.font = `600 ${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  const padX = 6 * dpr;
  const labelH = 18 * dpr;
  const labelW = ctx.measureText(label).width + padX * 2;
  const anchor = zoneCentroid(corners);
  const { px: ax, py: ay } = mapPoint(anchor.x, anchor.y, rect);
  const lx = clamp(ax - labelW / 2, rect.x + 4 * dpr, rect.x + rect.w - labelW - 4 * dpr);
  const ly = clamp(ay - labelH / 2, rect.y + 4 * dpr, rect.y + rect.h - labelH - 4 * dpr);
  ctx.fillStyle = "rgba(7, 8, 7, 0.78)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(lx, ly, labelW, labelH, 4 * dpr);
  else ctx.rect(lx, ly, labelW, labelH);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(label, lx + padX, ly + labelH / 2);
  ctx.restore();
}

function drawZoneCornerHandles(rect, zone) {
  if (state.zoneMode || zone.id !== state.highlightZoneId) return;
  const corners = ensureZoneCorners(zone);
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  const r = 7 * dpr;
  const color = zoneColor(zone);
  ctx.save();
  for (const c of corners) {
    const { px, py } = mapPoint(c.x, c.y, rect);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = "#17190f";
    ctx.stroke();
  }
  ctx.restore();
}

function stopSource() {
  state.running = false;
  if (state.stream) {
    for (const track of state.stream.getTracks()) track.stop();
    state.stream = null;
  }
  video.pause();
  video.srcObject = null;
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
  video.removeAttribute("src");
  setZoneMode(false);
  clearZones();
  setPlaybackUi(false);
  resetOverlay();
}

function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.binaryType = "arraybuffer";
  state.ws = ws;

  ws.onopen = () => {
    sendConfig();
  };

  ws.onclose = () => {
    if (state.ws === ws) state.busy = false;
    setTimeout(() => {
      if (state.ws === ws) connect();
    }, 800);
  };

  ws.onmessage = (event) => {
    if (state.ws !== ws) return;
    state.busy = false;
    const data = JSON.parse(event.data);
    if (data.type !== "tracks") return;
    state.raw = data.raw || [];
    state.detectMs = data.ms;
    const now = performance.now();
    state.packetMarks.push(now);
    state.packetMarks = state.packetMarks.filter((mark) => now - mark < 1000);
    ingestTracks(data.tracks || [], now);
    recordCrowd((data.tracks || []).length);
    recordZoneMetrics(data.tracks || []);
    recordHeatmap(data.tracks || []);
    recordPerformance(data.ms);
    if (!panelMetrics.hidden) {
      refreshMetrics();
    }
  };
}

function placeBox(x, y, w, h) {
  w = clamp(w, 0.01, 1);
  h = clamp(h, 0.01, 1);
  return { x: clamp(x, 0, 1 - w), y: clamp(y, 0, 1 - h), w, h };
}

function ingestTracks(tracks, now) {
  const dt = state.lastPacket ? Math.max(0.016, (now - state.lastPacket) / 1000) : 0.05;
  state.lastPacket = now;
  const seen = new Set();

  for (const track of tracks) {
    seen.add(track.id);
    const current = state.tracks.get(track.id);
    if (!current) {
      const placed = placeBox(track.x, track.y, track.w, track.h);
      state.trails.set(track.id, [
        { x: placed.x + placed.w / 2, y: placed.y + placed.h / 2 },
      ]);
      state.tracks.set(track.id, {
        score: track.score,
        held: track.held,
        x: placed.x,
        y: placed.y,
        w: placed.w,
        h: placed.h,
        tx: placed.x,
        ty: placed.y,
        tw: placed.w,
        th: placed.h,
        mx: track.x,
        my: track.y,
        vx: 0,
        vy: 0,
        renderedAt: now,
      });
      noteTrackLife(track.id, true);
      continue;
    }

    noteTrackLife(track.id, false);

    const vx = (track.x - current.mx) / dt;
    const vy = (track.y - current.my) / dt;
    current.vx = current.vx * 0.35 + vx * 0.65;
    current.vy = current.vy * 0.35 + vy * 0.65;
    current.mx = track.x;
    current.my = track.y;

    // Aim about one detection late, so the box is not still traveling toward a stale position.
    const lead = Math.min(dt, 0.09);
    const maxX = Math.max(0.012, track.w * 0.3);
    const maxY = Math.max(0.012, track.h * 0.3);
    const aimed = placeBox(
      track.x + clamp(current.vx * lead, -maxX, maxX),
      track.y + clamp(current.vy * lead, -maxY, maxY),
      track.w,
      track.h
    );
    current.tx = aimed.x;
    current.ty = aimed.y;
    current.tw = aimed.w;
    current.th = aimed.h;
    current.score = track.score;
    current.held = track.held;
  }

  for (const id of [...state.tracks.keys()]) {
    if (!seen.has(id)) {
      if (state.selectedId === id) {
        const history = state.trails.get(id);
        if (history?.length) {
          state.finishedTrail = { id, points: [...history] };
        }
      }
      closeTrackLife(id);
      closeZoneTrackForAllZones(id);
      state.tracks.delete(id);
      state.trails.delete(id);
    }
  }
  updateFollowPopupChrome();
}

function follow(track, now) {
  const dt = Math.min(0.05, Math.max(0, (now - track.renderedAt) / 1000));
  track.renderedAt = now;
  if (dt <= 0) return track;
  // About 30ms to close most of the gap, instead of waiting out the whole detect interval.
  const gain = 1 - Math.exp(-dt / 0.028);
  track.x = lerp(track.x, track.tx, gain);
  track.y = lerp(track.y, track.ty, gain);
  track.w = lerp(track.w, track.tw, gain);
  track.h = lerp(track.h, track.th, gain);
  return track;
}

function contentRect() {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const scale = Math.min(overlay.width / vw, overlay.height / vh);
  const w = vw * scale;
  const h = vh * scale;
  return { x: (overlay.width - w) / 2, y: (overlay.height - h) / 2, w, h };
}

function mapX(nx, nw, rect) {
  if (!state.mirror) return rect.x + nx * rect.w;
  return rect.x + rect.w - (nx + nw) * rect.w;
}

function resize() {
  const bounds = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width * dpr));
  const height = Math.max(1, Math.round(bounds.height * dpr));
  if (overlay.width !== width || overlay.height !== height) {
    overlay.width = width;
    overlay.height = height;
  }
}

function drawBox(rect, box, color, dashed, selected, { fillAlpha = 0, inZone = false } = {}) {
  const x = mapX(box.x, box.w, rect);
  const y = rect.y + box.y * rect.h;
  const w = box.w * rect.w;
  const h = box.h * rect.h;
  if (w < 2 || h < 2) return { x, y, w, h };
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 8 * dpr);
  else ctx.rect(x, y, w, h);
  if (fillAlpha > 0) {
    ctx.fillStyle = rgbaFromHex(color, fillAlpha);
    ctx.fill();
  }
  ctx.strokeStyle = color;
  let lineW = selected ? 3.5 : dashed ? 1.25 : 2;
  if (inZone && !selected) lineW = 2.75;
  ctx.lineWidth = lineW * dpr;
  ctx.setLineDash(dashed && !selected ? [5 * dpr, 5 * dpr] : []);
  ctx.stroke();
  ctx.restore();
  return { x, y, w, h };
}

function drawLabel(rect, geom, id, color) {
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  const text = `#${id}`;
  ctx.save();
  ctx.font = `600 ${12 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  const padX = 5 * dpr;
  const height = 16 * dpr;
  const width = ctx.measureText(text).width + padX * 2;
  let y = geom.y - height - 4 * dpr;
  if (y < rect.y) y = geom.y + 4 * dpr;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(geom.x, y, width, height, 4 * dpr);
  else ctx.rect(geom.x, y, width, height);
  ctx.fill();
  ctx.fillStyle = "#17190f";
  ctx.textBaseline = "middle";
  ctx.fillText(text, geom.x + padX, y + height / 2);
  ctx.restore();
}

function rememberTrail(id, box) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const history = state.trails.get(id) || [];
  const last = history[history.length - 1];
  if (!last || Math.hypot(cx - last.x, cy - last.y) > 0.0025) {
    history.push({ x: cx, y: cy });
    state.trails.set(id, history);
  }
}

function drawTrail(rect, id, history, box, color = TRACK_COLOR) {
  if (!history || history.length < 2) return;
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 2.25 * dpr;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  history.forEach((point, index) => {
    const x = mapX(point.x, 0, rect);
    const y = rect.y + point.y * rect.h;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  if (box) {
    const cx = box.x + box.w / 2;
    ctx.lineTo(mapX(cx, 0, rect), rect.y + (box.y + box.h / 2) * rect.h);
  }
  ctx.stroke();
  ctx.restore();
}

function render(now) {
  requestAnimationFrame(render);
  resize();
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  const rect = contentRect();

  if (!rect || !state.running) {
    return;
  }

  for (const zone of state.zones) {
    ensureZoneCorners(zone);
    const inZone = countInZone(zone, now);
    drawZoneShape(rect, zone, {
      highlight: zone.id === state.highlightZoneId,
      count: inZone,
    });
    drawZoneCornerHandles(rect, zone);
  }
  if (state.zoneDraft) {
    drawZoneShape(rect, state.zoneDraft, { draft: true });
  }
  if (state.showPopulatedAreaOnVideo) {
    drawVideoTrafficHeatmap(rect);
  }
  updateZoneListUi(now);

  let count = 0;
  let selected = null;
  let selectedBox = null;
  for (const [id, track] of state.tracks) {
    const box = follow(track, now);
    count += 1;
    rememberTrail(id, box);
    const isSelected = id === state.selectedId;
    const zone = primaryZoneForBox(box);
    const inZone = zone != null;
    const color = inZone ? zoneColor(zone) : TRACK_COLOR;
    const geom = drawBox(rect, box, color, Boolean(box.held), isSelected, {
      inZone,
      fillAlpha: inZone ? 0.22 : 0,
    });
    drawLabel(rect, geom, id, color);
    if (isSelected) {
      selected = box;
      selectedBox = box;
    }
  }
  if (state.selectedId != null) {
    const history =
      state.tracks.has(state.selectedId)
        ? state.trails.get(state.selectedId)
        : state.finishedTrail?.id === state.selectedId
          ? state.finishedTrail.points
          : null;
    const selectedZone = selectedBox ? primaryZoneForBox(selectedBox) : null;
    drawTrail(rect, state.selectedId, history, selectedBox, selectedZone ? zoneColor(selectedZone) : TRACK_COLOR);
  }
  drawCrop(selected);

  peopleStat.textContent = count === 1 ? "1 person" : `${count} people`;
  detectStat.textContent = state.detectMs == null ? "— ms" : `${Math.round(state.detectMs)} ms`;
  fpsStat.textContent = state.packetMarks.length ? `${state.packetMarks.length} fps` : "— fps";
}

async function pump() {
  while (true) {
    const socketOpen = state.ws && state.ws.readyState === WebSocket.OPEN;
    if (state.busy && performance.now() - state.sentAt > 4000) state.busy = false;
    if (!state.running || !socketOpen || state.busy || document.hidden || video.readyState < 2) {
      await sleep(20);
      continue;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(1, 640 / Math.max(vw, vh));
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));
    if (capture.width !== w) capture.width = w;
    if (capture.height !== h) capture.height = h;
    captureCtx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise((resolve) => capture.toBlob(resolve, "image/jpeg", 0.72));
    if (!blob || !state.running || state.ws.readyState !== WebSocket.OPEN) continue;
    state.busy = true;
    state.sentAt = performance.now();
    try {
      state.ws.send(await blob.arrayBuffer());
    } catch {
      state.busy = false;
    }
  }
}

async function useCamera() {
  showSourceError("");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    stopSource();
    state.stream = stream;
    video.srcObject = stream;
    await video.play();
    mirrorInput.checked = true;
    state.mirror = true;
    stage.classList.add("selfie");
    state.sessionStartedAt = performance.now();
  state.running = true;
  setPlaybackUi(true);
  syncZoneControls();
  } catch (error) {
    showSourceError("Camera blocked or unavailable. Try opening a video file instead.");
  }
}

async function useFile(file) {
  showSourceError("");
  stopSource();
  const url = URL.createObjectURL(file);
  state.objectUrl = url;
  video.src = url;
  video.loop = true;
  try {
    await video.play();
  } catch {
    showSourceError("That video could not be played.");
    return;
  }
  mirrorInput.checked = false;
  state.mirror = false;
  stage.classList.remove("selfie");
  state.sessionStartedAt = performance.now();
  state.running = true;
  setPlaybackUi(true);
  syncZoneControls();
}

tabSource.addEventListener("click", () => selectTab("source"));
tabMetrics.addEventListener("click", () => selectTab("metrics"));

for (const btn of metricSubtabs) {
  btn.setAttribute("role", "tab");
  btn.addEventListener("click", () => {
    if (panelMetrics.hidden) selectTab("metrics");
    selectMetricView(btn.dataset.metric);
  });
}

video.addEventListener("timeupdate", noteVideoClock);
video.addEventListener("seeked", () => {
  if (!state.running || state.stream) return;
  if (video.currentTime < 0.2 && state.crowdHistory.length > 2) {
    resetPlaybackSessionForLoop();
  }
});
video.addEventListener("ended", () => {
  if (!state.running || state.stream || !video.loop) return;
  resetPlaybackSessionForLoop();
});

cameraBtn.addEventListener("click", useCamera);
if (cameraBtnEmpty) cameraBtnEmpty.addEventListener("click", useCamera);
fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) useFile(file);
});
if (fileInputEmpty) {
  fileInputEmpty.addEventListener("change", () => {
    const file = fileInputEmpty.files && fileInputEmpty.files[0];
    if (file) useFile(file);
  });
}

if (zoneModeBtn) zoneModeBtn.addEventListener("click", toggleZoneMode);
if (zoneClearBtn) zoneClearBtn.addEventListener("click", clearZones);
if (zoneMetricsNext) zoneMetricsNext.addEventListener("click", goToMetricsMain);
if (metricsChangeScope) metricsChangeScope.addEventListener("click", backToMetricsPick);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.zoneMode) {
    state.zoneDraft = null;
    zoneDragPointer = null;
    setZoneMode(false);
  }
});

mirrorInput.addEventListener("change", () => {
  state.mirror = mirrorInput.checked;
  stage.classList.toggle("selfie", state.mirror);
});

if (showPopulatedAreaInput) {
  showPopulatedAreaInput.addEventListener("change", () => {
    state.showPopulatedAreaOnVideo = showPopulatedAreaInput.checked;
  });
}

function followSelectionActive() {
  return (
    state.selectedId != null &&
    (state.tracks.has(state.selectedId) || state.finishedTrail?.id === state.selectedId)
  );
}

function clampFollowPopupPosition() {
  if (!followPopup || followPopup.hidden) return;
  const margin = 8;
  const maxX = Math.max(margin, stage.clientWidth - followPopup.offsetWidth - margin);
  const maxY = Math.max(margin, stage.clientHeight - followPopup.offsetHeight - margin);
  if (state.followPopupX == null || state.followPopupY == null) {
    state.followPopupX = maxX;
    state.followPopupY = margin;
  }
  state.followPopupX = clamp(state.followPopupX, margin, maxX);
  state.followPopupY = clamp(state.followPopupY, margin, maxY);
  followPopup.style.left = `${state.followPopupX}px`;
  followPopup.style.top = `${state.followPopupY}px`;
}

function updateFollowPopupChrome() {
  const active = followSelectionActive();
  if (!followPopup) return;
  followPopup.hidden = !active;
  if (!active) {
    followPopupCtx.clearRect(0, 0, followPopupCanvas.width, followPopupCanvas.height);
    return;
  }
  if (followPopupLabel) followPopupLabel.textContent = `Person #${state.selectedId}`;
  requestAnimationFrame(() => {
    clampFollowPopupPosition();
    requestAnimationFrame(clampFollowPopupPosition);
  });
}

function clearPersonSelection() {
  state.selectedId = null;
  state.finishedTrail = null;
  updateFollowPopupChrome();
}

function drawCrop(box) {
  if (!box || video.readyState < 2 || !followPopup || followPopup.hidden) return;
  const bounds = followPopupCanvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width * dpr));
  const height = Math.max(1, Math.round(bounds.height * dpr));
  if (followPopupCanvas.width !== width || followPopupCanvas.height !== height) {
    followPopupCanvas.width = width;
    followPopupCanvas.height = height;
  }

  const viewAspect = width / height;
  let w = box.w * 1.44;
  let h = box.h * 1.32;
  if (w / h > viewAspect) h = w / viewAspect;
  else w = h * viewAspect;
  if (w > 1 || h > 1) {
    const scale = Math.min(1 / w, 1 / h);
    w *= scale;
    h *= scale;
  }
  const placed = {
    x: clamp(box.x + box.w / 2 - w / 2, 0, 1 - w),
    y: clamp(box.y + box.h / 2 - h / 2, 0, 1 - h),
    w,
    h,
  };
  followPopupCtx.save();
  if (state.mirror) {
    followPopupCtx.translate(width, 0);
    followPopupCtx.scale(-1, 1);
  }
  followPopupCtx.drawImage(
    video,
    placed.x * video.videoWidth,
    placed.y * video.videoHeight,
    placed.w * video.videoWidth,
    placed.h * video.videoHeight,
    0,
    0,
    width,
    height
  );
  followPopupCtx.restore();
}

function pointFromEvent(event) {
  const rect = contentRect();
  if (!rect) return null;
  const bounds = overlay.getBoundingClientRect();
  const px = ((event.clientX - bounds.left) / bounds.width) * overlay.width;
  const py = ((event.clientY - bounds.top) / bounds.height) * overlay.height;
  if (px < rect.x || py < rect.y || px > rect.x + rect.w || py > rect.y + rect.h) return null;
  let nx = (px - rect.x) / rect.w;
  const ny = (py - rect.y) / rect.h;
  if (state.mirror) nx = 1 - nx;
  return { nx, ny };
}

function trackAt(nx, ny) {
  let best = null;
  let bestArea = Infinity;
  for (const [id, track] of state.tracks) {
    if (nx < track.x || nx > track.x + track.w || ny < track.y || ny > track.y + track.h) continue;
    const area = track.w * track.h;
    if (area < bestArea) {
      best = id;
      bestArea = area;
    }
  }
  return best;
}

overlay.addEventListener("mousemove", (event) => {
  if (state.zoneMode) return;
  if (cornerHandleHit(event)) {
    overlay.style.cursor = "grab";
    return;
  }
  const point = pointFromEvent(event);
  overlay.style.cursor = point && trackAt(point.nx, point.ny) ? "pointer" : "default";
});

function zoneDraftFromAnchor(anchorX, anchorY, nx, ny) {
  const x = Math.min(anchorX, nx);
  const y = Math.min(anchorY, ny);
  const w = Math.abs(nx - anchorX);
  const h = Math.abs(ny - anchorY);
  return { x, y, w, h, anchorX, anchorY };
}

function finishZoneDrag() {
  if (zoneDragPointer == null) return;
  const draft = state.zoneDraft;
  zoneDragPointer = null;
  state.zoneDraft = null;
  if (draft) addZoneFromDraft(draft);
}

overlay.addEventListener("pointerdown", (event) => {
  if (!state.running || event.button !== 0) return;
  const corner = cornerHandleHit(event);
  if (corner) {
    event.preventDefault();
    zoneCornerDidDrag = false;
    zoneCornerDrag = {
      pointerId: event.pointerId,
      zoneId: corner.zone.id,
      cornerIndex: corner.cornerIndex,
    };
    overlay.setPointerCapture(event.pointerId);
    return;
  }
  if (!state.zoneMode) return;
  const point = pointFromEvent(event);
  if (!point) return;
  event.preventDefault();
  zoneDragPointer = event.pointerId;
  overlay.setPointerCapture(event.pointerId);
  state.zoneDraft = zoneDraftFromAnchor(point.nx, point.ny, point.nx, point.ny);
});

overlay.addEventListener("pointermove", (event) => {
  if (zoneCornerDrag?.pointerId === event.pointerId) {
    const hit = overlayPointFromEvent(event);
    if (!hit) return;
    const zone = zoneById(zoneCornerDrag.zoneId);
    if (!zone) return;
    const corners = ensureZoneCorners(zone);
    corners[zoneCornerDrag.cornerIndex] = {
      x: clamp(hit.nx, 0, 1),
      y: clamp(hit.ny, 0, 1),
    };
    syncZoneAabb(zone);
    zoneListSignature = "";
    zoneCornerDidDrag = true;
    return;
  }
  if (zoneDragPointer !== event.pointerId || !state.zoneDraft) return;
  const point = pointFromEvent(event);
  if (!point) return;
  state.zoneDraft = zoneDraftFromAnchor(
    state.zoneDraft.anchorX,
    state.zoneDraft.anchorY,
    point.nx,
    point.ny
  );
});

overlay.addEventListener("pointerup", (event) => {
  if (zoneCornerDrag?.pointerId === event.pointerId) {
    if (overlay.hasPointerCapture(event.pointerId)) {
      overlay.releasePointerCapture(event.pointerId);
    }
    zoneCornerDrag = null;
    zoneMenuSignature = "";
    return;
  }
  if (zoneDragPointer !== event.pointerId) return;
  if (overlay.hasPointerCapture(event.pointerId)) {
    overlay.releasePointerCapture(event.pointerId);
  }
  finishZoneDrag();
});

overlay.addEventListener("pointercancel", (event) => {
  if (zoneCornerDrag?.pointerId === event.pointerId) {
    zoneCornerDrag = null;
    return;
  }
  if (zoneDragPointer !== event.pointerId) return;
  zoneDragPointer = null;
  state.zoneDraft = null;
});

overlay.addEventListener("click", (event) => {
  if (state.zoneMode) return;
  if (zoneCornerDidDrag) {
    zoneCornerDidDrag = false;
    return;
  }
  const point = pointFromEvent(event);
  if (!point) return;
  const hit = trackAt(point.nx, point.ny);
  if (hit == null || hit === state.selectedId) {
    clearPersonSelection();
  } else {
    state.finishedTrail = null;
    state.selectedId = hit;
    updateFollowPopupChrome();
  }
});

if (followPopupHead) {
  followPopupHead.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target === followPopupClose) return;
    event.preventDefault();
    event.stopPropagation();
    clampFollowPopupPosition();
    followPopupDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origX: state.followPopupX,
      origY: state.followPopupY,
    };
    followPopupHead.setPointerCapture(event.pointerId);
  });
}

if (followPopupHead) {
  followPopupHead.addEventListener("pointermove", (event) => {
    if (!followPopupDrag || followPopupDrag.pointerId !== event.pointerId) return;
    state.followPopupX = followPopupDrag.origX + (event.clientX - followPopupDrag.startX);
    state.followPopupY = followPopupDrag.origY + (event.clientY - followPopupDrag.startY);
    clampFollowPopupPosition();
  });

  const endFollowPopupDrag = (event) => {
    if (!followPopupDrag || followPopupDrag.pointerId !== event.pointerId) return;
    if (followPopupHead.hasPointerCapture(event.pointerId)) {
      followPopupHead.releasePointerCapture(event.pointerId);
    }
    followPopupDrag = null;
  };
  followPopupHead.addEventListener("pointerup", endFollowPopupDrag);
  followPopupHead.addEventListener("pointercancel", endFollowPopupDrag);
}

if (followPopupClose) {
  followPopupClose.addEventListener("click", (event) => {
    event.stopPropagation();
    clearPersonSelection();
  });
}

new ResizeObserver(() => {
  resize();
  clampFollowPopupPosition();
}).observe(stage);
const metricsResize = () => {
  if (!panelMetrics.hidden) refreshMetrics();
};
new ResizeObserver(metricsResize).observe(metricsChartWrap);
new ResizeObserver(metricsResize).observe(panelMetrics);
connect();
syncZoneControls();
showMetricsPickStep();
updateChartEmptyStates();
requestAnimationFrame(render);
pump();
