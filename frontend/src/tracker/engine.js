import {
  archiveGaitProfile,
  createGaitState,
  exportGaitSnapshot,
  formatCadence,
  formatGaitPace,
  resetGaitState,
  tryGaitMatch,
  updateGaitProfile,
} from "./gait.js";
import {
  downsampleSeries,
  drawGroupedZoneBuckets,
  stableChartDomain,
  drawMultiStyledTimeSeries,
  drawStyledBuckets,
  drawStyledTimeSeries,
  medianOf,
} from "./metricsCharts.js";

const TRACK_COLOR = "#4ade80";
const ZONE_COLORS = ["#f0e07a", "#7ad7f0", "#c79bff", "#f07aa8", "#7af0b8", "#f0a37a"];
const MAX_ZONES = 8;

let video;
let overlay;
let stage;
let empty;
let sourceError;
let cameraBtn;
let cameraBtnEmpty;
let fileInput;
let fileInputEmpty;
let mirrorInput;
let followPopup;
let followPopupHead;
let followPopupClose;
let followPopupLabel;
let followPopupCanvas;
let followPopupCtx;
let drawBoxBtn;
let drawLineBtn;
let zoneClearBtn;
let zoneList;
let zoneHint;
let sidebarTabs;
let tabSource;
let tabMetrics;
let panelSource;
let panelMetrics;
let metricsChart;
let metricsChartWrap;
let metricsCtx;
let metricsSummary;
let metricsBusiest;
let metricsBusiestArea;
let showPopulatedAreaInput;
let menuDockBottomInput;
let metricsEntries;
let metricsDwell;
let metricsZonesChart;
let metricsHeat;
let metricsOccupancy;
let metricsPerf;
let metricsFps;
let metricsEntryCtx;
let metricsDwellCtx;
let metricsZonesCtx;
let metricsHeatCtx;
let metricsOccupancyCtx;
let metricsPerfCtx;
let metricsFpsCtx;
let metricsChartEmpty;
let metricsEntriesEmpty;
let metricsDwellEmpty;
let metricsZonesEmpty;
let zonesMetricsList;
let metricsHeatEmpty;
let statUnique;
let statAvg;
let statZoneCount;
let statZoneLeader;
let metricViews;
let metricSubtabs;
let zoneMetricsMenu;
let zoneMetricsHint;
let zoneMetricsPrompt;
let metricsPickStep;
let metricsMainStep;
let metricsMenuStep;
let metricsDetailStep;
let metricsBack;
let metricsDetailTitle;
let metricsScopeLabel;
let metricsChangeScope;
let metricsChooseZones;
let zoneMetricsNext;
let savedProfileSelect;
let mot17SampleSelect;
let useMot17SampleBtn;
let mot17SampleHint;
let casiaBSampleSelect;
let useCasiaBSampleBtn;
let casiaBSampleHint;
let activeSourceLine;
let mot17Sequences = [];
let casiaBSequences = [];
let useRecentSessionBtn;
let openSnapshotBtn;
let gaitTrackList;
let gaitSelectedSummary;
let gaitMatchList;
let ctx;

let snapshotNavigateHandler = null;

const LEGACY_SETTINGS_KEY = "peopleTracker.settings.v1";
const PROFILES_STORAGE_KEY = "peopleTracker.profiles.v1";
const VIDEO_DB_NAME = "peopleTracker.videoBlobs.v1";
const VIDEO_DB_STORE = "videos";
const MAX_RECENT_SESSIONS = 12;
const LOAD_ALL = { mirror: true, zones: true, heatmap: true, metrics: true };
let saveSettingsTimer = null;
let syncingRecentSelect = false;
let applyingRecentSession = false;
let combineMenuSignature = "";
let analysisScopeSignature = "";
const trackerUiListeners = new Set();
let metricsRenderTick = 0;
let lastMetricsChartRefreshMs = 0;
let lastMetricsSummaryRefreshMs = 0;
const METRICS_CHART_REFRESH_MS = 500;
const METRICS_SUMMARY_REFRESH_MS = 1600;

function bindDom() {
  video = document.getElementById("video");
  overlay = document.getElementById("overlay");
  stage = document.getElementById("stage");
  empty = document.getElementById("empty");
  sourceError = document.getElementById("sourceError");
  cameraBtn = document.getElementById("cameraBtn");
  cameraBtnEmpty = document.getElementById("cameraBtnEmpty");
  fileInput = document.getElementById("file");
  fileInputEmpty = document.getElementById("fileEmpty");
  mirrorInput = document.getElementById("mirror");
  followPopup = document.getElementById("followPopup");
  followPopupHead = document.getElementById("followPopupHead");
  followPopupClose = document.getElementById("followPopupClose");
  followPopupLabel = document.getElementById("followPopupLabel");
  followPopupCanvas = document.getElementById("followPopupCanvas");
  followPopupCtx = followPopupCanvas?.getContext("2d", { alpha: false });
  drawBoxBtn = document.getElementById("drawBoxBtn");
  drawLineBtn = document.getElementById("drawLineBtn");
  zoneClearBtn = document.getElementById("zoneClearBtn");
  zoneList = document.getElementById("zoneList");
  zoneHint = document.getElementById("zoneHint");
  sidebarTabs = document.getElementById("sidebarTabs");
  tabSource = document.getElementById("tabSource");
  tabMetrics = document.getElementById("tabMetrics");
  panelSource = document.getElementById("panelSource");
  panelMetrics = document.getElementById("panelMetrics");
  metricsChart = document.getElementById("metricsChart");
  metricsChartWrap = metricsChart?.parentElement;
  metricsCtx = metricsChart?.getContext("2d");
  metricsSummary = document.getElementById("metricsSummary");
  metricsBusiest = document.getElementById("metricsBusiest");
  metricsBusiestArea = document.getElementById("metricsBusiestArea");
  showPopulatedAreaInput = document.getElementById("showPopulatedArea");
  menuDockBottomInput = document.getElementById("menuDockBottom");
  metricsEntries = document.getElementById("metricsEntries");
  metricsDwell = document.getElementById("metricsDwell");
  metricsZonesChart = document.getElementById("metricsZonesChart");
  metricsHeat = document.getElementById("metricsHeat");
  metricsOccupancy = document.getElementById("metricsOccupancy");
  metricsPerf = document.getElementById("metricsPerf");
  metricsFps = document.getElementById("metricsFps");
  metricsEntryCtx = metricsEntries?.getContext("2d");
  metricsDwellCtx = metricsDwell?.getContext("2d");
  metricsZonesCtx = metricsZonesChart?.getContext("2d");
  metricsHeatCtx = metricsHeat?.getContext("2d");
  metricsOccupancyCtx = metricsOccupancy?.getContext("2d");
  metricsPerfCtx = metricsPerf?.getContext("2d");
  metricsFpsCtx = metricsFps?.getContext("2d");
  metricsChartEmpty = document.getElementById("metricsChartEmpty");
  metricsEntriesEmpty = document.getElementById("metricsEntriesEmpty");
  metricsDwellEmpty = document.getElementById("metricsDwellEmpty");
  metricsZonesEmpty = document.getElementById("metricsZonesEmpty");
  zonesMetricsList = document.getElementById("zonesMetricsList");
  metricsHeatEmpty = document.getElementById("metricsHeatEmpty");
  statUnique = document.getElementById("statUnique");
  statAvg = document.getElementById("statAvg");
  statZoneCount = document.getElementById("statZoneCount");
  statZoneLeader = document.getElementById("statZoneLeader");
  metricViews = [...document.querySelectorAll(".metric-view")];
  metricSubtabs = [...document.querySelectorAll(".metrics-subtab")];
  zoneMetricsMenu = document.getElementById("zoneMetricsMenu");
  zoneMetricsHint = document.getElementById("zoneMetricsHint");
  zoneMetricsPrompt = document.getElementById("zoneMetricsPrompt");
  metricsPickStep = document.getElementById("metricsPickStep");
  metricsMainStep = document.getElementById("metricsMainStep");
  metricsMenuStep = document.getElementById("metricsMenuStep");
  metricsDetailStep = document.getElementById("metricsDetailStep");
  metricsBack = document.getElementById("metricsBack");
  metricsDetailTitle = document.getElementById("metricsDetailTitle");
  metricsScopeLabel = document.getElementById("metricsScopeLabel");
  metricsChangeScope = document.getElementById("metricsChangeScope");
  metricsChooseZones = document.getElementById("metricsChooseZones");
  zoneMetricsNext = document.getElementById("zoneMetricsNext");
  savedProfileSelect = document.getElementById("savedProfileSelect");
  mot17SampleSelect = document.getElementById("mot17SampleSelect");
  useMot17SampleBtn = document.getElementById("useMot17Sample");
  mot17SampleHint = document.getElementById("mot17SampleHint");
  casiaBSampleSelect = document.getElementById("casiaBSampleSelect");
  useCasiaBSampleBtn = document.getElementById("useCasiaBSample");
  casiaBSampleHint = document.getElementById("casiaBSampleHint");
  activeSourceLine = document.getElementById("activeSourceLine");
  useRecentSessionBtn = document.getElementById("useRecentSession");
  openSnapshotBtn = document.getElementById("openSnapshot");
  gaitTrackList = document.getElementById("gaitTrackList");
  gaitSelectedSummary = document.getElementById("gaitSelectedSummary");
  gaitMatchList = document.getElementById("gaitMatchList");
  ctx = overlay?.getContext("2d");
  if (!video || !overlay || !stage) {
    throw new Error("People Tracker DOM is not mounted.");
  }
}

const HEAT_W = 28;
const HEAT_H = 16;
const ENTRY_BUCKET_SEC = 30;
const ENTRY_BUCKET_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300];
const DWELL_BINS = [
  { label: "0–2s", max: 2 },
  { label: "2–5s", max: 5 },
  { label: "5–10s", max: 10 },
  { label: "10–30s", max: 30 },
  { label: "30s+", max: Infinity },
];

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
  heldTrails: new Map(),
  lastPacket: 0,
  packetMarks: [],
  detectMs: null,
  objectUrl: null,
  sourceKind: null,
  sourceLabel: "",
  mot17Benchmark: false,
  casiaBenchmark: false,
  casiaSubjectId: null,
  videoId: null,
  sessionRecentId: null,
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
  zoneShape: "box",
  zoneDraft: null,
  editingZoneId: null,
  highlightZoneId: null,
  inspectorZonesOpen: false,
  analyticsStep: "zones",
  metricsZoneId: null,
  metricsZoneView: null,
  metricsSelectedZoneIds: [],
  metricsScopeStep: "pick",
  metricsNavStep: "menu",
  metricsActiveView: null,
  showPopulatedAreaOnVideo: false,
  menuDockBottom: false,
  followPopupX: null,
  followPopupY: null,
  gait: createGaitState(),
  trackDisplayId: new Map(),
  extraChart: "summary",
  chartStyles: {
    overview: "area",
    occupancy: "line",
    entries: "bar",
    dwell: "bar",
    perf: "line",
    fps: "line",
  },
};

let zoneDragPointer = null;
let zoneCornerDrag = null;
let zoneCornerDidDrag = false;
let zoneMoveDrag = null;
let zoneMoveDidDrag = false;
let followPopupDrag = null;
let renderActive = false;
let stageResizeObserver = null;
let metricsResizeObserver = null;
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

function metricsPanelActive() {
  const inspector = document.getElementById("inspector");
  return !!(inspector && !inspector.hidden);
}

function setPlaybackUi(active) {
  empty.hidden = active;
  document.querySelector(".app")?.classList.toggle("is-live", active);
  const inspector = document.getElementById("inspector");
  if (inspector) inspector.hidden = !active;
  state.metricsScopeStep = "main";
  state.metricsNavStep = "detail";
  state.metricsActiveView = "overview";
  if (active) {
    state.inspectorZonesOpen = false;
    state.analyticsStep = "zones";
    if (state.metricsZoneView == null) state.metricsZoneView = "frame";
    if (!state.sessionStartedAt) state.sessionStartedAt = performance.now();
    syncInspector();
    combineMenuSignature = "";
    syncCombineMenu();
    requestAnimationFrame(() => refreshMetrics({ forceFull: true }));
  } else if (panelMetrics) {
    panelMetrics.hidden = true;
  }
}

function canProceedToAnalyticsMetrics() {
  return true;
}

function analysisScopeIsWholeFrame() {
  return state.metricsSelectedZoneIds.length === 0;
}

function goToAnalyticsMetricsStep() {
  if (!canProceedToAnalyticsMetrics()) return;
  if (state.metricsSelectedZoneIds.length) {
    applyMetricsZoneSelection();
  } else {
    state.metricsZoneView = "frame";
    state.metricsZoneId = null;
    state.highlightZoneId = null;
  }
  state.inspectorZonesOpen = false;
  state.selectedId = null;
  state.finishedTrail = null;
  updateFollowPopupChrome();
  state.analyticsStep = "metrics";
  lastMetricsChartRefreshMs = 0;
  lastMetricsSummaryRefreshMs = 0;
  syncInspector();
  const selected = getSelectedZones();
  try {
    showExtraChart(selected.length >= 2 ? "compare" : "summary");
    refreshMetrics({ forceFull: true });
  } catch (err) {
    console.error(err);
  }
  syncInspector();
}

function backToAnalyticsZoneStep() {
  state.analyticsStep = "zones";
  state.inspectorZonesOpen = false;
  combineMenuSignature = "";
  analysisScopeSignature = "";
  syncInspector();
  syncCombineMenu();
}

function handleVideoZonePick(zone) {
  if (!zone) return;
  state.inspectorZonesOpen = false;
  state.selectedId = null;
  state.finishedTrail = null;
  updateFollowPopupChrome();
  state.analyticsStep = "zones";
  toggleScopeZoneById(zone.id);
}

function showSourceError(message) {
  if (!sourceError) return;
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

function settingsPayload() {
  return {
    v: 1,
    mirror: state.mirror,
    showPopulatedAreaOnVideo: state.showPopulatedAreaOnVideo,
    menuDockBottom: state.menuDockBottom,
    confidence: state.confidence,
    smoothing: state.smoothing,
    zoneNextId: state.zoneNextId,
    zones: state.zones.map((z) => ({
      id: z.id,
      name: z.name,
      color: z.color,
      shape: z.shape === "circle" ? "circle" : z.shape === "line" ? "line" : "box",
      x: z.x,
      y: z.y,
      w: z.w,
      h: z.h,
      cx: z.cx,
      cy: z.cy,
      rx: z.rx,
      ry: z.ry,
      corners: ensureZoneCorners(z).map((c) => ({ x: c.x, y: c.y })),
    })),
    metricsSelectedZoneIds: state.metricsSelectedZoneIds,
    sourceKind: state.sourceKind,
    sourceLabel: state.sourceLabel,
    videoId: state.videoId,
  };
}

function openVideoDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VIDEO_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(VIDEO_DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putVideoBlob(sessionId, blob) {
  return openVideoDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(VIDEO_DB_STORE, "readwrite");
        tx.objectStore(VIDEO_DB_STORE).put(blob, sessionId);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      })
  );
}

function getVideoBlob(sessionId) {
  return openVideoDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(VIDEO_DB_STORE, "readonly");
        const req = tx.objectStore(VIDEO_DB_STORE).get(sessionId);
        req.onsuccess = () => {
          db.close();
          resolve(req.result ?? null);
        };
        req.onerror = () => reject(req.error);
      })
  );
}

function deleteVideoBlob(sessionId) {
  return openVideoDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(VIDEO_DB_STORE, "readwrite");
        tx.objectStore(VIDEO_DB_STORE).delete(sessionId);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      })
  );
}

function readProfilesStore() {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.profiles && Array.isArray(parsed.profiles)) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const legacy = localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (legacy) {
      const data = JSON.parse(legacy);
      if (data && typeof data === "object") {
        return {
          profiles: [
            {
              id: `r_${Date.now()}`,
              name: data.sourceLabel || "Saved session",
              savedAt: Date.now(),
              data,
            },
          ],
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { profiles: [] };
}

function writeProfilesStore(store) {
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(store));
}

function formatProfileWhen(savedAt) {
  try {
    return new Date(savedAt).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

function setRecentSelectValue(id) {
  if (!savedProfileSelect) return;
  syncingRecentSelect = true;
  savedProfileSelect.value = id || "";
  syncingRecentSelect = false;
}

function syncSavedProfileSelect(store = readProfilesStore()) {
  if (!savedProfileSelect) return;
  const previous = savedProfileSelect.value;
  savedProfileSelect.replaceChildren();
  const sorted = [...store.profiles].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  if (!sorted.length) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "No recent sessions yet";
    savedProfileSelect.append(empty);
    return;
  }
  for (const profile of sorted) {
    const opt = document.createElement("option");
    opt.value = profile.id;
    const when = profile.savedAt ? formatProfileWhen(profile.savedAt) : "";
    opt.textContent = when ? `${profile.name} · ${when}` : profile.name;
    savedProfileSelect.append(opt);
  }
  const keep =
    previous && sorted.some((p) => p.id === previous) ? previous : sorted[0]?.id ?? "";
  setRecentSelectValue(keep);
}

function trimRecentProfiles(store) {
  if (store.profiles.length <= MAX_RECENT_SESSIONS) return;
  const drop = store.profiles.slice(MAX_RECENT_SESSIONS);
  store.profiles = store.profiles.slice(0, MAX_RECENT_SESSIONS);
  for (const profile of drop) {
    const vid = profile.data?.videoId;
    if (vid) void deleteVideoBlob(vid);
  }
}

function beginRecentSession(kind, label, videoFile) {
  state.sourceKind = kind;
  state.sourceLabel = label;
  state.sessionRecentId = `r_${Date.now()}`;
  state.videoId = kind === "file" ? state.sessionRecentId : null;

  const store = readProfilesStore();
  const entry = {
    id: state.sessionRecentId,
    name: label,
    savedAt: Date.now(),
    data: settingsPayload(),
  };
  store.profiles.unshift(entry);
  trimRecentProfiles(store);
  writeProfilesStore(store);
  syncSavedProfileSelect(store);
  setRecentSelectValue(state.sessionRecentId);

  if (videoFile) {
    void putVideoBlob(state.sessionRecentId, videoFile).catch(() => {});
  }
}

function updateCurrentRecentSession() {
  if (!state.sessionRecentId || applyingRecentSession) return;
  try {
    const store = readProfilesStore();
    const idx = store.profiles.findIndex((p) => p.id === state.sessionRecentId);
    if (idx < 0) return;
    const entry = {
      ...store.profiles[idx],
      name: state.sourceLabel || store.profiles[idx].name,
      savedAt: Date.now(),
      data: settingsPayload(),
    };
    store.profiles.splice(idx, 1);
    store.profiles.unshift(entry);
    writeProfilesStore(store);
    syncSavedProfileSelect(store);
    setRecentSelectValue(state.sessionRecentId);
  } catch {
    /* storage full or blocked */
  }
}

function restoreZonesFromData(data) {
  const restored = [];
  if (!Array.isArray(data.zones)) return restored;
  for (const z of data.zones.slice(0, MAX_ZONES)) {
    if (z == null) continue;
    const id = typeof z.id === "number" ? z.id : Number(z.id);
    if (!Number.isFinite(id)) continue;
    const zone = {
      id,
      name: typeof z.name === "string" ? z.name : `Zone ${restored.length + 1}`,
      color: z.color || ZONE_COLORS[(z.id - 1) % ZONE_COLORS.length],
      shape: z.shape === "circle" ? "circle" : z.shape === "line" ? "line" : "box",
      x: z.x ?? 0,
      y: z.y ?? 0,
      w: z.w ?? 0.1,
      h: z.h ?? 0.1,
    };
    if (zone.shape === "circle" && Number.isFinite(Number(z.cx)) && Number.isFinite(Number(z.cy))) {
      zone.cx = clamp(Number(z.cx), 0, 1);
      zone.cy = clamp(Number(z.cy), 0, 1);
      zone.rx = Math.max(0.01, Number(z.rx) || 0.05);
      zone.ry = Math.max(0.01, Number(z.ry) || 0.05);
      syncCircleBounds(zone);
    } else if (zone.shape === "line" && Array.isArray(z.corners) && z.corners.length >= 3) {
      zone.corners = z.corners.map((c) => ({
        x: clamp(c.x, 0, 1),
        y: clamp(c.y, 0, 1),
      }));
      syncZoneAabb(zone);
    } else {
      zone.shape = "box";
      if (Array.isArray(z.corners) && z.corners.length === 4) {
        zone.corners = z.corners.map((c) => ({
          x: clamp(c.x, 0, 1),
          y: clamp(c.y, 0, 1),
        }));
      } else {
        ensureZoneCorners(zone);
      }
      syncZoneAabb(zone);
    }
    initZoneMetrics(zone);
    restored.push(zone);
  }
  if (restored.length) {
    state.zones = restored;
    state.zoneNextId = Math.max(
      typeof data.zoneNextId === "number" ? data.zoneNextId : 1,
      ...restored.map((z) => z.id + 1)
    );
    state.highlightZoneId = null;
  } else {
    state.zones = [];
    state.highlightZoneId = null;
    if (typeof data.zoneNextId === "number") state.zoneNextId = data.zoneNextId;
  }
  return restored;
}

function applyProfileData(data, pick) {
  if (!data || !pick) return;

  if (pick.mirror && typeof data.mirror === "boolean") {
    state.mirror = data.mirror;
    syncMirrorUi();
  }
  if (pick.heatmap && typeof data.showPopulatedAreaOnVideo === "boolean") {
    state.showPopulatedAreaOnVideo = data.showPopulatedAreaOnVideo;
    if (showPopulatedAreaInput) showPopulatedAreaInput.checked = data.showPopulatedAreaOnVideo;
  }
  if (typeof data.menuDockBottom === "boolean") {
    state.menuDockBottom = data.menuDockBottom;
    if (menuDockBottomInput) menuDockBottomInput.checked = data.menuDockBottom;
    applyMenuDock();
  }
  if (typeof data.confidence === "number") state.confidence = clamp(data.confidence, 0.15, 0.9);
  if (typeof data.smoothing === "number") state.smoothing = clamp(data.smoothing, 0, 1);

  if (pick.zones) {
    restoreZonesFromData(data);
  }

  if (pick.metrics && Array.isArray(data.metricsSelectedZoneIds)) {
    const ids = new Set(state.zones.map((z) => z.id));
    state.metricsSelectedZoneIds = data.metricsSelectedZoneIds.filter((id) => ids.has(id));
    if (state.metricsSelectedZoneIds.length) applyMetricsZoneSelection();
    else {
      state.metricsZoneView = "frame";
      state.metricsZoneId = null;
    }
  }

  zoneListSignature = "";
  zoneMenuSignature = "";
  combineMenuSignature = "";
  analysisScopeSignature = "";
  syncZoneControls();
  updateZoneListUi(performance.now());
  syncCombineMenu();
  if (metricsPanelActive()) syncMetricsPickStep();
  sendConfig();
}

function scheduleSaveSettings() {
  if (saveSettingsTimer) clearTimeout(saveSettingsTimer);
  saveSettingsTimer = setTimeout(() => {
    saveSettingsTimer = null;
    updateCurrentRecentSession();
  }, 350);
}

function sessionWantsCamera(data) {
  if (data.sourceKind === "camera") return true;
  if (data.sourceKind === "file") return false;
  return !data.videoId;
}

async function restoreSourceFromProfile(data, { preStream = null } = {}) {
  if (sessionWantsCamera(data)) {
    await useCamera(true, preStream);
    return state.running;
  }
  if (data.sourceKind === "file" || data.videoId) {
    if (!data.videoId) {
      showSourceError("That video is not stored in this browser — open the file again.");
      return false;
    }
    const blob = await getVideoBlob(data.videoId);
    if (!blob) {
      showSourceError("That video is not stored in this browser — open the file again.");
      return false;
    }
    const file = new File([blob], data.sourceLabel || "video.mp4", {
      type: blob.type || "video/mp4",
    });
    await useFile(file, true);
    return state.running;
  }
  showSourceError("This session has no video — use camera or open a video, then try again.");
  return false;
}

function waitForVideoDimensions() {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("loadedmetadata", done);
      video.removeEventListener("resize", done);
      resolve();
    };
    video.addEventListener("loadedmetadata", done);
    video.addEventListener("resize", done);
  });
}

function syncMirrorUi() {
  if (mirrorInput) mirrorInput.checked = state.mirror;
  if (stage) stage.classList.toggle("selfie", state.mirror);
}

async function applyRecentProfile(id, { preStream = null } = {}) {
  if (!id) return;
  const store = readProfilesStore();
  const profile = store.profiles.find((p) => p.id === id);
  if (!profile?.data) {
    showSourceError("That session could not be found.");
    return;
  }

  applyingRecentSession = true;
  showSourceError("");

  state.sessionRecentId = profile.id;
  state.sourceKind = profile.data.sourceKind ?? null;
  state.sourceLabel = profile.data.sourceLabel ?? profile.name ?? "";
  state.videoId = profile.data.videoId ?? null;

  stopSource();
  state.zones = [];
  state.highlightZoneId = null;
  zoneListSignature = "";
  zoneMenuSignature = "";

  try {
    const started = await restoreSourceFromProfile(profile.data, { preStream });
    if (started) {
      await waitForVideoDimensions();
      resize();
    }
    applyProfileData(profile.data, LOAD_ALL);
    if (started) {
      zoneListSignature = "";
      zoneMenuSignature = "";
      updateZoneListUi(performance.now());
      syncZoneControls();
      syncCombineMenu();
    }
    setRecentSelectValue(profile.id);
    if (started) scheduleSaveSettings();
  } catch {
    showSourceError("Could not load that session.");
  } finally {
    applyingRecentSession = false;
  }
}

function loadSettings() {
  syncSavedProfileSelect(readProfilesStore());
}

const CAMERA_CONSTRAINTS = {
  video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: false,
};

function useSelectedRecentSession() {
  const id = savedProfileSelect?.value;
  if (!id) {
    showSourceError("Pick a session, then press Use.");
    return;
  }
  const store = readProfilesStore();
  const profile = store.profiles.find((p) => p.id === id);
  if (!profile?.data) {
    showSourceError("That session could not be found.");
    return;
  }

  showSourceError("");
  if (sessionWantsCamera(profile.data)) {
    if (!navigator.mediaDevices?.getUserMedia) {
      showSourceError("Camera is not available in this browser.");
      return;
    }
    navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS).then(
      (stream) => {
        void applyRecentProfile(id, { preStream: stream });
      },
      () => {
        showSourceError("Camera blocked or unavailable. Try opening a video file instead.");
      }
    );
    return;
  }
  void applyRecentProfile(id);
}

function resetOverlay() {
  state.raw = [];
  state.tracks.clear();
  state.trails.clear();
  state.heldTrails.clear();
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
  if (metricsSummary) {
    metricsSummary.textContent =
      "People in frame over time. Run the video for a few seconds to fill the charts.";
  }
  if (metricsBusiest) metricsBusiest.textContent = "—";
  if (metricsCtx && metricsChart) {
    metricsCtx.clearRect(0, 0, metricsChart.width, metricsChart.height);
  }
  clearMiniCharts();
  updateChartEmptyStates();
  if (statUnique) statUnique.textContent = "—";
  if (statAvg) statAvg.textContent = "—";
  resetAllZoneStats();
  resetGaitState(state.gait);
  state.trackDisplayId.clear();
}

function displayTrackId(id) {
  return id;
}

function clearMiniCharts() {
  for (const canvas of [
    metricsEntries,
    metricsDwell,
    metricsZonesChart,
    metricsHeat,
    metricsOccupancy,
    metricsPerf,
    metricsFps,
  ]) {
    if (!canvas) continue;
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function resetPlaybackSessionForLoop() {
  resetCrowdMetrics();
  state.sessionStartedAt = performance.now();
  state.tracks.clear();
  state.trails.clear();
  state.heldTrails.clear();
  state.raw = [];
  state.selectedId = null;
  state.finishedTrail = null;
  send({ type: "reset" });
  updateFollowPopupChrome();
  if (metricsPanelActive()) {
    refreshMetrics();
  }
}

function noteTrackLife(id, isNew) {
  const t = metricsClock();
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
  const t = metricsClock();
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
  const t = metricsClock();
  for (const zone of state.zones) {
    if (!zone.stats) initZoneMetrics(zone);
    const insideIds = new Set();
    for (const tr of tracks) {
      const box = { x: tr.x, y: tr.y, w: tr.w, h: tr.h };
      if (personInZone(box, zone)) insideIds.add(tr.id);
    }
    const warmed = t >= metricsWarmupSeconds();
    if (warmed) pushZoneCount(zone, insideIds.size, t);

    if (warmed && zone.stats.entryTimes.length === 0) {
      for (const id of insideIds) {
        if (!zone.stats.trackInside.has(id)) zone.stats.trackInside.set(id, t);
        zone.stats.entryTimes.push(t);
      }
    }

    for (const id of insideIds) {
      if (!zone.stats.trackInside.has(id)) {
        zone.stats.trackInside.set(id, t);
        if (warmed) zone.stats.entryTimes.push(t);
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
  if (!state.running) return;
  const t = metricsClock();
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
  const t = metricsClock();
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
  return state.stream ? 0.8 : 0.35;
}

/** Wall-clock session time for charts (keeps sampling while video plays). */
function metricsClock() {
  return (performance.now() - state.sessionStartedAt) / 1000;
}

function noteVideoClock() {
  if (!state.running || state.stream) return;
  const t = video.currentTime;
  const prev = state.lastMetricVideoTime;
  if (prev != null && prev > 0.5 && t + 0.35 < prev) {
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
  const t = metricsClock();
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
  if (tail && Math.abs(tail.t - t) < 0.04 && tail.count === blended) return;
  state.crowdHistory.push({ t, count: blended });
  if (state.crowdHistory.length > 5000) {
    state.crowdHistory.shift();
  }
}

function resizeChartCanvas(canvas, wrap) {
  if (!canvas || !wrap) return false;
  if (wrap.closest("[hidden]")) return false;
  const bounds = wrap.getBoundingClientRect();
  if (bounds.width < 8 || bounds.height < 8) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width * dpr));
  const height = Math.max(1, Math.round(bounds.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return true;
}

function chartDrawHistory(history) {
  const sorted = [...history].sort((a, b) => a.t - b.t);
  if (sorted.length >= 2) return sorted;
  if (sorted.length === 1) {
    const p = sorted[0];
    return [
      { t: Math.max(0, p.t - 0.15), count: p.count },
      p,
    ];
  }
  return sorted;
}

function drawCountTimeChart(canvas, ctx, history, analysis, strokeColor) {
  if (!canvas || !ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const series = chartDrawHistory(downsampleSeries(history));
  if (series.length < 2) return;
  const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
  const scale = cssWidth > 0 ? width / cssWidth : 1;
  const pad = {
    l: Math.round(36 * scale),
    r: Math.round(12 * scale),
    t: Math.round(10 * scale),
    b: Math.round(22 * scale),
  };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const domain = stableChartDomain(history);
  const span = Math.max(domain.t1 - domain.t0, 0.25);
  const { yMax } = domain;

  const xAt = (t) => pad.l + ((t - domain.t0) / span) * plotW;
  const yAt = (count) => pad.t + plotH - (count / yMax) * plotH;

  const fontSize = Math.round(11 * scale);
  ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  ctx.strokeStyle = "rgba(244, 241, 232, 0.1)";
  ctx.lineWidth = 1;
  const yStep = Math.max(1, Math.ceil(yMax / Math.max(2, Math.floor(plotH / (28 * scale)))));
  for (let tick = 0; tick <= yMax; tick += yStep) {
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
  ctx.lineWidth = Math.max(2, 2 * scale);
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
  ctx.fillText(formatAxisTime(domain.t0), pad.l, height - 4);
  ctx.textAlign = "right";
  ctx.fillText(formatAxisTime(domain.t1), width - pad.r, height - 4);
}

function drawMetricsChart(history, analysis) {
  resizeChartCanvas(metricsChart, metricsChartWrap);
  drawCountTimeChart(metricsChart, metricsCtx, history, analysis, "#d6ee6a");
}

function drawMultiCountTimeChart(canvas, ctx, seriesList) {
  if (!canvas || !ctx) return;
  const valid = seriesList
    .map((s) => ({ ...s, history: chartDrawHistory(s.history) }))
    .filter((s) => s.history.length >= 2);
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  if (!valid.length) return;

  const allPoints = valid.flatMap((s) => s.history);
  const domain = stableChartDomain(allPoints);
  const span = Math.max(domain.t1 - domain.t0, 0.25);
  const { yMax } = domain;

  const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
  const scale = cssWidth > 0 ? width / cssWidth : 1;
  const pad = {
    l: Math.round(36 * scale),
    r: Math.round(12 * scale),
    t: Math.round(10 * scale),
    b: Math.round(22 * scale),
  };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const xAt = (t) => pad.l + ((t - domain.t0) / span) * plotW;
  const yAt = (count) => pad.t + plotH - (count / yMax) * plotH;

  const fontSize = Math.round(11 * scale);
  ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(244, 241, 232, 0.1)";
  ctx.lineWidth = 1;
  const yStep = Math.max(1, Math.ceil(yMax / Math.max(2, Math.floor(plotH / (28 * scale)))));
  for (let tick = 0; tick <= yMax; tick += yStep) {
    const y = yAt(tick);
    ctx.fillText(String(tick), pad.l - 6 * scale, y);
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
    ctx.lineWidth = Math.max(2, 2 * scale);
    ctx.stroke();
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.fillText(formatAxisTime(domain.t0), pad.l, height - 4);
  ctx.textAlign = "right";
  ctx.fillText(formatAxisTime(domain.t1), width - pad.r, height - 4);
}

function averageCrowd(history) {
  if (!history.length) return null;
  const sum = history.reduce((acc, p) => acc + p.count, 0);
  return sum / history.length;
}

function setChartPlotReady(plotEl, ready) {
  if (!plotEl) return;
  plotEl.classList.toggle("is-ready", !!ready);
  const empty = plotEl.querySelector(".chart-empty");
  if (!empty) return;
  if (ready) {
    empty.hidden = true;
    empty.style.setProperty("display", "none", "important");
  } else {
    empty.hidden = false;
    empty.style.removeProperty("display");
  }
}

function updateChartEmptyStates() {
  const frameHistory = sortedCrowdHistory();
  const history = scopedCrowdHistory();
  let overviewReady = frameHistory.length >= 1;
  const analysisZones = getAnalysisZones();
  if (analysisZones.length > 1) {
    overviewReady = analysisZones.some((z) => sortedZoneHistory(z).length >= 1);
  } else if (analysisZones.length === 1) {
    overviewReady = history.length >= 1;
  } else {
    overviewReady = frameHistory.length >= 1;
  }
  setChartPlotReady(document.getElementById("metricsChartPlot"), overviewReady);

  const entryZones = getAnalysisZones();
  const entriesReady = entryZones.length
    ? entryZones.some((z) => (z.stats?.entryTimes || []).length > 0)
    : state.entryTimes.length > 0;
  setChartPlotReady(document.getElementById("metricsEntriesPlot"), entriesReady);

  const dwellTotal = scopedDwellTimes().length;
  setChartPlotReady(document.getElementById("metricsDwellPlot"), dwellTotal > 0);

  const zonesTab = zonesForMetricsZonesTab();
  const zonesChartReady =
    zonesTab.length > 0 &&
    zonesTab.some((z) => sortedZoneHistory(z).length >= 1 && (averageCrowd(sortedZoneHistory(z)) || 0) > 0);
  setChartPlotReady(document.getElementById("metricsZonesPlot"), zonesChartReady);

  const { peak: heatPeak } = buildAveragedHeatGrid();
  setChartPlotReady(
    document.getElementById("metricsHeatPlot"),
    heatPeak > 0 || (state.showPopulatedAreaOnVideo && getAnalysisZones().length === 0)
  );

  const occZones = getAnalysisZones();
  const occupancyReady = occZones.length
    ? occZones.some((z) => sortedZoneHistory(z).length >= 1)
    : sortedCrowdHistory().length >= 1;
  setChartPlotReady(document.getElementById("metricsOccupancyPlot"), occupancyReady);

  const perfReady =
    state.perfHistory.length >= 2 &&
    (metricsPerf?.clientWidth || 0) >= 8 &&
    (metricsFps?.clientWidth || 0) >= 8;
  setChartPlotReady(document.getElementById("metricsPerfPlot"), perfReady);
  setChartPlotReady(document.getElementById("metricsFpsPlot"), perfReady);
  hidePlaceholdersOverDrawnCharts();
}

function hidePlaceholdersOverDrawnCharts() {
  const zoneHistory = state.zones.some((z) => (z.stats?.history || []).length > 0);
  const zoneEntries = state.zones.some((z) => (z.stats?.entryTimes || []).length > 0);
  const crowd = sortedCrowdHistory().length > 0;
  const dwell = scopedDwellTimes().length > 0;
  const perf =
    state.perfHistory.length >= 2 &&
    (metricsPerf?.clientWidth || 0) >= 8 &&
    (metricsFps?.clientWidth || 0) >= 8;
  setChartPlotReady(document.getElementById("metricsChartPlot"), crowd || zoneHistory);
  setChartPlotReady(document.getElementById("metricsOccupancyPlot"), zoneHistory || crowd);
  setChartPlotReady(document.getElementById("metricsEntriesPlot"), zoneEntries || state.entryTimes.length > 0);
  setChartPlotReady(document.getElementById("metricsDwellPlot"), dwell);
  setChartPlotReady(document.getElementById("metricsHeatPlot"), crowd || zoneHistory);
  setChartPlotReady(document.getElementById("metricsZonesPlot"), zoneHistory);
  setChartPlotReady(document.getElementById("metricsPerfPlot"), perf);
  setChartPlotReady(document.getElementById("metricsFpsPlot"), perf);
}

function activeMetricsZone() {
  if (state.metricsZoneView !== "zone" || state.metricsZoneId == null) return null;
  return state.zones.find((z) => z.id === state.metricsZoneId) || null;
}

function getSelectedZones() {
  const ids = new Set(state.metricsSelectedZoneIds);
  return state.zones.filter((z) => ids.has(z.id));
}

/** Zones currently driving analytics (empty = whole-frame scope). */
function getAnalysisZones() {
  if (!state.metricsSelectedZoneIds.length) return [];
  return getSelectedZones();
}

function pointInAnyZone(nx, ny, zones) {
  for (const zone of zones) {
    ensureZoneStats(zone);
    if (pointInZone(nx, ny, zone)) return true;
  }
  return false;
}

function toggleZoneIncluded(zoneId) {
  const ids = new Set(state.metricsSelectedZoneIds);
  if (ids.has(zoneId)) ids.delete(zoneId);
  else ids.add(zoneId);
  state.metricsSelectedZoneIds = [...ids];
  zoneMenuSignature = "";
  syncZoneMetricsMenu();
  updateZoneMetricsNextButton();
  scheduleSaveSettings();
}

function sameZoneId(a, b) {
  return Number(a) === Number(b);
}

function toggleScopeZoneById(zoneId) {
  const id = Number(zoneId);
  if (!Number.isFinite(id)) return;
  const ids = state.metricsSelectedZoneIds.map(Number).filter(Number.isFinite);
  const next = ids.some((existing) => existing === id)
    ? ids.filter((existing) => existing !== id)
    : [...ids, id];
  setCombinedZones(next);
}

function setCombinedZones(ids) {
  state.metricsSelectedZoneIds = [...new Set(ids.map(Number).filter(Number.isFinite))];
  state.metricsScopeStep = "main";
  state.metricsNavStep = "detail";
  if (!state.metricsSelectedZoneIds.length) {
    state.metricsZoneView = "frame";
    state.metricsZoneId = null;
    state.highlightZoneId = null;
  } else {
    applyMetricsZoneSelection();
  }
  combineMenuSignature = "";
  analysisScopeSignature = "";
  zoneListSignature = "";
  updateZoneListUi(performance.now());
  syncInspector();
  try {
    refreshMetrics();
  } catch (err) {
    console.error(err);
  }
  scheduleSaveSettings();
}

function emitTrackerUi() {
  if (!trackerUiListeners.size) return;
  const snap = getTrackerUiSnapshot();
  for (const listener of trackerUiListeners) listener(snap);
}

function syncCombineMenu() {
  syncAnalysisScopeUi();
}

function analysisScopeOutOfSync() {
  const scope = document.getElementById("analysisScope");
  if (!scope || scope.hidden) return false;
  if (!state.zones.length) return false;
  const empty = document.getElementById("analysisScopeEmpty");
  if (empty && !empty.hidden) return true;
  const list = document.getElementById("zoneScopeList");
  return !!(list && list.childElementCount === 0);
}

function syncAnalysisScopeUi() {
  const scope = document.getElementById("analysisScope");
  const list = document.getElementById("zoneScopeList");
  const empty = document.getElementById("analysisScopeEmpty");
  const lead = document.getElementById("analysisScopeLead");
  if (!scope) {
    emitTrackerUi();
    return;
  }

  const onZonePick =
    metricsPanelActive() && inspectorMode() === "charts" && state.analyticsStep === "zones";
  setPaneShown(scope, onZonePick);
  if (!onZonePick) {
    emitTrackerUi();
    return;
  }

  const hasZones = state.zones.length > 0;
  if (lead) lead.hidden = !hasZones;
  if (empty) empty.hidden = hasZones;
  if (!list) {
    emitTrackerUi();
    return;
  }
  if (!hasZones) {
    analysisScopeSignature = "";
    list.replaceChildren();
    emitTrackerUi();
    return;
  }

  const catalogSig = state.zones.map((z) => `${z.id}:${z.name}`).join("|");
  const selectionSig = state.metricsSelectedZoneIds.join(",");
  const signature = `${catalogSig};${selectionSig}`;
  const listStale = list.childElementCount === 0 && state.zones.length > 0;
  const selected = new Set(state.metricsSelectedZoneIds.map(Number).filter(Number.isFinite));
  const wholeFrame = analysisScopeIsWholeFrame();
  const allSelected = selected.size === state.zones.length;

  const expectedButtons = 2 + state.zones.length;
  const canPatchSelection =
    list.childElementCount === expectedButtons &&
    list.querySelector(".zone-scope-frame") &&
    list.querySelector(".zone-scope-all");

  if (
    !listStale &&
    canPatchSelection &&
    analysisScopeSignature.startsWith(`${catalogSig};`)
  ) {
    analysisScopeSignature = signature;
    const frameBtn = list.querySelector(".zone-scope-frame");
    const allBtn = list.querySelector(".zone-scope-all");
    frameBtn?.classList.toggle("active", wholeFrame);
    allBtn?.classList.toggle("active", allSelected);
    for (const zone of state.zones) {
      const btn = list.querySelector(`[data-zone-id="${Number(zone.id)}"]`);
      btn?.classList.toggle("active", [...selected].some((id) => sameZoneId(id, zone.id)));
    }
    emitTrackerUi();
    return;
  }

  if (signature === analysisScopeSignature && !listStale) {
    emitTrackerUi();
    return;
  }
  analysisScopeSignature = signature;

  list.replaceChildren();

  const frameBtn = document.createElement("button");
  frameBtn.type = "button";
  frameBtn.className = `zone-scope-btn zone-scope-frame${wholeFrame ? " active" : ""}`;
  frameBtn.textContent = "Whole frame";
  list.append(frameBtn);

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `zone-scope-btn zone-scope-all${allSelected ? " active" : ""}`;
  allBtn.textContent = "All zones";
  list.append(allBtn);

  for (const zone of state.zones) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.zoneId = String(Number(zone.id));
    btn.className = `zone-scope-btn${[...selected].some((id) => sameZoneId(id, zone.id)) ? " active" : ""}`;
    const swatch = document.createElement("span");
    swatch.className = "zone-swatch";
    swatch.style.background = zoneColor(zone);
    const name = document.createElement("span");
    name.textContent = zone.name;
    btn.append(swatch, name);
    list.append(btn);
  }

  emitTrackerUi();
}

export function getTrackerUiSnapshot() {
  const selectedIds = [...state.metricsSelectedZoneIds];
  return {
    zones: state.zones.map((z) => ({
      id: z.id,
      name: z.name,
      color: zoneColor(z),
    })),
    selectedIds,
    zoneCount: state.zones.length,
    wholeFrame: analysisScopeIsWholeFrame(),
    allSelected:
      selectedIds.length === state.zones.length && state.zones.length > 0,
    analyticsStep: state.analyticsStep,
    showZonePicker:
      metricsPanelActive() && inspectorMode() === "charts" && state.analyticsStep === "zones",
  };
}

export function subscribeTrackerUi(listener) {
  trackerUiListeners.add(listener);
  listener(getTrackerUiSnapshot());
  return () => trackerUiListeners.delete(listener);
}

export function trackerGoToMetrics() {
  goToAnalyticsMetricsStep();
}

export function trackerSetWholeFrame() {
  setCombinedZones([]);
}

export function trackerSetAllZones() {
  setCombinedZones(state.zones.map((z) => z.id));
}

export function trackerToggleScopeZone(zoneId) {
  const ids = new Set(state.metricsSelectedZoneIds);
  if (ids.has(zoneId)) ids.delete(zoneId);
  else ids.add(zoneId);
  setCombinedZones([...ids]);
}

export function trackerStartDrawZone() {
  state.analyticsStep = "zones";
  setZoneMode(true);
  syncInspector();
}

function analyticsScopeLabel() {
  const selected = analyticsSelectedZones();
  if (selected.length > 1) return selected.map((z) => z.name).join(" vs ");
  if (selected.length === 1) return selected[0].name;
  return "Whole frame";
}

function syncChartStyleButtons() {
  for (const bar of document.querySelectorAll(".chart-style-bar")) {
    const key = bar.dataset.styleKey;
    if (!key) continue;
    const style = state.chartStyles[key] || "line";
    for (const btn of bar.querySelectorAll("[data-chart-style]")) {
      btn.classList.toggle("active", btn.dataset.chartStyle === style);
    }
  }
}

function setChartStyle(key, style) {
  if (!state.chartStyles) state.chartStyles = {};
  state.chartStyles[key] = style;
  syncChartStyleButtons();
  lastMetricsChartRefreshMs = 0;
  refreshMetrics({ forceFull: false });
}

function chooseEntryBucketSec(spanSec) {
  for (const sec of ENTRY_BUCKET_STEPS) {
    const slots = Math.ceil(spanSec / sec) + 1;
    if (slots >= 8 && slots <= 28) return sec;
  }
  for (const sec of ENTRY_BUCKET_STEPS) {
    const slots = Math.ceil(spanSec / sec) + 1;
    if (slots <= 32) return sec;
  }
  return ENTRY_BUCKET_STEPS[ENTRY_BUCKET_STEPS.length - 1];
}

function sparseTimeLabels(keys) {
  if (keys.length <= 1) return keys.map((k) => formatAxisTime(k));
  return keys.map((k, i) => {
    if (i === 0 || i === keys.length - 1) return formatAxisTime(k);
    if (keys.length <= 10) return formatAxisTime(k);
    if (i === Math.floor(keys.length / 2)) return formatAxisTime(k);
    return "";
  });
}

/** Arrivals timeline with adaptive buckets and zero-filled gaps. */
function buildEntryTimeline() {
  const entryTimes = scopedEntryTimes().slice().sort((a, b) => a - b);
  if (!entryTimes.length) return null;

  const warmup = metricsWarmupSeconds();
  const first = entryTimes[0];
  const last = entryTimes[entryTimes.length - 1];
  const sessionEnd = Math.max(sessionSeconds(), last);
  const tMin = Math.max(warmup, Math.min(first, sessionEnd - 1));
  let tMax = Math.max(sessionEnd, last + 0.5);
  let span = Math.max(tMax - tMin, 2);

  let bucketSec = chooseEntryBucketSec(span);
  let start = Math.floor(tMin / bucketSec) * bucketSec;
  let end = Math.ceil(tMax / bucketSec) * bucketSec;
  let keys = [];
  for (let t = start; t <= end; t += bucketSec) keys.push(t);

  while (keys.length > 32) {
    const idx = ENTRY_BUCKET_STEPS.indexOf(bucketSec);
    const next = ENTRY_BUCKET_STEPS[Math.min(idx + 1, ENTRY_BUCKET_STEPS.length - 1)];
    if (next === bucketSec) break;
    bucketSec = next;
    start = Math.floor(tMin / bucketSec) * bucketSec;
    end = Math.ceil(tMax / bucketSec) * bucketSec;
    keys = [];
    for (let t = start; t <= end; t += bucketSec) keys.push(t);
  }
  while (keys.length < 6 && bucketSec > 1) {
    const idx = ENTRY_BUCKET_STEPS.indexOf(bucketSec);
    const prev = ENTRY_BUCKET_STEPS[Math.max(idx - 1, 0)];
    if (prev === bucketSec) break;
    bucketSec = prev;
    start = Math.floor(tMin / bucketSec) * bucketSec;
    end = Math.ceil(tMax / bucketSec) * bucketSec;
    keys = [];
    for (let t = start; t <= end; t += bucketSec) keys.push(t);
  }

  const values = keys.map(() => 0);
  for (const t of entryTimes) {
    let idx = Math.floor((t - start) / bucketSec);
    if (idx < 0) idx = 0;
    if (idx >= values.length) idx = values.length - 1;
    values[idx] += 1;
  }

  const series = keys.map((k, i) => ({
    t: k + bucketSec / 2,
    count: values[i],
  }));
  const peak = Math.max(...values);
  const peakIdx = values.indexOf(peak);
  let cumulative = 0;
  const cumulativeSeries = keys.map((k, i) => {
    cumulative += values[i];
    return { t: k + bucketSec / 2, count: cumulative };
  });

  return {
    labels: sparseTimeLabels(keys),
    values,
    series,
    cumulativeSeries,
    bucketSec,
    total: entryTimes.length,
    peak,
    peakAt: keys[peakIdx] ?? first,
    t0: keys[0],
    t1: keys[keys.length - 1] + bucketSec,
  };
}

function formatBucketDuration(sec) {
  if (sec >= 60) {
    const m = sec / 60;
    return Number.isInteger(m) ? `${m} min` : `${m.toFixed(1)} min`;
  }
  return `${sec}s`;
}

function refreshEntriesCaption(data) {
  const el = document.getElementById("metricsEntriesCaption");
  if (!el) return;
  if (!data) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  const activeBuckets = data.values.filter((v) => v > 0).length;
  const scope = analyticsScopeLabel();
  el.textContent = `${scope} · ${data.total} entries · ${formatBucketDuration(data.bucketSec)} windows · peak ${data.peak} at ${formatClock(data.peakAt)}`;
}

function buildMultiZoneEntryBuckets(zones) {
  const timelines = zones.map((zone) => {
    ensureZoneStats(zone);
    const entryTimes = [...(zone.stats?.entryTimes || [])].sort((a, b) => a - b);
    return { zone, entryTimes };
  });
  const allTimes = timelines.flatMap((t) => t.entryTimes);
  if (!allTimes.length) return null;

  const warmup = metricsWarmupSeconds();
  const first = Math.min(...allTimes);
  const last = Math.max(...allTimes);
  const sessionEnd = Math.max(sessionSeconds(), last);
  const tMin = Math.max(warmup, Math.min(first, sessionEnd - 1));
  const tMax = Math.max(sessionEnd, last + 0.5);
  const span = Math.max(tMax - tMin, 2);
  let bucketSec = chooseEntryBucketSec(span);
  let start = Math.floor(tMin / bucketSec) * bucketSec;
  let end = Math.ceil(tMax / bucketSec) * bucketSec;
  let keys = [];
  for (let t = start; t <= end; t += bucketSec) keys.push(t);
  while (keys.length > 32) {
    const idx = ENTRY_BUCKET_STEPS.indexOf(bucketSec);
    bucketSec = ENTRY_BUCKET_STEPS[Math.min(idx + 1, ENTRY_BUCKET_STEPS.length - 1)];
    start = Math.floor(tMin / bucketSec) * bucketSec;
    end = Math.ceil(tMax / bucketSec) * bucketSec;
    keys = [];
    for (let t = start; t <= end; t += bucketSec) keys.push(t);
  }
  while (keys.length < 6 && bucketSec > 1) {
    const idx = ENTRY_BUCKET_STEPS.indexOf(bucketSec);
    bucketSec = ENTRY_BUCKET_STEPS[Math.max(idx - 1, 0)];
    start = Math.floor(tMin / bucketSec) * bucketSec;
    end = Math.ceil(tMax / bucketSec) * bucketSec;
    keys = [];
    for (let t = start; t <= end; t += bucketSec) keys.push(t);
  }

  const zoneSeries = timelines.map(({ zone, entryTimes }) => {
    const values = keys.map(() => 0);
    for (const t of entryTimes) {
      let idx = Math.floor((t - start) / bucketSec);
      if (idx < 0) idx = 0;
      if (idx >= values.length) idx = values.length - 1;
      values[idx] += 1;
    }
    return {
      zone,
      color: zoneColor(zone),
      label: zone.name,
      values,
      total: entryTimes.length,
    };
  });

  return {
    labels: sparseTimeLabels(keys),
    zoneSeries,
    bucketSec,
  };
}

function syncChartZoneLegend() {
  const el = document.getElementById("chartZoneLegend");
  if (!el || state.analyticsStep !== "metrics") {
    if (el) el.replaceChildren();
    return;
  }
  el.replaceChildren();
  const zones = getAnalysisZones();
  if (!zones.length) {
    const hint = document.createElement("p");
    hint.className = "chart-zone-legend-hint";
    hint.textContent = state.zones.length
      ? "No zones selected — charts show the whole frame. Use Change zones to pick one or more areas."
      : "Draw zones on the video, then choose them before Next to filter metrics.";
    el.append(hint);
    return;
  }
  for (const zone of zones) {
    const item = document.createElement("span");
    item.className = "chart-legend-item";
    const swatch = document.createElement("span");
    swatch.className = "zone-swatch";
    swatch.style.background = zoneColor(zone);
    const name = document.createElement("span");
    name.textContent = zone.name;
    item.append(swatch, name);
    el.append(item);
  }
}

function dwellBucketData() {
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
  return {
    labels: DWELL_BINS.map((b) => b.label),
    values: counts,
    total: counts.reduce((a, b) => a + b, 0),
  };
}

function refreshSummaryPanel(at = performance.now()) {
  const grid = document.getElementById("metricsKpiGrid");
  const list = document.getElementById("metricsInsightList");
  if (!grid) return;

  const history = scopedCrowdHistory();
  const analysis = analyzeCrowd(history);
  const avg = averageCrowd(history);
  const peak = history.length ? Math.max(...history.map((p) => p.count)) : null;
  const zones = getAnalysisZones();
  const nowVal = scopedLiveCount();
  const now =
    zones.length > 1
      ? null
      : nowVal != null
        ? nowVal
        : history.length
          ? history[history.length - 1].count
          : null;
  const entries = scopedEntryTimes();
  const dwells = scopedDwellTimes();
  const medDwell = dwells.length ? medianOf(dwells) : null;
  const unique = scopedUniqueCount();
  const duration = sessionSeconds();
  const detectAvg = avgDetectMs();
  const lastPerf = state.perfHistory[state.perfHistory.length - 1];

  if (zones.length > 1) {
    grid.replaceChildren();
    for (const zone of zones) {
      const summary = zoneSummaryStats(zone, at);
      const card = document.createElement("div");
      card.className = "metrics-kpi metrics-kpi-zone";
      const head = document.createElement("div");
      head.className = "metrics-kpi-zone-head";
      const swatch = document.createElement("span");
      swatch.className = "zone-swatch";
      swatch.style.background = zoneColor(zone);
      const title = document.createElement("strong");
      title.textContent = zone.name;
      head.append(swatch, title);
      const meta = document.createElement("p");
      meta.className = "metrics-kpi-zone-meta";
      const avgText = summary.avg != null ? summary.avg.toFixed(1) : "—";
      meta.textContent = `Now ${summary.now} · Avg ${avgText} · ${summary.entries} entries · Peak ${summary.busiest}`;
      card.append(head, meta);
      grid.append(card);
    }
    if (list) {
      list.replaceChildren();
      const ranked = zones
        .map((zone) => ({
          zone,
          avg: averageCrowd(sortedZoneHistory(zone)) || 0,
          entries: zone.stats?.entryTimes.length || 0,
        }))
        .sort((a, b) => b.avg - a.avg);
      const top = ranked[0];
      const li = document.createElement("li");
      li.textContent =
        top && top.avg > 0
          ? `${top.zone.name} is the busiest so far (avg ${top.avg.toFixed(1)}, ${top.entries} entries).`
          : "Counts fill in as people move through the selected zones.";
      list.append(li);
    }
    return;
  }

  const cards = [
    { label: "Scope", value: analyticsScopeLabel() },
    { label: "Now in scope", value: now != null ? String(now) : "—" },
    { label: "Average", value: avg != null ? avg.toFixed(1) : "—" },
    { label: "Peak", value: peak != null ? String(peak) : "—" },
    { label: "Unique seen", value: unique ? String(unique) : "—" },
    { label: "Arrivals", value: entries.length ? String(entries.length) : "—" },
    {
      label: "Median dwell",
      value: medDwell != null ? `${medDwell.toFixed(1)}s` : "—",
    },
    { label: "Session", value: formatClock(duration) },
    {
      label: "Detect (avg)",
      value: detectAvg != null ? `${Math.round(detectAvg)} ms` : "—",
    },
    {
      label: "Process rate",
      value: lastPerf?.fps != null ? `${lastPerf.fps.toFixed(1)} fps` : "—",
    },
  ];

  grid.replaceChildren();
  for (const card of cards) {
    const el = document.createElement("div");
    el.className = "metrics-kpi";
    const lab = document.createElement("span");
    lab.className = "metrics-kpi-label";
    lab.textContent = card.label;
    const val = document.createElement("strong");
    val.className = "metrics-kpi-value";
    val.textContent = card.value;
    el.append(lab, val);
    grid.append(el);
  }

  if (!list) return;
  list.replaceChildren();
  const insights = [];
  if (analysis?.peakTime != null) {
    insights.push(
      `Peak occupancy ${Math.round(analysis.peakCount)} at ${formatClock(analysis.peakTime)}.`
    );
  }
  if (analysis?.rampTime != null) {
    insights.push(`Build-up detected from ${formatClock(analysis.rampTime)}.`);
  }
  const busiest = metricsBusiestArea?.textContent?.trim();
  if (busiest && busiest !== "—") {
    insights.push(`Busiest area: ${busiest}.`);
  }
  if (!insights.length) {
    const li = document.createElement("li");
    li.textContent = "Keep the feed running to populate summary insights.";
    list.append(li);
    return;
  }
  for (const text of insights) {
    const li = document.createElement("li");
    li.textContent = text;
    list.append(li);
  }
}

function refreshMetricsZoneTable(now = performance.now()) {
  const wrap = document.getElementById("metricsZoneTableWrap");
  const body = document.getElementById("metricsZoneTableBody");
  if (!wrap || !body) return;
  const zones = zonesForMetricsZonesTab();
  if (!zones.length) {
    wrap.hidden = true;
    body.replaceChildren();
    return;
  }
  wrap.hidden = false;
  body.replaceChildren();
  for (const zone of zones) {
    const summary = zoneSummaryStats(zone, now);
    const peak = summary.peak != null ? summary.peak : "—";
    const tr = document.createElement("tr");
    for (const cell of [
      zone.name,
      String(summary.now),
      summary.avg != null ? summary.avg.toFixed(1) : "—",
      String(peak),
      String(summary.entries),
    ]) {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.append(td);
    }
    body.append(tr);
  }
}

function updateHotspotLine() {
  const line = document.getElementById("metricsHotspotLine");
  if (!line) return;
  const hotspot = heatmapHotspot();
  if (hotspot) {
    line.hidden = false;
    line.textContent = `Busiest foot traffic: ${hotspot.label} of frame.`;
  } else {
    line.hidden = true;
  }
}

function resolveExtraChartTab(name) {
  const alias = {
    entries: "arrivals",
    heat: "traffic",
    zones: "compare",
  };
  let next = alias[name] || name;
  if (next === "compare" && state.zones.length === 0) next = "summary";
  const views = [...document.querySelectorAll("[data-extra-chart]")];
  const available = new Set(views.map((v) => v.dataset.extraChart));
  if (!available.has(next)) {
    next = available.has("summary") ? "summary" : views[0]?.dataset.extraChart || "summary";
  }
  return next;
}

function showExtraChart(name) {
  const next = resolveExtraChartTab(name);
  state.extraChart = next;
  for (const view of document.querySelectorAll("[data-extra-chart]")) {
    view.hidden = view.dataset.extraChart !== next;
  }
  for (const btn of document.querySelectorAll("[data-extra-tab]")) {
    if (btn.dataset.extraTab === "compare") {
      btn.hidden = state.zones.length === 0;
    }
    btn.classList.toggle("active", btn.dataset.extraTab === next);
  }
  syncAnalysisScopeUi();
  syncChartStyleButtons();
  refreshMetrics();
  requestAnimationFrame(() => {
    if (state.extraChart === next) refreshMetrics();
  });
}

function inspectorMode() {
  if (state.inspectorZonesOpen && state.zones.length > 0) return "zones";
  return "charts";
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
  } else if (ids.length > 1) {
    state.metricsZoneView = "multi";
    state.metricsZoneId = null;
    state.highlightZoneId = null;
  } else {
    state.metricsZoneView = "frame";
    state.metricsZoneId = null;
    state.highlightZoneId = null;
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

const METRIC_VIEW_LABELS = {
  overview: "Overview",
  crowd: "Crowd",
  traffic: "Traffic",
  zones: "Zones",
};

function showMetricsMenu() {
  state.metricsNavStep = "menu";
  state.metricsActiveView = null;
  if (metricsMenuStep) metricsMenuStep.hidden = false;
  if (metricsDetailStep) metricsDetailStep.hidden = true;
  for (const btn of metricSubtabs) {
    btn.classList.remove("active");
    btn.setAttribute("aria-selected", "false");
  }
  for (const view of metricViews) {
    view.hidden = true;
    view.classList.remove("active");
  }
}

function showMetricsDetail(name) {
  state.metricsNavStep = "detail";
  state.metricsActiveView = name;
  if (metricsMenuStep) metricsMenuStep.hidden = true;
  if (metricsDetailStep) metricsDetailStep.hidden = false;
  if (metricsDetailTitle) {
    metricsDetailTitle.textContent = METRIC_VIEW_LABELS[name] || name;
  }
  selectMetricView(name);
}

function backToMetricsMenu() {
  showMetricsMenu();
}

function showMetricsMainStep() {
  state.metricsScopeStep = "main";
  if (metricsPickStep) metricsPickStep.hidden = true;
  if (metricsMainStep) metricsMainStep.hidden = false;
  showMetricsDetail("overview");
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
  scheduleSaveSettings();
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
  const zones = getAnalysisZones();
  if (!zones.length) return sortedCrowdHistory();
  if (zones.length === 1) return sortedZoneHistory(zones[0]);
  return [];
}

function scopedEntryTimes() {
  const zones = getAnalysisZones();
  if (zones.length) {
    return zones.flatMap((z) => z.stats?.entryTimes || []);
  }
  return state.entryTimes;
}

function scopedDwellTimes() {
  const zones = getAnalysisZones();
  if (zones.length) {
    return zones.flatMap((z) => z.stats?.dwellTimes || []);
  }
  return state.dwellTimes;
}

function scopedUniqueCount() {
  const zones = getAnalysisZones();
  if (zones.length) {
    let n = 0;
    for (const z of zones) {
      if (!z.stats) continue;
      n += z.stats.dwellTimes.length + z.stats.trackInside.size;
    }
    return n;
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
  const peak = history.length ? Math.max(...history.map((p) => p.count)) : null;
  let busiest = "—";
  if (analysis) {
    const peakLabel =
      analysis.peakCount === 1 ? "1" : String(Math.round(analysis.peakCount));
    busiest = `${peakLabel} @ ${formatClock(analysis.peakTime)}`;
  } else if (peak != null) {
    busiest = String(peak);
  }
  const live = zoneLiveCount(zone, now);
  const latest = history.length ? history[history.length - 1].count : 0;
  const nowCount = state.tracks.size ? live : latest;
  const peakCount = history.length
    ? Math.max(...history.map((point) => point.count), nowCount)
    : nowCount > 0
      ? nowCount
      : null;
  if (!analysis && peakCount != null) busiest = String(peakCount);
  return {
    now: nowCount,
    avg: avg != null ? avg : nowCount > 0 ? nowCount : null,
    entries: zone.stats?.entryTimes.length || 0,
    busiest,
    peak: peakCount,
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

function scopedLiveCount(now = performance.now()) {
  const zones = getAnalysisZones();
  if (!zones.length) {
    const history = sortedCrowdHistory();
    return history.length ? history[history.length - 1].count : 0;
  }
  if (zones.length === 1) return zoneLiveCount(zones[0], now);
  return null;
}

function analyticsSelectedZones() {
  if (analysisScopeIsWholeFrame()) return [];
  return getSelectedZones();
}

function syncAnalyticsScopeSummary() {
  const bar = document.getElementById("analyticsScopeSummary");
  const chips = document.getElementById("analyticsZoneChips");
  if (!bar || !chips) return;
  const onMetrics = state.analyticsStep === "metrics";
  const selected = analyticsSelectedZones();
  if (!onMetrics) {
    bar.hidden = true;
    chips.replaceChildren();
    return;
  }
  bar.hidden = false;
  chips.replaceChildren();
  if (!selected.length) {
    const pill = document.createElement("span");
    pill.className = "analytics-scope-pill analytics-scope-pill-frame";
    pill.textContent = "Whole frame";
    chips.append(pill);
    return;
  }
  for (const zone of selected) {
    const pill = document.createElement("span");
    pill.className = "analytics-scope-pill";
    const swatch = document.createElement("span");
    swatch.className = "zone-swatch";
    swatch.style.background = zoneColor(zone);
    const name = document.createElement("span");
    name.textContent = zone.name;
    pill.append(swatch, name);
    chips.append(pill);
  }
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
  const zones = getAnalysisZones();
  const maskZones = zones.length > 0;
  for (let y = 0; y < HEAT_H; y += 1) {
    for (let x = 0; x < HEAT_W; x += 1) {
      const i = y * HEAT_W + x;
      if (maskZones) {
        const nx = (x + 0.5) / HEAT_W;
        const ny = (y + 0.5) / HEAT_H;
        if (!pointInAnyZone(nx, ny, zones)) continue;
      }
      const v = state.heatGrid[i] / duration;
      grid[i] = v;
      if (v > peak) peak = v;
    }
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
  const selected = getAnalysisZones();
  if (selected.length) return selected;
  return [];
}

function zonesForMetricsZonesTab() {
  const selected = getAnalysisZones();
  if (selected.length) return selected;
  return [];
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

function drawOverviewSingleSeries(history, analysis, color) {
  if (!metricsChart || !metricsCtx || history.length < 1) return false;
  const overviewStyle = state.chartStyles?.overview || "area";
  if (overviewStyle === "area") {
    drawCountTimeChart(metricsChart, metricsCtx, history, analysis, color);
  } else {
    drawStyledTimeSeries(
      metricsChart,
      metricsCtx,
      history,
      color,
      overviewStyle,
      formatAxisTime
    );
  }
  return true;
}

function drawOverviewChart() {
  resizeChartCanvas(metricsChart, metricsChartWrap);
  const plot = document.getElementById("metricsChartPlot");
  const analysisZones = getAnalysisZones();
  if (analysisZones.length > 1) {
    const seriesList = analysisZones.map((zone) => ({
      history: sortedZoneHistory(zone),
      color: zoneColor(zone),
      label: zone.name,
    }));
    const overviewStyle = state.chartStyles?.overview || "area";
    const styleForMulti = overviewStyle === "area" ? "line" : overviewStyle;
    const ok = drawMultiStyledTimeSeries(
      metricsChart,
      metricsCtx,
      seriesList,
      styleForMulti,
      formatAxisTime
    );
    setChartPlotReady(plot, ok && seriesList.some((s) => s.history.length >= 1));
    return;
  }

  if (analysisZones.length === 1) {
    const zone = analysisZones[0];
    const history = sortedZoneHistory(zone);
    const analysis = analyzeCrowd(history);
    if (drawOverviewSingleSeries(history, analysis, zoneColor(zone))) {
      setChartPlotReady(plot, true);
    } else {
      metricsCtx.clearRect(0, 0, metricsChart.width, metricsChart.height);
      setChartPlotReady(plot, false);
    }
    return;
  }

  const history = sortedCrowdHistory();
  const analysis = analyzeCrowd(history);
  if (drawOverviewSingleSeries(history, analysis, "#d6ee6a")) {
    setChartPlotReady(plot, true);
  } else {
    metricsCtx.clearRect(0, 0, metricsChart.width, metricsChart.height);
    setChartPlotReady(plot, false);
  }
}

function cumulativeEntryHistory(zone) {
  ensureZoneStats(zone);
  const times = [...(zone.stats?.entryTimes || [])].sort((a, b) => a - b);
  if (!times.length) return [];
  let n = 0;
  const series = times.map((t) => ({ t, count: (n += 1) }));
  if (series.length === 1) {
    series.unshift({ t: Math.max(0, series[0].t - 0.2), count: 0 });
  }
  return series;
}

function drawOccupancyChart() {
  if (!metricsOccupancy || !metricsOccupancyCtx) return;
  resizeChartCanvas(metricsOccupancy, metricsOccupancy.parentElement);
  const zones = getAnalysisZones();
  if (zones.length > 1) {
    const seriesList = zones.map((zone) => ({
      history: sortedZoneHistory(zone),
      color: zoneColor(zone),
      label: zone.name,
    }));
    const style = state.chartStyles?.occupancy || "line";
    drawMultiStyledTimeSeries(
      metricsOccupancy,
      metricsOccupancyCtx,
      seriesList,
      style,
      formatAxisTime
    );
    return;
  }
  const history = scopedCrowdHistory();
  const color = zones.length === 1 ? zoneColor(zones[0]) : "#d6ee6a";
  const style = state.chartStyles?.occupancy || "line";
  const ok = drawStyledTimeSeries(
    metricsOccupancy,
    metricsOccupancyCtx,
    history,
    color,
    style,
    formatAxisTime
  );
  if (!ok) {
    metricsOccupancyCtx.clearRect(0, 0, metricsOccupancy.width, metricsOccupancy.height);
  }
}

function drawPerformanceCharts() {
  const perfStyle = state.chartStyles?.perf || "line";
  const fpsStyle = state.chartStyles?.fps || "line";
  const msSeries = state.perfHistory
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.ms))
    .map((p) => ({ t: p.t, count: p.ms }));
  const fpsSeries = state.perfHistory
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.fps))
    .map((p) => ({ t: p.t, count: p.fps }));

  if (metricsPerf && metricsPerfCtx && resizeChartCanvas(metricsPerf, metricsPerf.parentElement)) {
    const ok = drawStyledTimeSeries(
      metricsPerf,
      metricsPerfCtx,
      msSeries,
      "#f0a37a",
      perfStyle,
      formatAxisTime
    );
    if (!ok) metricsPerfCtx.clearRect(0, 0, metricsPerf.width, metricsPerf.height);
  }
  if (metricsFps && metricsFpsCtx && resizeChartCanvas(metricsFps, metricsFps.parentElement)) {
    const ok = drawStyledTimeSeries(
      metricsFps,
      metricsFpsCtx,
      fpsSeries,
      "#7ad7f0",
      fpsStyle,
      formatAxisTime
    );
    if (!ok) metricsFpsCtx.clearRect(0, 0, metricsFps.width, metricsFps.height);
  }
}

function updateChartScopeLabel() {
  const scope = document.getElementById("chartScope");
  if (!scope) return;
  const analysisZones = getAnalysisZones();
  if (analysisZones.length > 1) {
    scope.textContent = analysisZones.map((z) => z.name).join(" vs ");
  } else if (analysisZones.length === 1) {
    scope.textContent = analysisZones[0].name;
  } else {
    scope.textContent = "Whole frame";
  }
}

function refreshMetrics(options = {}) {
  const forceFull = options.forceFull === true;
  const now = performance.now();
  const refreshSummary =
    forceFull || now - lastMetricsSummaryRefreshMs >= METRICS_SUMMARY_REFRESH_MS;

  if (refreshSummary) {
    lastMetricsSummaryRefreshMs = now;
    try {
      refreshPopulationInsights();
      refreshSummaryPanel(now);
      refreshMetricsZoneTable(now);
      updateHotspotLine();
      refreshZonesMetricsPanel();
      refreshGaitPanel();
    } catch (err) {
      console.error(err);
    }
  }

  if (!metricsChart || !metricsCtx) {
    try {
      drawPerformanceCharts();
      updateChartEmptyStates();
    } catch (err) {
      console.error(err);
    }
    return;
  }

  state.metricsScopeStep = "main";
  state.metricsNavStep = "detail";

  const history = scopedCrowdHistory();
  const analysis = analyzeCrowd(history);

  if (metricsSummary) {
    metricsSummary.textContent = analysis
      ? ""
      : "Counting… keep the video running.";
  }
  try {
    updateChartScopeLabel();
    drawOverviewChart();
    drawOccupancyChart();
    drawEntryChart();
    drawDwellChart();
    drawZonesCompareChart();
    drawHeatChart();
    drawPerformanceCharts();
    updateChartEmptyStates();
  } catch (err) {
    console.error(err);
  }
  syncAnalyticsScopeSummary();
  syncChartZoneLegend();
  syncChartStyleButtons();
}

function maybeRefreshSummaryFromFrame(now) {
  if (!metricsPanelActive() || state.analyticsStep !== "metrics") return;
  if (now - lastMetricsSummaryRefreshMs < 400) return;
  lastMetricsSummaryRefreshMs = now;
  try {
    refreshSummaryPanel(now);
    refreshMetricsZoneTable(now);
  } catch (err) {
    console.error(err);
  }
}

function maybeRefreshMetricsFromVideoFrame() {
  if (!metricsPanelActive() || state.analyticsStep !== "metrics") return;
  const now = performance.now();
  if (now - lastMetricsChartRefreshMs < METRICS_CHART_REFRESH_MS) return;
  lastMetricsChartRefreshMs = now;
  refreshMetrics({ full: false });
}

function chartScale(canvas) {
  const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
  return cssWidth > 0 ? canvas.width / cssWidth : 1;
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
  if (!metricsEntries || !metricsEntryCtx) return;
  resizeChartCanvas(metricsEntries, metricsEntries.parentElement);
  const zones = getAnalysisZones();
  if (zones.length > 1) {
    const style = state.chartStyles?.entries || "bar";
    const el = document.getElementById("metricsEntriesCaption");
    if (style === "bar") {
      const grouped = buildMultiZoneEntryBuckets(zones);
      if (el) {
        el.hidden = !grouped;
        if (grouped) {
          const totals = grouped.zoneSeries.map((z) => `${z.label} ${z.total}`).join(" · ");
          el.textContent = `Arrivals by zone (colored bars) · ${totals}`;
        }
      }
      if (grouped) {
        drawGroupedZoneBuckets(
          metricsEntries,
          metricsEntryCtx,
          grouped.labels,
          grouped.zoneSeries
        );
      } else {
        metricsEntryCtx.clearRect(0, 0, metricsEntries.width, metricsEntries.height);
      }
      return;
    }
    if (el) {
      el.hidden = false;
      el.textContent = `Arrivals by zone — ${zones.map((z) => z.name).join(", ")}`;
    }
    const seriesList = zones.map((zone) => ({
      history: cumulativeEntryHistory(zone),
      color: zoneColor(zone),
      label: zone.name,
    }));
    const ok = drawMultiStyledTimeSeries(
      metricsEntries,
      metricsEntryCtx,
      seriesList,
      style,
      formatAxisTime
    );
    if (!ok) metricsEntryCtx.clearRect(0, 0, metricsEntries.width, metricsEntries.height);
    setChartPlotReady(document.getElementById("metricsEntriesPlot"), ok);
    return;
  }
  const data = buildEntryTimeline();
  refreshEntriesCaption(data);
  if (!data) {
    metricsEntryCtx.clearRect(0, 0, metricsEntries.width, metricsEntries.height);
    return;
  }
  const color = zones.length === 1 ? zoneColor(zones[0]) : "#d6ee6a";
  const style = state.chartStyles?.entries || "bar";
  let ok = false;
  if (style === "line" || style === "area") {
    ok = drawStyledTimeSeries(
      metricsEntries,
      metricsEntryCtx,
      data.series,
      color,
      style,
      formatAxisTime
    );
  } else {
    ok = drawStyledBuckets(
      metricsEntries,
      metricsEntryCtx,
      data.labels,
      data.values,
      color,
      style,
      { yAxis: true, yLabel: "entries / window", maxBarWidthRatio: 0.12 }
    );
  }
  if (!ok) metricsEntryCtx.clearRect(0, 0, metricsEntries.width, metricsEntries.height);
}

function drawDwellChart() {
  if (!metricsDwell || !metricsDwellCtx) return;
  resizeChartCanvas(metricsDwell, metricsDwell.parentElement);
  const zones = getAnalysisZones();
  if (zones.length > 1) {
    const rows = zones
      .map((zone) => {
        ensureZoneStats(zone);
        const dwells = zone.stats?.dwellTimes || [];
        return {
          zone,
          median: dwells.length ? medianOf(dwells) : 0,
          samples: dwells.length,
        };
      })
      .sort((a, b) => b.median - a.median);
    const { width, height } = metricsDwell;
    metricsDwellCtx.clearRect(0, 0, width, height);
    const maxMed = Math.max(0.5, ...rows.map((r) => r.median));
    const pad = { l: 12, r: 56, t: 10, b: 10 };
    const rowH = (height - pad.t - pad.b) / rows.length;
    const barH = Math.max(4, rowH * 0.62);
    const plotW = width - pad.l - pad.r;
    const scale = chartScale(metricsDwell);
    rows.forEach((row, i) => {
      const y = pad.t + i * rowH + (rowH - barH) / 2;
      const barW = Math.max(2, (row.median / maxMed) * plotW);
      metricsDwellCtx.fillStyle = rgbaFromHex(zoneColor(row.zone), 0.9);
      metricsDwellCtx.fillRect(pad.l, y, barW, barH);
      metricsDwellCtx.fillStyle = "rgba(244, 241, 232, 0.92)";
      metricsDwellCtx.font = `${Math.round(11 * scale)}px ui-sans-serif, system-ui, sans-serif`;
      metricsDwellCtx.textAlign = "left";
      metricsDwellCtx.textBaseline = "middle";
      const label = `${row.zone.name} · ${row.median.toFixed(1)}s med (${row.samples})`;
      metricsDwellCtx.fillText(label, pad.l + barW + 8, y + barH / 2);
    });
    return;
  }
  const { labels, values, total } = dwellBucketData();
  if (!total) {
    metricsDwellCtx.clearRect(0, 0, metricsDwell.width, metricsDwell.height);
    return;
  }
  const color = zones.length === 1 ? zoneColor(zones[0]) : "#7ad7f0";
  const style = state.chartStyles?.dwell || "bar";
  const ok = drawStyledBuckets(
    metricsDwell,
    metricsDwellCtx,
    labels,
    values,
    color,
    style,
    { yAxis: true, yLabel: "people", maxBarWidthRatio: 0.22 }
  );
  if (!ok) metricsDwellCtx.clearRect(0, 0, metricsDwell.width, metricsDwell.height);
}

function drawZonesCompareChart() {
  if (!metricsZonesChart || !metricsZonesCtx) return;
  resizeChartCanvas(metricsZonesChart, metricsZonesChart.parentElement);
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

  const pad = { l: 12, r: 48, t: 10, b: 10 };
  const rowH = (height - pad.t - pad.b) / rows.length;
  const barH = Math.max(4, rowH * 0.62);
  const plotW = width - pad.l - pad.r;

  rows.forEach((row, i) => {
    const y = pad.t + i * rowH + (rowH - barH) / 2;
    const barW = Math.max(2, (row.avg / maxAvg) * plotW);
    metricsZonesCtx.fillStyle = rgbaFromHex(zoneColor(row.zone), 0.9);
    metricsZonesCtx.fillRect(pad.l, y, barW, barH);
    metricsZonesCtx.fillStyle = "rgba(244, 241, 232, 0.92)";
    const scale = chartScale(metricsZonesChart);
    metricsZonesCtx.font = `${Math.round(11 * scale)}px ui-sans-serif, system-ui, sans-serif`;
    metricsZonesCtx.textAlign = "left";
    metricsZonesCtx.textBaseline = "middle";
    metricsZonesCtx.fillText(row.avg.toFixed(1), pad.l + barW + 8, y + barH / 2);
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

function refreshGaitPanel() {
  if (!gaitSelectedSummary) return;
  if (state.selectedId != null && state.tracks.has(state.selectedId)) {
    gaitSelectedSummary.textContent = `Following person #${displayTrackId(state.selectedId)}.`;
  } else {
    gaitSelectedSummary.textContent = "Click someone on the video to follow them.";
  }
}

function drawHeatChart() {
  if (!metricsHeat || !metricsHeatCtx) return;
  resizeChartCanvas(metricsHeat, metricsHeat.parentElement);
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

function selectTab() {
  state.metricsScopeStep = "main";
  state.metricsNavStep = "detail";
  state.metricsActiveView = "overview";
  refreshMetrics();
}

function clearZones() {
  state.zones = [];
  state.zoneDraft = null;
  state.highlightZoneId = null;
  state.editingZoneId = null;
  state.metricsZoneId = null;
  state.metricsZoneView = null;
  state.metricsSelectedZoneIds = [];
  state.metricsScopeStep = "pick";
  zoneDragPointer = null;
  zoneListSignature = "";
  zoneMenuSignature = "";
  combineMenuSignature = "";
  analysisScopeSignature = "";
  if (zoneList) zoneList.replaceChildren();
  syncZoneControls();
  syncMetricsPickStep();
  state.inspectorZonesOpen = false;
  syncInspector();
  scheduleSaveSettings();
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
  if (zone.shape === "circle") {
    syncCircleBounds(zone);
    return zone.corners;
  }
  if (zone.corners?.length >= 3) return zone.corners;
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

function syncCircleBounds(zone) {
  zone.x = zone.cx - zone.rx;
  zone.y = zone.cy - zone.ry;
  zone.w = Math.max(0.01, zone.rx * 2);
  zone.h = Math.max(0.01, zone.ry * 2);
  zone.corners = rectToCorners(zone.x, zone.y, zone.w, zone.h);
}

function zoneCorners(zone) {
  if (zone.shape === "circle") {
    syncCircleBounds(zone);
    return zone.corners;
  }
  if (zone.corners?.length >= 3) return zone.corners;
  return rectToCorners(zone.x, zone.y, zone.w, zone.h);
}

function mapPoint(nx, ny, rect) {
  const x = state.mirror ? 1 - nx : nx;
  return { px: rect.x + x * rect.w, py: rect.y + ny * rect.h };
}

function pointsAreClose(a, b, cssPx = 16) {
  const rect = contentRect();
  if (!rect || !a || !b) return false;
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  const dx = (a.x - b.x) * rect.w;
  const dy = (a.y - b.y) * rect.h;
  return Math.hypot(dx, dy) <= cssPx * dpr;
}

function nearDrawnPoint(px, py, stored, cssPx = 16) {
  const rect = contentRect();
  if (!rect || !stored) return false;
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  const drawn = mapPoint(stored.x, stored.y, rect);
  return Math.hypot(px - drawn.px, py - drawn.py) <= cssPx * dpr;
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

function pointInZone(nx, ny, zone) {
  if (zone?.shape === "circle" && zone.rx > 0 && zone.ry > 0) {
    const dx = (nx - zone.cx) / zone.rx;
    const dy = (ny - zone.cy) / zone.ry;
    return dx * dx + dy * dy <= 1;
  }
  return pointInPolygon(nx, ny, zoneCorners(zone));
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
  const samples = [
    [box.x + box.w * 0.5, box.y + box.h * 0.92],
    [box.x + box.w * 0.5, box.y + box.h * 0.78],
    [box.x + box.w * 0.15, box.y + box.h * 0.9],
    [box.x + box.w * 0.85, box.y + box.h * 0.9],
  ];
  return samples.some(([nx, ny]) => pointInZone(nx, ny, zone));
}

function overlayPointFromEvent(event) {
  const rect = contentRect();
  if (!rect) return null;
  const bounds = overlay.getBoundingClientRect();
  const px = ((event.clientX - bounds.left) / bounds.width) * overlay.width;
  const py = ((event.clientY - bounds.top) / bounds.height) * overlay.height;
  if (px < rect.x || py < rect.y || px > rect.x + rect.w || py > rect.y + rect.h) return null;
  const nx = (px - rect.x) / rect.w;
  const ny = (py - rect.y) / rect.h;
  return { nx, ny, px, py, rect };
}

function cornerHandleHit(event) {
  if (state.zoneMode || !state.running) return null;
  const zone =
    (state.editingZoneId != null && zoneById(state.editingZoneId)) ||
    (state.highlightZoneId != null && zoneById(state.highlightZoneId));
  if (!zone) return null;
  const hit = overlayPointFromEvent(event);
  if (!hit) return null;
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  const hitR = 13 * dpr;
  const handles = zone.shape === "circle" ? circleHandlePoints(zone) : ensureZoneCorners(zone);
  for (let i = 0; i < handles.length; i += 1) {
    const { px, py } = mapPoint(handles[i].x, handles[i].y, hit.rect);
    if (Math.hypot(hit.px - px, hit.py - py) <= hitR) {
      return { zone, cornerIndex: i, circle: zone.shape === "circle" };
    }
  }
  return null;
}

function shiftZone(zone, dx, dy, origin) {
  if (zone.shape === "circle") {
    zone.cx = clamp(origin.cx + dx, 0, 1);
    zone.cy = clamp(origin.cy + dy, 0, 1);
    syncCircleBounds(zone);
    return;
  }
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const c of origin.corners) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }
  const adx = clamp(dx, -minX, 1 - maxX);
  const ady = clamp(dy, -minY, 1 - maxY);
  zone.corners = origin.corners.map((c) => ({ x: c.x + adx, y: c.y + ady }));
  syncZoneAabb(zone);
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
  if (drawBoxBtn) drawBoxBtn.classList.toggle("active", state.zoneMode && state.zoneShape === "box");
  if (drawLineBtn) drawLineBtn.classList.toggle("active", state.zoneMode && state.zoneShape === "line");
  if (zoneClearBtn) zoneClearBtn.disabled = state.zones.length === 0;
  if (stage) stage.classList.toggle("zone-mode", state.zoneMode);
  if (zoneHint) {
    zoneHint.hidden = state.zoneMode;
  }
}

function setZoneMode(on) {
  const analyticsZonePick =
    metricsPanelActive() && state.analyticsStep === "zones" && inspectorMode() === "charts";
  if (on && !analyticsZonePick) setInspectorZonesOpen(true);
  if (on && analyticsZonePick) state.inspectorZonesOpen = false;
  state.zoneMode = on;
  if (!on) {
    state.zoneDraft = null;
    zoneDragPointer = null;
  }
  syncZoneControls();
}

function startDraw(shape) {
  if (!state.running) return;
  if (state.zoneMode && state.zoneShape === shape) {
    setZoneMode(false);
    return;
  }
  if (state.zones.length >= MAX_ZONES) {
    showSourceError(`Maximum ${MAX_ZONES} zones. Remove one to add another.`);
    return;
  }
  showSourceError("");
  state.zoneDraft = null;
  state.editingZoneId = null;
  state.zoneShape = shape;
  setZoneMode(true);
}

function removeZone(id) {
  state.zones = state.zones.filter((z) => z.id !== id);
  state.metricsSelectedZoneIds = state.metricsSelectedZoneIds.filter((zid) => zid !== id);
  if (state.highlightZoneId === id) state.highlightZoneId = null;
  if (state.editingZoneId === id) state.editingZoneId = null;
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
  if (metricsPanelActive()) {
    if (state.metricsScopeStep === "main") refreshMetrics();
    else syncMetricsPickStep();
  }
  syncInspector();
  scheduleSaveSettings();
}

function addZoneFromDraft(draft) {
  if (!draft || draft.w < 0.015 || draft.h < 0.015) return;
  if (state.zones.length >= MAX_ZONES) {
    showSourceError(`Maximum ${MAX_ZONES} zones.`);
    setZoneMode(false);
    return;
  }
  const id = state.zoneNextId++;
  let zone;
  if (draft.shape === "circle") {
    zone = {
      id,
      shape: "circle",
      cx: draft.cx,
      cy: draft.cy,
      rx: draft.rx,
      ry: draft.ry,
      name: `Zone ${state.zones.length + 1}`,
      color: ZONE_COLORS[(id - 1) % ZONE_COLORS.length],
    };
    syncCircleBounds(zone);
  } else {
    const placed = placeBox(draft.x, draft.y, draft.w, draft.h);
    zone = {
      id,
      shape: "box",
      ...placed,
      corners: rectToCorners(placed.x, placed.y, placed.w, placed.h),
      name: `Zone ${state.zones.length + 1}`,
      color: ZONE_COLORS[(id - 1) % ZONE_COLORS.length],
    };
  }
  initZoneMetrics(zone);
  state.zones.push(zone);
  zoneMenuSignature = "";
  combineMenuSignature = "";
  syncZoneControls();
  setZoneMode(false);
  state.analyticsStep = "zones";
  handleVideoZonePick(zone);
  emitTrackerUi();
  scheduleSaveSettings();
}

function addLinePoint(nx, ny, px, py) {
  const point = { x: clamp(nx, 0, 1), y: clamp(ny, 0, 1) };
  const draft = state.zoneDraft;
  if (!draft || draft.shape !== "line") {
    state.zoneDraft = { shape: "line", points: [point], cursor: point };
    return;
  }
  const start = draft.points[0];
  if (draft.points.length >= 3 && nearDrawnPoint(px, py, start)) {
    finishLineZone();
    return;
  }
  const last = draft.points[draft.points.length - 1];
  if (pointsAreClose(point, last, 8)) return;
  draft.points.push(point);
  draft.cursor = point;
  if (draft.points.length >= 16) finishLineZone();
}

function finishLineZone() {
  const draft = state.zoneDraft;
  if (!draft || draft.shape !== "line" || draft.points.length < 3) return;
  if (state.zones.length >= MAX_ZONES) {
    showSourceError(`Maximum ${MAX_ZONES} zones.`);
    setZoneMode(false);
    return;
  }
  const corners = draft.points.map((p) => ({ x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) }));
  if (pointsAreClose(corners[0], corners[corners.length - 1])) corners.pop();
  if (corners.length < 3) return;
  const id = state.zoneNextId++;
  const zone = {
    id,
    shape: "line",
    corners,
    name: `Zone ${state.zones.length + 1}`,
    color: ZONE_COLORS[(id - 1) % ZONE_COLORS.length],
  };
  syncZoneAabb(zone);
  if (zone.w < 0.015 || zone.h < 0.015) {
    state.zoneNextId -= 1;
    return;
  }
  initZoneMetrics(zone);
  state.zones.push(zone);
  zoneMenuSignature = "";
  combineMenuSignature = "";
  syncZoneControls();
  setZoneMode(false);
  state.analyticsStep = "zones";
  handleVideoZonePick(zone);
  emitTrackerUi();
  scheduleSaveSettings();
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
    if (metricsPanelActive()) {
      if (state.metricsScopeStep === "main") refreshMetrics();
      else syncMetricsPickStep();
    }
    if (save) scheduleSaveSettings();
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
  if (signature === zoneListSignature && !(signature === "" && zoneList.childElementCount > 0)) return;
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
      selectZone(zone);
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

function circleHandlePoints(zone) {
  return [
    { x: zone.cx + zone.rx, y: zone.cy },
    { x: zone.cx - zone.rx, y: zone.cy },
    { x: zone.cx, y: zone.cy - zone.ry },
    { x: zone.cx, y: zone.cy + zone.ry },
  ];
}

function resizeCircleToPoint(zone, nx, ny) {
  const rect = contentRect();
  const rw = rect?.w || 1;
  const rh = rect?.h || 1;
  const radius = Math.hypot((nx - zone.cx) * rw, (ny - zone.cy) * rh);
  const rx = radius / rw;
  const ry = radius / rh;
  if (rx < 0.012 || ry < 0.012) return;
  zone.rx = rx;
  zone.ry = ry;
  syncCircleBounds(zone);
}

function drawZoneShape(rect, zone, { draft = false, highlight = false, count = null } = {}) {
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  const color = zone.color || (draft ? "#f0e07a" : zoneColor(zone));
  ctx.save();
  ctx.beginPath();
  let anchor;
  let lineDraft = false;
  let draftLabel = "Release to set zone";
  if (zone.shape === "line" && Array.isArray(zone.points)) {
    const pts = zone.points;
    if (!pts.length) {
      ctx.restore();
      return;
    }
    lineDraft = true;
    const last = pts[pts.length - 1];
    const cursor = zone.cursor;
    const drawPts = cursor && !pointsAreClose(cursor, last, 4) ? [...pts, cursor] : pts;
    drawPts.forEach((c, i) => {
      const { px, py } = mapPoint(c.x, c.y, rect);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    if (drawPts.length >= 3) ctx.closePath();
    anchor = zoneCentroid(pts);
    draftLabel = pts.length >= 3 ? "Click the first point to close" : "Click to add points";
    ctx.fillStyle = "rgba(240, 224, 122, 0.16)";
    if (drawPts.length >= 3) ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5 * dpr;
    ctx.setLineDash([6 * dpr, 4 * dpr]);
    ctx.stroke();
    ctx.setLineDash([]);
    const start = mapPoint(pts[0].x, pts[0].y, rect);
    ctx.beginPath();
    ctx.arc(start.px, start.py, (pts.length >= 3 ? 8 : 5) * dpr, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = "#17190f";
    ctx.stroke();
  } else if (zone.shape === "circle" && zone.rx > 0 && zone.ry > 0) {
    const { px, py } = mapPoint(zone.cx, zone.cy, rect);
    ctx.ellipse(px, py, Math.max(1, zone.rx * rect.w), Math.max(1, zone.ry * rect.h), 0, 0, Math.PI * 2);
    anchor = { x: zone.cx, y: zone.cy };
  } else {
    const corners = zoneCorners(zone);
    corners.forEach((c, i) => {
      const { px, py } = mapPoint(c.x, c.y, rect);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    anchor = zoneCentroid(corners);
  }
  if (!lineDraft) {
    ctx.fillStyle = draft ? "rgba(240, 224, 122, 0.16)" : rgbaFromHex(color, 0.22);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = (highlight || draft ? 3.5 : 2.5) * dpr;
    ctx.setLineDash(draft ? [6 * dpr, 4 * dpr] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const label =
    count == null ? (draft ? draftLabel : zone.name) : `${zone.name} · ${count}`;
  ctx.font = `600 ${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
  const padX = 6 * dpr;
  const labelH = 18 * dpr;
  const labelW = ctx.measureText(label).width + padX * 2;
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
  if (state.zoneMode) return;
  if (zone.id !== state.editingZoneId && zone.id !== state.highlightZoneId) return;
  const handles = zone.shape === "circle" ? circleHandlePoints(zone) : ensureZoneCorners(zone);
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  const r = 7 * dpr;
  const color = zoneColor(zone);
  ctx.save();
  for (const c of handles) {
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
    refreshActiveSourceLine();
  };

  ws.onclose = () => {
    if (state.ws === ws) state.busy = false;
    refreshActiveSourceLine();
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
    if (state.running) {
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
  expireHeldTrails(now);

  for (const track of tracks) {
    seen.add(track.id);
    const current = state.tracks.get(track.id);
    if (!current) {
      const placed = placeBox(track.x, track.y, track.w, track.h);
      const resumed = resumeHeldTrail(track.id, placed, now);
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
      noteTrackLife(track.id, !resumed);
      updateGaitProfile(state.gait, track.id, placed, sessionSeconds());
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
    const tSec = sessionSeconds();
    const boxForGait = {
      x: current.x,
      y: current.y,
      w: current.w,
      h: current.h,
    };
    updateGaitProfile(state.gait, track.id, boxForGait, tSec);
    tryGaitMatch(state.gait, track.id, {
      identityId: displayTrackId,
      onReappear: (newId, priorId, score) => {
        state.gait.matches.set(newId, {
          priorId: displayTrackId(priorId),
          score,
          fromArchive: true,
        });
        refreshGaitPanel();
      },
    });
  }

  for (const id of [...state.tracks.keys()]) {
    if (!seen.has(id)) parkTrail(id, now);
  }
  updateFollowPopupChrome();
}

const TRAIL_HOLD_MS = 1600;

function expireHeldTrails(now) {
  for (const [id, held] of state.heldTrails) {
    if (now - held.at < TRAIL_HOLD_MS) continue;
    state.heldTrails.delete(id);
    if (state.finishedTrail?.id !== id) state.trails.delete(id);
  }
}

function parkTrail(id, now) {
  const track = state.tracks.get(id);
  const history = state.trails.get(id) || [];
  state.heldTrails.set(id, {
    serverId: id,
    displayId: displayTrackId(id),
    trail: history,
    box: track ? { x: track.x, y: track.y, w: track.w, h: track.h } : null,
    at: now,
  });
  if (state.selectedId === id && history.length) {
    state.finishedTrail = { id, points: history };
  }
  closeTrackLife(id);
  closeZoneTrackForAllZones(id);
  archiveGaitProfile(state.gait, id, sessionSeconds(), displayTrackId(id));
  state.tracks.delete(id);
}

function resumeHeldTrail(serverId, box, now) {
  expireHeldTrails(now);
  const held = state.heldTrails.get(serverId);
  if (!held) return false;
  state.heldTrails.delete(serverId);
  const trail = held.trail?.length ? held.trail : state.trails.get(serverId);
  if (trail?.length) state.trails.set(serverId, trail);
  if (state.finishedTrail?.id === serverId) state.finishedTrail = null;
  return Boolean(trail?.length);
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
  const text = `#${displayTrackId(id)}`;
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

function trailAnchor(box) {
  return { x: box.x + box.w / 2, y: Math.min(0.995, box.y + box.h) };
}

function correctTrailTail(history, x, y, body) {
  const near = Math.max(0.012, body * 0.18);
  const from = Math.max(0, history.length - 6);
  for (let i = history.length - 2; i >= from; i -= 1) {
    if (!history[i].soft && i < history.length - 2) continue;
    if (Math.hypot(x - history[i].x, y - history[i].y) > near) continue;
    let far = 0;
    for (let j = i + 1; j < history.length; j += 1) {
      far = Math.max(far, Math.hypot(history[j].x - history[i].x, history[j].y - history[i].y));
    }
    if (far > near * 1.4) {
      history.splice(i + 1);
      return;
    }
  }
}

function rememberTrail(id, box) {
  const foot = trailAnchor(box);
  let history = state.trails.get(id);
  if (!history) {
    history = [];
    history.sx = foot.x;
    history.sy = foot.y;
    state.trails.set(id, history);
    return;
  }
  if (history.sx == null) {
    history.sx = foot.x;
    history.sy = foot.y;
  }
  const body = Math.max(box.h || 0.1, 0.05);
  const dx = foot.x - history.sx;
  const dy = foot.y - history.sy;
  const dist = Math.hypot(dx, dy);
  const pull = dist > body * 0.7 ? 0.22 : 0.5;
  history.sx += dx * pull;
  history.sy += dy * pull;
  correctTrailTail(history, history.sx, history.sy, body);
  const last = history[history.length - 1];
  const step = last ? Math.hypot(history.sx - last.x, history.sy - last.y) : Infinity;
  if (last && step > Math.max(0.07, body * 0.8)) {
    const fresh = [{ x: history.sx, y: history.sy, soft: true }];
    fresh.sx = history.sx;
    fresh.sy = history.sy;
    state.trails.set(id, fresh);
    return;
  }
  if (!last || step > 0.004) {
    history.push({ x: history.sx, y: history.sy, soft: true });
    let softCount = 0;
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (!history[i].soft) break;
      softCount += 1;
      if (softCount > 8) history[i].soft = false;
    }
    if (history.length > 240) history.shift();
  }
}

function roundTrail(points) {
  let current = points;
  for (let pass = 0; pass < 3 && current.length >= 3; pass += 1) {
    const next = [current[0]];
    for (let i = 0; i < current.length - 1; i += 1) {
      const a = current[i];
      const b = current[i + 1];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

function strokeCurve(points) {
  const smooth = roundTrail(points);
  ctx.beginPath();
  ctx.moveTo(smooth[0].x, smooth[0].y);
  for (let i = 1; i < smooth.length - 1; i += 1) {
    const midX = (smooth[i].x + smooth[i + 1].x) / 2;
    const midY = (smooth[i].y + smooth[i + 1].y) / 2;
    ctx.quadraticCurveTo(smooth[i].x, smooth[i].y, midX, midY);
  }
  const end = smooth[smooth.length - 1];
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

function drawTrail(rect, history, color) {
  const points = [];
  for (const point of history || []) {
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      points.push({
        x: mapX(point.x, 0, rect),
        y: rect.y + point.y * rect.h,
      });
    }
  }
  if (history?.sx != null && points.length) {
    const tip = { x: mapX(history.sx, 0, rect), y: rect.y + history.sy * rect.h };
    const last = points[points.length - 1];
    if (Math.hypot(tip.x - last.x, tip.y - last.y) > 1) points.push(tip);
  }
  if (points.length < 2) return;
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 10 * dpr;
  strokeCurve(points);
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 4.5 * dpr;
  strokeCurve(points);
  ctx.restore();
}

function render(now) {
  if (!renderActive) return;
  requestAnimationFrame(render);
  resize();
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  const rect = contentRect();

  if (!rect || !state.running) {
    return;
  }

  if (state.showPopulatedAreaOnVideo) {
    drawVideoTrafficHeatmap(rect);
  }

  let count = 0;
  let selected = null;
  let selectedBox = null;
  for (const [id, track] of state.tracks) {
    const box = follow(track, now);
    count += 1;
    if (id === state.selectedId) rememberTrail(id, box);
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
  if (state.selectedId != null && selectedBox) {
    const history = state.trails.get(state.selectedId);
    const zone = primaryZoneForBox(selectedBox);
    drawTrail(rect, history, zone ? zoneColor(zone) : TRACK_COLOR);
  }

  for (const zone of state.zones) {
    ensureZoneCorners(zone);
    const inZone = countInZone(zone, now);
    const analyticsSelected =
      state.analyticsStep === "metrics" && state.metricsSelectedZoneIds.length > 0
        ? new Set(state.metricsSelectedZoneIds)
        : null;
    drawZoneShape(rect, zone, {
      highlight: analyticsSelected
        ? analyticsSelected.has(zone.id)
        : zone.id === state.highlightZoneId,
      count: inZone,
    });
    drawZoneCornerHandles(rect, zone);
  }
  if (state.zoneDraft) {
    drawZoneShape(rect, state.zoneDraft, { draft: true });
  }
  updateZoneListUi(now);
  if (analysisScopeOutOfSync()) {
    analysisScopeSignature = "";
    syncAnalysisScopeUi();
  }

  drawCrop(selected);

  metricsRenderTick += 1;
  recordCrowd(count);
  if (metricsRenderTick % 8 === 0) {
    recordHeatmap(
      [...state.tracks.entries()].map(([id, tr]) => ({
        id,
        x: tr.x,
        y: tr.y,
        w: tr.w,
        h: tr.h,
      }))
    );
  }
  maybeRefreshSummaryFromFrame(now);
  maybeRefreshMetricsFromVideoFrame();
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

async function useCamera(fromRestore = false, preStream = null) {
  const restoring = fromRestore === true;
  showSourceError("");
  try {
    const stream = preStream ?? (await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS));
    stopSource();
    state.stream = stream;
    video.srcObject = stream;
    await video.play();
    if (!restoring) {
      state.mirror = true;
    }
    syncMirrorUi();
    state.sourceKind = "camera";
    state.sourceLabel = "Camera";
    state.mot17Benchmark = false;
    state.casiaBenchmark = false;
    state.casiaSubjectId = null;
    state.sessionStartedAt = performance.now();
    state.running = true;
    setPlaybackUi(true);
    syncZoneControls();
    if (!restoring && !applyingRecentSession) {
      beginRecentSession("camera", "Camera");
    }
    refreshActiveSourceLine();
    scheduleSaveSettings();
  } catch {
    if (preStream) {
      for (const track of preStream.getTracks()) track.stop();
    }
    showSourceError("Camera blocked or unavailable. Try opening a video file instead.");
  }
}

function refreshActiveSourceLine() {
  if (!activeSourceLine) return;
  if (!state.running || !state.sourceKind) {
    activeSourceLine.textContent =
      "No video loaded — CASIA-B / MOT17 → Use, or Open video.";
    return;
  }
  const wsOk = state.ws && state.ws.readyState === WebSocket.OPEN;
  if (!wsOk) {
    activeSourceLine.textContent =
      "Tracking server offline — run: .venv/bin/python -m app.main (port 8000).";
    return;
  }
  if (state.sourceKind === "camera") {
    activeSourceLine.textContent = "Now playing: Camera (not a benchmark clip).";
    return;
  }
  const name = state.sourceLabel || "Video";
  if (state.casiaBenchmark) {
    const sid = state.casiaSubjectId ? ` · subject ${state.casiaSubjectId}` : "";
    activeSourceLine.textContent = `Now playing: ${name} — CASIA-B gait silhouettes${sid}.`;
  } else if (state.mot17Benchmark) {
    activeSourceLine.textContent = `Now playing: ${name} — MOT17 benchmark (GT on disk, not in Walk UI).`;
  } else {
    activeSourceLine.textContent = `Now playing: ${name} — local/YouTube (not MOT17 / CASIA-B).`;
  }
}

function setMot17Hint(text, isError = false) {
  if (!mot17SampleHint) return;
  if (!text) {
    mot17SampleHint.hidden = true;
    mot17SampleHint.textContent = "";
    mot17SampleHint.classList.remove("error");
    return;
  }
  mot17SampleHint.hidden = false;
  mot17SampleHint.textContent = text;
  mot17SampleHint.classList.toggle("error", isError);
}

async function loadMot17Manifest() {
  if (!mot17SampleSelect) return;
  try {
    const res = await fetch("/samples/mot17-manifest.json", { cache: "no-store" });
    if (!res.ok) throw new Error("manifest missing");
    const data = await res.json();
    mot17Sequences = Array.isArray(data.sequences) ? data.sequences : [];
    mot17SampleSelect.replaceChildren();
    if (!mot17Sequences.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Run scripts/prepare_mot17.py";
      mot17SampleSelect.append(opt);
      setMot17Hint("Full MOT17 not prepared yet — see README.", true);
      return;
    }
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "—";
    mot17SampleSelect.append(placeholder);
    for (const seq of mot17Sequences) {
      const opt = document.createElement("option");
      opt.value = seq.file;
      const gt =
        typeof seq.gtPersons === "number" ? ` · ${seq.gtPersons} GT people` : "";
      opt.textContent = `${seq.label}${gt}`;
      mot17SampleSelect.append(opt);
    }
    const defaultSeq =
      mot17Sequences.find((s) => s.id === "MOT17-05") ?? mot17Sequences[0];
    if (defaultSeq?.file) {
      mot17SampleSelect.value = defaultSeq.file;
    }
    setMot17Hint("Official MOT17 train clips. Press Use to play one.");
  } catch {
    mot17SampleSelect.replaceChildren();
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "MOT17 not installed";
    mot17SampleSelect.append(opt);
    setMot17Hint("Install MOT17, then run scripts/prepare_mot17.py.", true);
  }
}

function setCasiaBHint(text, isError = false) {
  if (!casiaBSampleHint) return;
  if (!text) {
    casiaBSampleHint.hidden = true;
    casiaBSampleHint.textContent = "";
    casiaBSampleHint.classList.remove("error");
    return;
  }
  casiaBSampleHint.hidden = false;
  casiaBSampleHint.textContent = text;
  casiaBSampleHint.classList.toggle("error", isError);
}

async function loadCasiaBManifest() {
  if (!casiaBSampleSelect) return;
  try {
    const res = await fetch("/samples/casia-b-manifest.json", { cache: "no-store" });
    if (!res.ok) throw new Error("manifest missing");
    const data = await res.json();
    casiaBSequences = Array.isArray(data.sequences) ? data.sequences : [];
    casiaBSampleSelect.replaceChildren();
    if (!casiaBSequences.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Run scripts/prepare_casia_b.py";
      casiaBSampleSelect.append(opt);
      setCasiaBHint("CASIA-B not prepared yet — run prepare_casia_b.py.", true);
      return;
    }
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "—";
    casiaBSampleSelect.append(placeholder);
    for (const seq of casiaBSequences) {
      const opt = document.createElement("option");
      opt.value = seq.file;
      opt.textContent = seq.label || seq.id;
      casiaBSampleSelect.append(opt);
    }
    const defaultSeq =
      casiaBSequences.find((s) => s.subjectId === "001") ?? casiaBSequences[0];
    if (defaultSeq?.file) {
      casiaBSampleSelect.value = defaultSeq.file;
    }
    setCasiaBHint("Silhouette gait benchmark. Pick a subject, then Use.");
  } catch {
    casiaBSampleSelect.replaceChildren();
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "CASIA-B not installed";
    casiaBSampleSelect.append(opt);
    setCasiaBHint("Run scripts/prepare_casia_b.py after download_gait_datasets.py.", true);
  }
}

async function useSelectedCasiaBSample() {
  if (!casiaBSampleSelect) return;
  const filePath = casiaBSampleSelect.value;
  if (!filePath) {
    setCasiaBHint("Pick a CASIA-B subject first.", true);
    return;
  }
  const seq = casiaBSequences.find((s) => s.file === filePath);
  setCasiaBHint("");
  showSourceError("");
  try {
    const res = await fetch(filePath, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const name = seq?.id ? `${seq.id}.mp4` : "casia-b.mp4";
    const file = new File([blob], name, { type: blob.type || "video/mp4" });
    await useFile(file, false, {
      mot17Benchmark: false,
      casiaBenchmark: true,
      casiaSubjectId: seq?.subjectId ?? null,
      sourceLabel: seq?.label || name,
    });
    setCasiaBHint(
      seq?.frames
        ? `${seq.label}: ${seq.frames} silhouette frames · same subject = same person ID in dataset.`
        : ""
    );
  } catch {
    setCasiaBHint(
      "Could not load CASIA-B clip. Use npm run dev (5173) or restart backend after prepare_casia_b.py.",
      true
    );
  }
}

async function useSelectedMot17Sample() {
  if (!mot17SampleSelect) return;
  const filePath = mot17SampleSelect.value;
  if (!filePath) {
    setMot17Hint("Pick a MOT17 sequence first.", true);
    return;
  }
  const seq = mot17Sequences.find((s) => s.file === filePath);
  setMot17Hint("");
  showSourceError("");
  try {
    const res = await fetch(filePath, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const name = seq?.id ? `${seq.id}.mp4` : "mot17.mp4";
    const file = new File([blob], name, { type: blob.type || "video/mp4" });
    await useFile(file, false, {
      mot17Benchmark: true,
      casiaBenchmark: false,
      casiaSubjectId: null,
      sourceLabel: seq?.label || name,
    });
    setMot17Hint(
      seq?.frames
        ? `${seq.label}: ${seq.frames} frames.`
        : ""
    );
  } catch {
    setMot17Hint("Could not load that MOT17 clip.", true);
  }
}

async function useFile(file, fromRestore = false, sourceMeta = null) {
  const restoring = fromRestore === true;
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
  if (!restoring) {
    state.mirror = false;
  }
  syncMirrorUi();
  state.sourceKind = "file";
  const mot17FromName = /^MOT17-\d+\.mp4$/i.test(file.name || "");
  const casiaFromName = /^CASIA-\d+\.mp4$/i.test(file.name || "");
  state.mot17Benchmark = sourceMeta?.mot17Benchmark ?? mot17FromName;
  state.casiaBenchmark = sourceMeta?.casiaBenchmark ?? casiaFromName;
  state.casiaSubjectId = sourceMeta?.casiaSubjectId ?? null;
  if (state.casiaBenchmark) {
    state.mot17Benchmark = false;
  }
  if (state.mot17Benchmark) {
    state.casiaBenchmark = false;
    state.casiaSubjectId = null;
  }
  state.sourceLabel = sourceMeta?.sourceLabel || file.name || "Video";
  state.sessionStartedAt = performance.now();
  state.running = true;
  setPlaybackUi(true);
  syncZoneControls();
  if (!restoring && !applyingRecentSession) {
    beginRecentSession("file", state.sourceLabel || file.name || "Video", file);
  }
  refreshActiveSourceLine();
  scheduleSaveSettings();
}

const FOLLOW_SIZE_KEY = "people-tracker-follow-size";
const FOLLOW_HEIGHT_KEY = "people-tracker-follow-height";

function applyFollowSize(width) {
  if (!followPopup) return;
  const dock = followPopup.closest(".inspector");
  const hostW = dock?.clientWidth || stage?.clientWidth || 320;
  const max = Math.max(120, Math.min(280, hostW - 24));
  const next = clamp(width, 96, max);
  followPopup.style.setProperty("--follow-width", `${Math.round(next)}px`);
  clampFollowPopupPosition();
}

function applyFollowHeight(height) {
  if (!followPopup) return;
  const dock = followPopup.closest(".inspector");
  const host = dock?.clientHeight || 0;
  const max = host > 240 ? host - 200 : 720;
  const next = clamp(height, 140, max);
  followPopup.style.setProperty("--follow-height", `${Math.round(next)}px`);
}

function restoreFollowSize() {
  try {
    const saved = Number(localStorage.getItem(FOLLOW_SIZE_KEY));
    if (Number.isFinite(saved)) applyFollowSize(saved);
  } catch {
    /* storage blocked */
  }
}

function restoreFollowHeight() {
  try {
    const saved = Number(localStorage.getItem(FOLLOW_HEIGHT_KEY));
    if (Number.isFinite(saved)) applyFollowHeight(saved);
  } catch {
    /* storage blocked */
  }
}

function wireFollowResize(signal) {
  const docked = Boolean(followPopup?.closest(".inspector"));
  if (docked) restoreFollowHeight();
  else restoreFollowSize();
  const handle = document.getElementById("followResize");
  if (!handle) return;
  handle.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      const startW = followPopup?.offsetWidth || 128;
      const startH = followPopup?.offsetHeight || 320;
      const inDock = Boolean(followPopup?.closest(".inspector"));
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        /* pointer already released */
      }
      const move = (ev) => {
        if (inDock) applyFollowHeight(startH - (ev.clientY - startY));
        else applyFollowSize(startW + (ev.clientX - startX));
      };
      const end = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        try {
          if (inDock) {
            localStorage.setItem(FOLLOW_HEIGHT_KEY, String(Math.round(followPopup?.offsetHeight || 320)));
          } else {
            localStorage.setItem(FOLLOW_SIZE_KEY, String(followPopup?.offsetWidth || 128));
          }
        } catch {
          /* storage blocked */
        }
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    },
    { signal }
  );
}

function wireUi({ signal }) {
  wireFollowResize(signal);
  if (tabSource) tabSource.addEventListener("click", () => selectTab("source"), { signal });
  if (tabMetrics) tabMetrics.addEventListener("click", () => selectTab("metrics"), { signal });

  for (const btn of metricSubtabs) {
    btn.setAttribute("role", "menuitem");
    btn.addEventListener(
      "click",
      () => {
        if (!metricsPanelActive()) selectTab("metrics");
        if (state.metricsScopeStep === "pick") return;
        showMetricsDetail(btn.dataset.metric);
      },
      { signal }
    );
  }

  if (metricsBack) {
    metricsBack.addEventListener("click", () => backToMetricsMenu(), { signal });
  }

  video.addEventListener("timeupdate", noteVideoClock, { signal });
  video.addEventListener(
    "seeked",
    () => {
      if (!state.running || state.stream) return;
      if (video.currentTime < 0.2 && state.crowdHistory.length > 2) {
        resetPlaybackSessionForLoop();
      }
    },
    { signal }
  );
  video.addEventListener(
    "ended",
    () => {
      if (!state.running || state.stream || !video.loop) return;
      resetPlaybackSessionForLoop();
    },
    { signal }
  );

  cameraBtn.addEventListener("click", () => useCamera(), { signal });
  if (cameraBtnEmpty) cameraBtnEmpty.addEventListener("click", () => useCamera(), { signal });
  fileInput.addEventListener(
    "change",
    () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) useFile(file);
    },
    { signal }
  );
  if (fileInputEmpty) {
    fileInputEmpty.addEventListener(
      "change",
      () => {
        const file = fileInputEmpty.files && fileInputEmpty.files[0];
        if (file) useFile(file);
      },
      { signal }
    );
  }

  const stageTools = document.getElementById("stageTools");
  const zoneEditBtn = document.getElementById("zoneEditBtn");
  const zoneDeleteBtn = document.getElementById("zoneDeleteBtn");
  let menuZoneId = null;
  const hideDrawMenu = () => stageTools?.classList.remove("is-open");
  const showDrawMenu = (event) => {
    if (!state.running || !stageTools || !stage) return;
    const point = overlayPointFromEvent(event);
    const zone = point ? zoneAtPoint(point.nx, point.ny) : null;
    menuZoneId = zone ? zone.id : null;
    if (zoneEditBtn) zoneEditBtn.hidden = !zone;
    if (zoneDeleteBtn) zoneDeleteBtn.hidden = !zone;
    const bounds = stage.getBoundingClientRect();
    stageTools.classList.add("is-open");
    const menuW = stageTools.offsetWidth;
    const menuH = stageTools.offsetHeight;
    const x = clamp(event.clientX - bounds.left, 8, Math.max(8, bounds.width - menuW - 8));
    const y = clamp(event.clientY - bounds.top, 8, Math.max(8, bounds.height - menuH - 8));
    stageTools.style.left = `${x}px`;
    stageTools.style.top = `${y}px`;
  };
  if (drawBoxBtn) {
    drawBoxBtn.addEventListener(
      "click",
      () => {
        startDraw("box");
        hideDrawMenu();
      },
      { signal }
    );
  }
  if (drawLineBtn) {
    drawLineBtn.addEventListener(
      "click",
      () => {
        startDraw("line");
        hideDrawMenu();
      },
      { signal }
    );
  }
  if (zoneEditBtn) {
    zoneEditBtn.addEventListener(
      "click",
      () => {
        beginZoneEdit(menuZoneId);
        hideDrawMenu();
      },
      { signal }
    );
  }
  if (zoneDeleteBtn) {
    zoneDeleteBtn.addEventListener(
      "click",
      () => {
        if (menuZoneId != null) removeZone(menuZoneId);
        hideDrawMenu();
      },
      { signal }
    );
  }
  if (stage) {
    stage.addEventListener(
      "contextmenu",
      (event) => {
        if (!state.running) return;
        event.preventDefault();
        if (event.target.closest?.("#drawMenu")) return;
        showDrawMenu(event);
      },
      { signal }
    );
  }
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!stageTools?.classList.contains("is-open")) return;
      if (event.button === 2) return;
      if (stageTools.contains(event.target)) return;
      hideDrawMenu();
    },
    { signal }
  );
  const inspectorModeBack = document.getElementById("inspectorModeBack");
  const inspectorZonesOpen = document.getElementById("inspectorZonesOpen");
  if (inspectorModeBack) {
    inspectorModeBack.addEventListener(
      "click",
      () => {
        const mode = inspectorMode();
        if (mode === "person") clearPersonSelection();
        else if (mode === "zones") setInspectorZonesOpen(false);
        else if (mode === "charts" && state.analyticsStep === "metrics") {
          backToAnalyticsZoneStep();
        }
      },
      { signal }
    );
  }
  const analyticsChangeZones = document.getElementById("analyticsChangeZones");
  if (analyticsChangeZones) {
    analyticsChangeZones.addEventListener("click", () => backToAnalyticsZoneStep(), { signal });
  }
  const analyticsScopeNext = document.getElementById("analyticsScopeNext");
  if (analyticsScopeNext) {
    analyticsScopeNext.addEventListener("click", () => goToAnalyticsMetricsStep(), { signal });
  }
  const zoneScopeList = document.getElementById("zoneScopeList");
  if (zoneScopeList) {
    zoneScopeList.addEventListener(
      "click",
      (event) => {
        const zoneBtn = event.target.closest("[data-zone-id]");
        if (zoneBtn && zoneScopeList.contains(zoneBtn)) {
          event.preventDefault();
          toggleScopeZoneById(zoneBtn.dataset.zoneId);
          return;
        }
        if (event.target.closest(".zone-scope-frame")) {
          event.preventDefault();
          setCombinedZones([]);
          return;
        }
        if (event.target.closest(".zone-scope-all")) {
          event.preventDefault();
          setCombinedZones(state.zones.map((z) => Number(z.id)));
        }
      },
      { signal }
    );
  }
  const analysisDrawZoneBtn = document.getElementById("analysisDrawZoneBtn");
  if (analysisDrawZoneBtn) {
    analysisDrawZoneBtn.addEventListener(
      "click",
      () => {
        state.analyticsStep = "zones";
        startDraw("box");
        syncInspector();
      },
      { signal }
    );
  }
  if (inspectorZonesOpen) {
    inspectorZonesOpen.addEventListener("click", () => setInspectorZonesOpen(true), { signal });
  }
  if (zoneClearBtn) {
    zoneClearBtn.addEventListener(
      "click",
      () => {
        clearZones();
        hideDrawMenu();
      },
      { signal }
    );
  }
  if (zoneMetricsNext) zoneMetricsNext.addEventListener("click", goToMetricsMain, { signal });
  if (metricsChangeScope) metricsChangeScope.addEventListener("click", backToMetricsPick, { signal });
  if (metricsChooseZones) metricsChooseZones.addEventListener("click", backToMetricsPick, { signal });

  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" && state.zoneMode && state.zoneShape === "line") {
        const tag = event.target?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") finishLineZone();
      }
      if (event.key === "Escape" && state.zoneMode) {
        state.zoneDraft = null;
        zoneDragPointer = null;
        setZoneMode(false);
      }
      if (event.key === "Escape") {
        state.editingZoneId = null;
        hideDrawMenu();
      }
    },
    { signal }
  );

  mirrorInput.addEventListener(
    "change",
    () => {
      state.mirror = mirrorInput.checked;
      stage.classList.toggle("selfie", state.mirror);
      scheduleSaveSettings();
    },
    { signal }
  );

  if (showPopulatedAreaInput) {
    showPopulatedAreaInput.addEventListener(
      "change",
      () => {
        state.showPopulatedAreaOnVideo = showPopulatedAreaInput.checked;
        scheduleSaveSettings();
      },
      { signal }
    );
  }

  if (menuDockBottomInput) {
    menuDockBottomInput.addEventListener(
      "change",
      () => {
        state.menuDockBottom = menuDockBottomInput.checked;
        applyMenuDock();
        scheduleSaveSettings();
      },
      { signal }
    );
  }

  if (useRecentSessionBtn) {
    useRecentSessionBtn.addEventListener("click", () => useSelectedRecentSession(), { signal });
  }
  if (useMot17SampleBtn) {
    useMot17SampleBtn.addEventListener("click", () => void useSelectedMot17Sample(), { signal });
  }
  if (useCasiaBSampleBtn) {
    useCasiaBSampleBtn.addEventListener("click", () => void useSelectedCasiaBSample(), { signal });
  }
  if (openSnapshotBtn) {
    openSnapshotBtn.addEventListener("click", () => openSessionSnapshot(), { signal });
  }
  for (const btn of document.querySelectorAll("[data-extra-tab]")) {
    btn.addEventListener(
      "click",
      () => showExtraChart(btn.dataset.extraTab),
      { signal }
    );
  }
  for (const bar of document.querySelectorAll(".chart-style-bar")) {
    bar.addEventListener(
      "click",
      (event) => {
        const btn = event.target.closest("[data-chart-style]");
        if (!btn || !bar.contains(btn)) return;
        const key = bar.dataset.styleKey;
        if (!key) return;
        setChartStyle(key, btn.dataset.chartStyle);
      },
      { signal }
    );
  }
  showExtraChart("summary");
  if (savedProfileSelect) {
    savedProfileSelect.addEventListener(
      "change",
      () => {
        if (sourceError && !syncingRecentSelect) showSourceError("");
      },
      { signal }
    );
  }

  overlay.addEventListener(
    "mousemove",
    (event) => {
      if (state.zoneMode && state.zoneShape === "line") {
        const point = overlayPointFromEvent(event);
        if (point && state.zoneDraft?.shape === "line") {
          state.zoneDraft.cursor = { x: point.nx, y: point.ny };
          const start = state.zoneDraft.points[0];
          overlay.style.cursor =
            state.zoneDraft.points.length >= 3 && nearDrawnPoint(point.px, point.py, start)
              ? "pointer"
              : "crosshair";
        }
        return;
      }
      if (state.zoneMode) return;
      if (cornerHandleHit(event)) {
        overlay.style.cursor = "grab";
        return;
      }
      if (state.editingZoneId != null) {
        const point = pointFromEvent(event);
        const zone = zoneById(state.editingZoneId);
        if (point && zone && pointInZone(point.nx, point.ny, zone)) {
          overlay.style.cursor = "move";
          return;
        }
      }
      const point = pointFromEvent(event);
      overlay.style.cursor = point && trackAt(point.nx, point.ny) ? "pointer" : "default";
    },
    { signal }
  );

  overlay.addEventListener(
    "pointerdown",
    (event) => {
      if (!state.running || event.button !== 0) return;
      const corner = cornerHandleHit(event);
      if (corner) {
        event.preventDefault();
        zoneCornerDidDrag = false;
        zoneCornerDrag = {
          pointerId: event.pointerId,
          zoneId: corner.zone.id,
          cornerIndex: corner.cornerIndex,
          circle: Boolean(corner.circle),
        };
        try {
          overlay.setPointerCapture(event.pointerId);
        } catch {
          /* corner drag still follows pointermove */
        }
        return;
      }
      if (state.zoneMode && state.zoneShape === "line") {
        const point = overlayPointFromEvent(event);
        if (!point) return;
        event.preventDefault();
        addLinePoint(point.nx, point.ny, point.px, point.py);
        return;
      }
      if (state.editingZoneId != null && !state.zoneMode) {
        const hit = overlayPointFromEvent(event);
        const zone = zoneById(state.editingZoneId);
        if (hit && zone && pointInZone(hit.nx, hit.ny, zone)) {
          event.preventDefault();
          zoneMoveDidDrag = false;
          const corners = zone.shape === "circle" ? null : ensureZoneCorners(zone).map((c) => ({ ...c }));
          zoneMoveDrag = {
            pointerId: event.pointerId,
            zoneId: zone.id,
            startNx: hit.nx,
            startNy: hit.ny,
            origin: zone.shape === "circle" ? { cx: zone.cx, cy: zone.cy } : { corners },
          };
          try {
            overlay.setPointerCapture(event.pointerId);
          } catch {
            /* move still follows pointermove */
          }
          return;
        }
      }
      if (!state.zoneMode) return;
      const point = pointFromEvent(event);
      if (!point) return;
      event.preventDefault();
      zoneDragPointer = event.pointerId;
      state.zoneDraft = zoneDraftFromAnchor(point.nx, point.ny, point.nx, point.ny, state.zoneShape);
      try {
        overlay.setPointerCapture(event.pointerId);
      } catch {
        /* drag still follows pointermove on the overlay */
      }
    },
    { signal }
  );

  overlay.addEventListener(
    "pointermove",
    (event) => {
      if (zoneCornerDrag?.pointerId === event.pointerId) {
        const hit = overlayPointFromEvent(event);
        if (!hit) return;
        const zone = zoneById(zoneCornerDrag.zoneId);
        if (!zone) return;
        if (zoneCornerDrag.circle || zone.shape === "circle") {
          resizeCircleToPoint(zone, hit.nx, hit.ny);
        } else {
          const corners = ensureZoneCorners(zone);
          corners[zoneCornerDrag.cornerIndex] = {
            x: clamp(hit.nx, 0, 1),
            y: clamp(hit.ny, 0, 1),
          };
          syncZoneAabb(zone);
        }
        zoneListSignature = "";
        zoneCornerDidDrag = true;
        return;
      }
      if (zoneMoveDrag?.pointerId === event.pointerId) {
        const hit = overlayPointFromEvent(event);
        const zone = zoneById(zoneMoveDrag.zoneId);
        if (!hit || !zone) return;
        shiftZone(zone, hit.nx - zoneMoveDrag.startNx, hit.ny - zoneMoveDrag.startNy, zoneMoveDrag.origin);
        zoneListSignature = "";
        zoneMoveDidDrag = true;
        return;
      }
      if (zoneDragPointer !== event.pointerId || !state.zoneDraft) return;
      const point = pointFromEvent(event);
      if (!point) return;
      state.zoneDraft = zoneDraftFromAnchor(
        state.zoneDraft.anchorX,
        state.zoneDraft.anchorY,
        point.nx,
        point.ny,
        state.zoneDraft.shape || state.zoneShape
      );
    },
    { signal }
  );

  overlay.addEventListener(
    "pointerup",
    (event) => {
      if (zoneCornerDrag?.pointerId === event.pointerId) {
        if (overlay.hasPointerCapture(event.pointerId)) {
          overlay.releasePointerCapture(event.pointerId);
        }
        zoneCornerDrag = null;
        zoneMenuSignature = "";
        scheduleSaveSettings();
        return;
      }
      if (zoneMoveDrag?.pointerId === event.pointerId) {
        if (overlay.hasPointerCapture(event.pointerId)) {
          overlay.releasePointerCapture(event.pointerId);
        }
        zoneMoveDrag = null;
        if (zoneMoveDidDrag) scheduleSaveSettings();
        return;
      }
      if (zoneDragPointer !== event.pointerId) return;
      if (overlay.hasPointerCapture(event.pointerId)) {
        overlay.releasePointerCapture(event.pointerId);
      }
      finishZoneDrag();
    },
    { signal }
  );

  overlay.addEventListener(
    "pointercancel",
    (event) => {
      if (zoneCornerDrag?.pointerId === event.pointerId) {
        zoneCornerDrag = null;
        return;
      }
      if (zoneMoveDrag?.pointerId === event.pointerId) {
        zoneMoveDrag = null;
        return;
      }
      if (zoneDragPointer !== event.pointerId) return;
      zoneDragPointer = null;
      state.zoneDraft = null;
    },
    { signal }
  );

  overlay.addEventListener(
    "dblclick",
    (event) => {
      if (!state.zoneMode || state.zoneShape !== "line" || !state.zoneDraft?.points) return;
      const pts = state.zoneDraft.points;
      if (pts.length >= 2 && pointsAreClose(pts[pts.length - 1], pts[pts.length - 2], 10)) {
        pts.pop();
      }
      finishLineZone();
    },
    { signal }
  );

  overlay.addEventListener(
    "click",
    (event) => {
      if (state.zoneMode) return;
      if (zoneCornerDidDrag) {
        zoneCornerDidDrag = false;
        return;
      }
      if (zoneMoveDidDrag) {
        zoneMoveDidDrag = false;
        return;
      }
      const point = pointFromEvent(event);
      if (!point) return;
      const zoneHit = zoneAtPoint(point.nx, point.ny);
      const hit = trackAt(point.nx, point.ny);
      if (hit != null) {
        state.finishedTrail = null;
        state.inspectorZonesOpen = false;
        state.selectedId = hit === state.selectedId ? null : hit;
        updateFollowPopupChrome();
        refreshGaitPanel();
        syncInspector();
        return;
      }
      if (zoneHit && metricsPanelActive() && state.analyticsStep === "zones") {
        handleVideoZonePick(zoneHit);
        return;
      }
      if (zoneHit) {
        selectZone(zoneHit);
        return;
      }
      if (state.selectedId != null) {
        state.selectedId = null;
        state.finishedTrail = null;
        updateFollowPopupChrome();
      }
      if (metricsPanelActive() && state.analyticsStep === "zones" && state.zones.length) {
        combineMenuSignature = "";
        syncCombineMenu();
        syncInspector();
      }
    },
    { signal }
  );

  if (followPopupHead) {
    followPopupHead.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0 || event.target === followPopupClose) return;
        if (followPopup?.closest(".inspector")) return;
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
      },
      { signal }
    );

    followPopupHead.addEventListener(
      "pointermove",
      (event) => {
        if (!followPopupDrag || followPopupDrag.pointerId !== event.pointerId) return;
        state.followPopupX = followPopupDrag.origX + (event.clientX - followPopupDrag.startX);
        state.followPopupY = followPopupDrag.origY + (event.clientY - followPopupDrag.startY);
        clampFollowPopupPosition();
      },
      { signal }
    );

    const endFollowPopupDrag = (event) => {
      if (!followPopupDrag || followPopupDrag.pointerId !== event.pointerId) return;
      if (followPopupHead.hasPointerCapture(event.pointerId)) {
        followPopupHead.releasePointerCapture(event.pointerId);
      }
      followPopupDrag = null;
    };
    followPopupHead.addEventListener("pointerup", endFollowPopupDrag, { signal });
    followPopupHead.addEventListener("pointercancel", endFollowPopupDrag, { signal });
  }

  if (followPopupClose) {
    followPopupClose.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();
        clearPersonSelection();
      },
      { signal }
    );
  }
}

function followSelectionActive() {
  return (
    state.selectedId != null &&
    (state.tracks.has(state.selectedId) || state.finishedTrail?.id === state.selectedId)
  );
}

function applyMenuDock() {}

function clampFollowPopupPosition() {
  if (!followPopup || followPopup.hidden || followPopup.closest(".inspector")) return;
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
  if (followPopupLabel) {
    const id = state.selectedId;
    const showId = displayTrackId(id);
    const f = state.gait.profiles.get(id)?.features;
    const match = state.gait.matches.get(id);
    let label = `Person #${showId}`;
    if (showId !== id) label += " · returned";
    if (f) {
      label += ` · ${formatGaitPace(f.meanSpeed)}`;
    }
    if (match && showId === id && !match.relinked) {
      label += ` · like #${match.priorId}`;
    }
    followPopupLabel.textContent = label;
  }
  requestAnimationFrame(() => {
    clampFollowPopupPosition();
    requestAnimationFrame(clampFollowPopupPosition);
  });
}

function clearPersonSelection() {
  state.selectedId = null;
  state.finishedTrail = null;
  updateFollowPopupChrome();
  syncInspector();
}

function selectZone(zone) {
  if (!zone) return;
  state.selectedId = null;
  state.finishedTrail = null;
  updateFollowPopupChrome();
  setCombinedZones([zone.id]);
  updateZoneListUi(performance.now());
}

function beginZoneEdit(id) {
  const zone = zoneById(id);
  if (!zone) return;
  setZoneMode(false);
  state.editingZoneId = zone.id;
  state.highlightZoneId = zone.id;
}

function selectFrame() {
  state.selectedId = null;
  state.finishedTrail = null;
  updateFollowPopupChrome();
  state.highlightZoneId = null;
  state.metricsZoneView = "frame";
  state.metricsZoneId = null;
  state.metricsSelectedZoneIds = [];
  state.metricsScopeStep = "main";
  state.metricsNavStep = "detail";
  combineMenuSignature = "";
  zoneListSignature = "";
  updateZoneListUi(performance.now());
  refreshMetrics();
  syncInspector();
}

function setInspectorZonesOpen(open) {
  state.inspectorZonesOpen = !!open;
  if (open && followSelectionActive()) {
    state.selectedId = null;
    state.finishedTrail = null;
    updateFollowPopupChrome();
  }
  syncInspector();
}

function setPaneShown(el, show) {
  if (!el) return;
  el.hidden = !show;
  if (show) el.style.removeProperty("display");
  else el.style.setProperty("display", "none", "important");
}

function syncInspector() {
  if (metricsPanelActive() && state.analyticsStep === "zones") {
    state.inspectorZonesOpen = false;
  }
  const mode = inspectorMode();
  const bodyEl = document.getElementById("inspectorBody");
  const chartsDock = document.getElementById("chartsDock");
  const modeBack = document.getElementById("inspectorModeBack");
  const modeTitle = document.getElementById("inspectorModeTitle");
  const zonesOpenBtn = document.getElementById("inspectorZonesOpen");
  const zoneEl = document.getElementById("inspectorZone");
  const personEl = document.getElementById("inspectorPerson");
  const person = followSelectionActive();
  const zone = zoneById(state.highlightZoneId);
  const zonesListOpen = mode === "zones";
  const showZone = zonesListOpen && !!zone;
  if (zoneEl) zoneEl.hidden = !showZone;
  if (personEl) personEl.hidden = mode !== "person";

  const scope = document.getElementById("chartScope");
  const combined = state.metricsZoneView === "multi" ? getSelectedZones() : [];
  if (scope) {
    const analysisZones = getAnalysisZones();
    if (analysisZones.length > 1) {
      scope.textContent = analysisZones.map((z) => z.name).join(" vs ");
    } else if (analysisZones.length === 1) {
      scope.textContent = analysisZones[0].name;
    } else {
      scope.textContent = "Whole frame";
    }
  }

  if (showZone) {
    const summary = zoneSummaryStats(zone, performance.now());
    const title = document.getElementById("inspectorZoneTitle");
    if (title) title.textContent = zone.name;
    const now = document.getElementById("inspectorZoneNow");
    const avg = document.getElementById("inspectorZoneAvg");
    const entries = document.getElementById("inspectorZoneEntries");
    if (now) now.textContent = String(summary.now);
    if (avg) avg.textContent = summary.avg != null ? summary.avg.toFixed(1) : "—";
    if (entries) entries.textContent = String(summary.entries);
  }

  const zonesBlock = document.getElementById("inspectorZones");
  if (zonesBlock) zonesBlock.hidden = !zonesListOpen;

  if (bodyEl) bodyEl.hidden = mode === "charts";
  if (chartsDock) chartsDock.hidden = mode !== "charts";

  const onZonePickStep = mode === "charts" && state.analyticsStep === "zones";
  const onMetricsStep = mode === "charts" && state.analyticsStep === "metrics";

  const chartsPanel = document.getElementById("chartsPanel");
  setPaneShown(chartsPanel, onMetricsStep);
  setPaneShown(document.getElementById("analysisScope"), onZonePickStep);

  if (panelMetrics) {
    panelMetrics.hidden = !onMetricsStep || mode !== "charts";
  }

  const showModeBack =
    mode === "person" || mode === "zones" || onMetricsStep;
  if (modeBack) modeBack.hidden = !showModeBack;

  if (modeTitle) {
    if (mode === "person") {
      modeTitle.textContent = followPopupLabel?.textContent?.trim() || "Person";
    } else if (mode === "zones") {
      modeTitle.textContent = "Zones";
    } else if (onZonePickStep) {
      const n = state.zones.length;
      modeTitle.textContent = n ? `Which zones? (${n} on video)` : "Which zones?";
    } else {
      modeTitle.textContent = "Analytics";
    }
  }

  const showZonesBtn = (onMetricsStep || onZonePickStep) && state.zones.length > 0;
  if (zonesOpenBtn) zonesOpenBtn.hidden = !showZonesBtn;

  const compareTab = document.querySelector('[data-extra-tab="compare"]');
  if (compareTab) compareTab.hidden = state.zones.length === 0;
  if ((state.extraChart === "compare" || state.extraChart === "zones") && state.zones.length === 0) {
    showExtraChart("summary");
  }

  syncAnalysisScopeUi();
  syncAnalyticsScopeSummary();
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
  let w = box.w * 1.22;
  let h = box.h * 1.12;
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
  const nx = (px - rect.x) / rect.w;
  const ny = (py - rect.y) / rect.h;
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

function zoneAtPoint(nx, ny) {
  let best = null;
  let bestArea = Infinity;
  for (const zone of state.zones) {
    if (!pointInZone(nx, ny, zone)) continue;
    const area = Math.max(0.0001, (zone.w || 0) * (zone.h || 0));
    if (area < bestArea) {
      best = zone;
      bestArea = area;
    }
  }
  return best;
}

function zoneDraftFromAnchor(anchorX, anchorY, nx, ny, shape = "box") {
  if (shape === "circle") {
    const rect = contentRect();
    const rw = rect?.w || 1;
    const rh = rect?.h || 1;
    const radius = Math.hypot((nx - anchorX) * rw, (ny - anchorY) * rh);
    const rx = radius / rw;
    const ry = radius / rh;
    return {
      shape: "circle",
      cx: anchorX,
      cy: anchorY,
      rx,
      ry,
      x: anchorX - rx,
      y: anchorY - ry,
      w: rx * 2,
      h: ry * 2,
      anchorX,
      anchorY,
    };
  }
  const x = Math.min(anchorX, nx);
  const y = Math.min(anchorY, ny);
  const w = Math.abs(nx - anchorX);
  const h = Math.abs(ny - anchorY);
  return { shape: "box", x, y, w, h, anchorX, anchorY };
}

function finishZoneDrag() {
  if (zoneDragPointer == null) return;
  const draft = state.zoneDraft;
  zoneDragPointer = null;
  state.zoneDraft = null;
  if (draft) addZoneFromDraft(draft);
}

function dwellBinSummary(dwellTimes) {
  return DWELL_BINS.map((bin, i) => {
    const low = i === 0 ? 0 : DWELL_BINS[i - 1].max;
    const high = bin.max;
    let count = 0;
    for (const dwell of dwellTimes) {
      if (high === Infinity) {
        if (dwell >= low) count += 1;
      } else if (dwell >= low && dwell < high) {
        count += 1;
      }
    }
    return { label: bin.label, count };
  });
}

function entryBucketSummary(entryTimes) {
  const bucketMap = new Map();
  for (const t of entryTimes) {
    const key = Math.floor(t / ENTRY_BUCKET_SEC) * ENTRY_BUCKET_SEC;
    bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
  }
  return [...bucketMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([startSec, count]) => ({ startSec, count }));
}

function avgDetectMs() {
  if (!state.perfHistory.length) return null;
  const sum = state.perfHistory.reduce((acc, p) => acc + p.ms, 0);
  return sum / state.perfHistory.length;
}

function thinHistory(history, max = 280) {
  return downsampleSeries(history || [], max).map((point) => ({
    t: Math.round(point.t * 10) / 10,
    count: Math.round(point.count * 100) / 100,
  }));
}

function snapshotChartBundle(crowdHistory, dwellTimes) {
  const selected = getAnalysisZones();
  const scopeLabel = analyticsScopeLabel();
  const styles = { ...(state.chartStyles || {}) };
  const nowCount = scopedLiveCount();
  const lastPerf = state.perfHistory[state.perfHistory.length - 1];
  const medDwell = dwellTimes.length ? median(dwellTimes) : null;
  const avg = averageCrowd(crowdHistory);
  const peak = crowdHistory.length ? Math.max(...crowdHistory.map((p) => p.count)) : null;
  const analysis = analyzeCrowd(crowdHistory);

  const occupancy =
    selected.length > 1
      ? {
          multi: true,
          style: styles.occupancy || "line",
          series: selected.map((zone) => ({
            label: zone.name,
            color: zoneColor(zone),
            history: thinHistory(sortedZoneHistory(zone)),
          })),
        }
      : {
          multi: false,
          style: styles.occupancy || "line",
          color: selected.length === 1 ? zoneColor(selected[0]) : "#d6ee6a",
          history: thinHistory(crowdHistory),
        };

  let arrivals = null;
  if (selected.length > 1) {
    const grouped = buildMultiZoneEntryBuckets(selected);
    if (grouped) {
      arrivals = {
        multi: true,
        style: styles.entries || "bar",
        labels: grouped.labels,
        bucketSec: grouped.bucketSec,
        caption: `Arrivals by zone · ${grouped.zoneSeries.map((z) => `${z.label} ${z.total}`).join(" · ")}`,
        zoneSeries: grouped.zoneSeries.map((row) => ({
          label: row.label,
          color: row.color,
          values: row.values,
          total: row.total,
          history: thinHistory(cumulativeEntryHistory(row.zone)),
        })),
      };
    }
  } else {
    const timeline = buildEntryTimeline();
    if (timeline) {
      const color = selected.length === 1 ? zoneColor(selected[0]) : "#d6ee6a";
      arrivals = {
        multi: false,
        style: styles.entries || "bar",
        color,
        labels: timeline.labels,
        values: timeline.values,
        series: timeline.series,
        bucketSec: timeline.bucketSec,
        caption: `${scopeLabel} · ${timeline.total} entries · ${formatBucketDuration(timeline.bucketSec)} windows · peak ${timeline.peak} at ${formatClock(timeline.peakAt)}`,
      };
    }
  }

  let dwell;
  if (selected.length > 1) {
    dwell = {
      multi: true,
      rows: selected
        .map((zone) => {
          ensureZoneStats(zone);
          const samples = zone.stats?.dwellTimes || [];
          return {
            name: zone.name,
            color: zoneColor(zone),
            median: samples.length ? median(samples) : 0,
            samples: samples.length,
          };
        })
        .sort((a, b) => b.median - a.median),
    };
  } else {
    const bins = dwellBucketData();
    dwell = {
      multi: false,
      style: styles.dwell || "bar",
      color: selected.length === 1 ? zoneColor(selected[0]) : "#7ad7f0",
      labels: bins.labels,
      values: bins.values,
      total: bins.total,
    };
  }

  const compareSource = selected.length ? selected : state.zones;
  const compare = compareSource
    .map((zone) => ({
      name: zone.name,
      color: zoneColor(zone),
      avg: averageCrowd(sortedZoneHistory(zone)) || 0,
    }))
    .sort((a, b) => b.avg - a.avg);

  const detectSeries = thinHistory(
    state.perfHistory
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.ms))
      .map((p) => ({ t: p.t, count: p.ms }))
  );
  const fpsSeries = thinHistory(
    state.perfHistory
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.fps))
      .map((p) => ({ t: p.t, count: p.fps }))
  );

  const summary =
    selected.length > 1
      ? {
          multi: true,
          scope: scopeLabel,
          zones: selected.map((zone) => {
            const stats = zoneSummaryStats(zone);
            return {
              name: zone.name,
              color: zoneColor(zone),
              now: stats.now,
              avg: stats.avg,
              entries: stats.entries,
              peak: stats.peak,
              busiest: stats.busiest,
            };
          }),
        }
      : {
          multi: false,
          scope: scopeLabel,
          cards: [
            { label: "Scope", value: scopeLabel },
            { label: "Now in scope", value: nowCount != null ? String(nowCount) : "—" },
            { label: "Average", value: avg != null ? avg.toFixed(1) : "—" },
            { label: "Peak", value: peak != null ? String(Math.round(peak)) : "—" },
            { label: "Unique seen", value: scopedUniqueCount() ? String(scopedUniqueCount()) : "—" },
            { label: "Arrivals", value: scopedEntryTimes().length ? String(scopedEntryTimes().length) : "—" },
            { label: "Median dwell", value: medDwell != null ? `${medDwell.toFixed(1)}s` : "—" },
            { label: "Session", value: formatClock(sessionSeconds()) },
            {
              label: "Detect (avg)",
              value: avgDetectMs() != null ? `${Math.round(avgDetectMs())} ms` : "—",
            },
            {
              label: "Process rate",
              value: lastPerf?.fps != null ? `${lastPerf.fps.toFixed(1)} fps` : "—",
            },
          ],
        };

  return {
    scope: scopeLabel,
    summary,
    occupancy,
    arrivals,
    dwell,
    compare,
    performance: {
      detect: detectSeries,
      fps: fpsSeries,
      detectStyle: styles.perf || "line",
      fpsStyle: styles.fps || "line",
      avgDetectMs: avgDetectMs(),
      lastFps: lastPerf?.fps ?? null,
      peakNote: analysis?.peakTime != null ? formatClock(analysis.peakTime) : null,
    },
  };
}

export function captureSessionSnapshot() {
  const durationSec = sessionSeconds();
  const crowdHistory = [...scopedCrowdHistory()];
  const analysis = analyzeCrowd(crowdHistory);
  const heat = buildAveragedHeatGrid();
  const hotspot = heatmapHotspotFromGrid(heat.grid);
  const reportZones = getAnalysisZones().length ? getAnalysisZones() : state.zones;
  const rankedZones = rankZonesByPopulation(reportZones);
  const leader = rankedZones[0];
  const entryTimes = [...scopedEntryTimes()];
  const dwellTimes = [...scopedDwellTimes()];
  const uniqueCount = scopedUniqueCount();
  const walkSnap = exportGaitSnapshot(state.gait, { displayId: displayTrackId });

  const hasSignal =
    crowdHistory.length >= 2 ||
    entryTimes.length > 0 ||
    dwellTimes.length > 0 ||
    state.zones.some((z) => sortedZoneHistory(z).length >= 2);

  if (!state.running && !hasSignal) {
    return null;
  }

  const charts = snapshotChartBundle(crowdHistory, dwellTimes);

  return {
    v: 2,
    capturedAt: new Date().toISOString(),
    session: {
      sourceKind: state.sourceKind,
      sourceLabel: state.sourceLabel || "Session",
      durationSec,
      durationLabel: formatClock(durationSec),
      mirror: state.mirror,
    },
    performance: {
      avgDetectMs: avgDetectMs(),
      sampleFps: state.packetMarks.length || null,
      lastFps: charts.performance.lastFps,
      detect: charts.performance.detect,
      fps: charts.performance.fps,
    },
    crowd: {
      history: crowdHistory.map((p) => ({ t: p.t, count: p.count })),
      average: averageCrowd(crowdHistory),
      analysis: analysis
        ? {
            peakCount: analysis.peakCount,
            peakAtSec: analysis.peakTime,
            peakAtLabel: formatClock(analysis.peakTime),
            rampAtSec: analysis.rampTime,
            rampAtLabel: analysis.rampTime != null ? formatClock(analysis.rampTime) : null,
            baseline: analysis.baseline,
          }
        : null,
    },
    people: {
      uniqueSeen: uniqueCount,
      totalEntries: entryTimes.length,
      entryBuckets: entryBucketSummary(entryTimes),
      dwellBins: dwellBinSummary(dwellTimes),
      medianDwellSec: dwellTimes.length ? median(dwellTimes) : null,
    },
    traffic: {
      busiestSummary: formatBusiestAreaSummary(leader, hotspot),
      hotspot: hotspot
        ? {
            label: hotspot.label,
            cx: hotspot.cx,
            cy: hotspot.cy,
            peakRate: hotspot.peak,
          }
        : null,
      heatGrid: Array.from(heat.grid),
      heatW: HEAT_W,
      heatH: HEAT_H,
    },
    zones: rankedZones.map(({ zone, avg, peak, personSeconds, entries }) => {
      const stats = zoneSummaryStats(zone);
      return {
        id: zone.id,
        name: zone.name,
        color: zoneColor(zone),
        now: stats.now,
        avgInZone: avg,
        peakInZone: peak,
        personSeconds,
        entries,
        history: thinHistory(sortedZoneHistory(zone)),
      };
    }),
    charts,
    walk: walkSnap,
    insights: buildSnapshotInsights({
      durationSec,
      analysis,
      leader,
      hotspot,
      uniqueCount,
      entryTimes,
      dwellTimes,
      avg: averageCrowd(crowdHistory),
      zoneCount: state.zones.length,
      walkMatches: walkSnap.matches,
    }),
  };
}

function buildSnapshotInsights(snap) {
  const lines = [];
  if (snap.analysis?.peakCount != null) {
    lines.push(
      `Peak crowd was ${Math.round(snap.analysis.peakCount)} people at ${formatClock(snap.analysis.peakAtSec)}.`
    );
    if (snap.analysis.rampAtSec != null) {
      lines.push(`Crowd build-up started around ${formatClock(snap.analysis.rampAtSec)}.`);
    }
  } else if (snap.avg != null) {
    lines.push(`Average people in frame: ${snap.avg.toFixed(1)}.`);
  }
  if (snap.leader?.personSeconds > 0.5) {
    lines.push(
      `${snap.leader.zone.name} held the most occupied time (${snap.leader.personSeconds.toFixed(0)} person·seconds, ~${snap.leader.avg.toFixed(1)} avg inside).`
    );
  } else if (snap.hotspot) {
    lines.push(`Strongest foot traffic tended toward the ${snap.hotspot.label} of the frame.`);
  }
  if (snap.uniqueCount > 0) {
    lines.push(`About ${snap.uniqueCount} distinct people were seen entering the frame.`);
  }
  if (snap.entryTimes.length >= 3) {
    lines.push(`${snap.entryTimes.length} frame entries were logged across the session.`);
  }
  if (snap.dwellTimes.length && snap.dwellTimes.length >= 3) {
    const med = median(snap.dwellTimes);
    lines.push(`Typical time in frame was about ${med.toFixed(1)}s (median dwell).`);
  }
  if (snap.walkMatches?.length) {
    const top = snap.walkMatches[0];
    lines.push(
      `Walk similarity: track #${top.trackId} moved like earlier #${top.priorId} (${Math.round(top.score * 100)}% — experimental).`
    );
  }
  if (snap.zoneCount === 0) {
    lines.push("No zones were drawn — draw zones on Source to compare areas next time.");
  }
  if (!lines.length) {
    lines.push("Keep the feed running longer to fill crowd and traffic insights.");
  }
  return lines;
}

function openSessionSnapshot() {
  const data = captureSessionSnapshot();
  if (!data) {
    showSourceError("Run the video a few seconds, then take a snapshot.");
    return;
  }
  showSourceError("");
  if (snapshotNavigateHandler) {
    snapshotNavigateHandler(data);
  }
}

export function reconcileTrackerDom() {
  bindDom();
  ctx = overlay?.getContext("2d");
  metricsCtx = metricsChart?.getContext("2d");
  metricsEntryCtx = metricsEntries?.getContext("2d");
  metricsDwellCtx = metricsDwell?.getContext("2d");
  metricsZonesCtx = metricsZonesChart?.getContext("2d");
  metricsHeatCtx = metricsHeat?.getContext("2d");
  metricsOccupancyCtx = metricsOccupancy?.getContext("2d");
  metricsPerfCtx = metricsPerf?.getContext("2d");
  metricsFpsCtx = metricsFps?.getContext("2d");
  followPopupCtx = followPopupCanvas?.getContext("2d", { alpha: false });
  combineMenuSignature = "";
  zoneListSignature = "";
  zoneMenuSignature = "";
  syncCombineMenu();
  syncInspector();
  if (state.running) {
    resize();
    clampFollowPopupPosition();
  }
}

export function mountPeopleTracker(options = {}) {
  snapshotNavigateHandler = options.onOpenSnapshot ?? null;
  bindDom();
  loadSettings();
  const ac = new AbortController();
  wireUi({ signal: ac.signal });

  const metricsResize = () => {
    if (metricsPanelActive() && state.metricsNavStep === "detail") {
      refreshMetrics({ forceFull: false });
    }
  };
  stageResizeObserver = new ResizeObserver(() => {
    resize();
    clampFollowPopupPosition();
  });
  stageResizeObserver.observe(stage);
  metricsResizeObserver = new ResizeObserver(metricsResize);
  if (metricsChartWrap) metricsResizeObserver.observe(metricsChartWrap);
  if (panelMetrics) metricsResizeObserver.observe(panelMetrics);
  const chartsDock = document.getElementById("chartsDock");
  if (chartsDock) metricsResizeObserver.observe(chartsDock);

  connect();
  void loadMot17Manifest();
  void loadCasiaBManifest();
  syncZoneControls();
  state.metricsScopeStep = "main";
  state.metricsNavStep = "detail";
  state.metricsActiveView = "overview";
  if (!state.metricsZoneView) state.metricsZoneView = "frame";
  updateChartEmptyStates();
  combineMenuSignature = "";
  syncCombineMenu();
  syncInspector();
  renderActive = true;
  requestAnimationFrame(render);
  pump();

  return () => {
    renderActive = false;
    ac.abort();
    stageResizeObserver?.disconnect();
    metricsResizeObserver?.disconnect();
    state.running = false;
    if (state.ws) {
      try {
        state.ws.close();
      } catch {
        /* noop */
      }
    }
    stopSource();
  };
}
