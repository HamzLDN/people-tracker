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
let zoneModeBtn;
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
let trafficBusiestArea;
let trafficZoneRank;
let showPopulatedAreaInput;
let menuDockBottomInput;
let metricsEntries;
let metricsDwell;
let metricsZonesChart;
let metricsHeat;
let metricsEntryCtx;
let metricsDwellCtx;
let metricsZonesCtx;
let metricsHeatCtx;
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
  zoneModeBtn = document.getElementById("zoneModeBtn");
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
  trafficBusiestArea = document.getElementById("trafficBusiestArea");
  trafficZoneRank = document.getElementById("trafficZoneRank");
  showPopulatedAreaInput = document.getElementById("showPopulatedArea");
  menuDockBottomInput = document.getElementById("menuDockBottom");
  metricsEntries = document.getElementById("metricsEntries");
  metricsDwell = document.getElementById("metricsDwell");
  metricsZonesChart = document.getElementById("metricsZonesChart");
  metricsHeat = document.getElementById("metricsHeat");
  metricsEntryCtx = metricsEntries?.getContext("2d");
  metricsDwellCtx = metricsDwell?.getContext("2d");
  metricsZonesCtx = metricsZonesChart?.getContext("2d");
  metricsHeatCtx = metricsHeat?.getContext("2d");
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
  zoneDraft: null,
  highlightZoneId: null,
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
};

let zoneDragPointer = null;
let zoneCornerDrag = null;
let zoneCornerDidDrag = false;
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

function setPlaybackUi(active) {
  empty.hidden = active;
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
      x: z.x,
      y: z.y,
      w: z.w,
      h: z.h,
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
    if (z == null || typeof z.id !== "number") continue;
    const zone = {
      id: z.id,
      name: typeof z.name === "string" ? z.name : `Zone ${restored.length + 1}`,
      color: z.color || ZONE_COLORS[(z.id - 1) % ZONE_COLORS.length],
      x: z.x ?? 0,
      y: z.y ?? 0,
      w: z.w ?? 0.1,
      h: z.h ?? 0.1,
    };
    if (Array.isArray(z.corners) && z.corners.length === 4) {
      zone.corners = z.corners.map((c) => ({
        x: clamp(c.x, 0, 1),
        y: clamp(c.y, 0, 1),
      }));
    } else {
      ensureZoneCorners(zone);
    }
    syncZoneAabb(zone);
    initZoneMetrics(zone);
    restored.push(zone);
  }
  if (restored.length) {
    state.zones = restored;
    state.zoneNextId = Math.max(
      typeof data.zoneNextId === "number" ? data.zoneNextId : 1,
      ...restored.map((z) => z.id + 1)
    );
    state.highlightZoneId = restored[0].id;
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
  }

  zoneListSignature = "";
  zoneMenuSignature = "";
  syncZoneControls();
  updateZoneListUi(performance.now());
  if (!panelMetrics.hidden) syncMetricsPickStep();
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
  resetGaitState(state.gait);
  state.trackDisplayId.clear();
}

function displayTrackId(id) {
  return state.trackDisplayId.get(id) ?? id;
}

function relinkTrackIdentity(serverId, priorIdentityId) {
  const canon = displayTrackId(priorIdentityId);
  if (serverId === canon) return;
  state.trackDisplayId.set(serverId, canon);
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
  const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
  const scale = cssWidth > 0 ? width / cssWidth : 1;
  const pad = {
    l: Math.round(40 * scale),
    r: Math.round(14 * scale),
    t: Math.round(12 * scale),
    b: Math.round(26 * scale),
  };
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

  const fontSize = Math.round(12 * scale);
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
  scheduleSaveSettings();
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

const METRIC_VIEW_LABELS = {
  overview: "Overview",
  crowd: "Crowd",
  traffic: "Traffic",
  zones: "Zones",
  walk: "Walk",
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
  if (state.metricsNavStep === "menu") {
    return;
  }

  const history = scopedCrowdHistory();
  const analysis = analyzeCrowd(history);

  if (analysis) {
    const peakLabel =
      analysis.peakCount === 1 ? "1 person" : `${Math.round(analysis.peakCount)} people`;
    metricsBusiest.textContent = `${peakLabel} at ${formatClock(analysis.peakTime)}`;
    metricsSummary.textContent = "";
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
  refreshGaitPanel();
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
  const { width, height } = metricsEntries;
  const scale = chartScale(metricsEntries);
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
  const pad = {
    l: Math.round(8 * scale),
    r: Math.round(8 * scale),
    t: Math.round(16 * scale),
    b: Math.round(20 * scale),
  };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const barW = plotW / keys.length;
  const countFont = `${Math.round(12 * scale)}px ui-sans-serif, system-ui, sans-serif`;

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
  metricsEntryCtx.font = `${Math.round(11 * scale)}px ui-sans-serif, system-ui, sans-serif`;
  metricsEntryCtx.textAlign = "center";
  metricsEntryCtx.textBaseline = "alphabetic";
  keys.forEach((key, i) => {
    if (keys.length > 6 && i % 2 === 1) return;
    const x = pad.l + i * barW + barW / 2;
    metricsEntryCtx.fillText(formatAxisTime(key), x, height - 3);
  });
}

function drawDwellChart() {
  if (!metricsDwell || !metricsDwellCtx) return;
  resizeChartCanvas(metricsDwell, metricsDwell.parentElement);
  const { width, height } = metricsDwell;
  const scale = chartScale(metricsDwell);
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
  const pad = {
    l: Math.round(8 * scale),
    r: Math.round(8 * scale),
    t: Math.round(16 * scale),
    b: Math.round(22 * scale),
  };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const barW = plotW / counts.length;
  const countFont = `${Math.round(12 * scale)}px ui-sans-serif, system-ui, sans-serif`;

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
  metricsDwellCtx.font = `${Math.round(11 * scale)}px ui-sans-serif, system-ui, sans-serif`;
  metricsDwellCtx.textAlign = "center";
  metricsDwellCtx.textBaseline = "alphabetic";
  DWELL_BINS.forEach((bin, i) => {
    const x = pad.l + i * barW + barW / 2;
    metricsDwellCtx.fillText(bin.label, x, height - 4);
  });
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
    metricsZonesCtx.font = `${Math.round(12 * scale)}px ui-sans-serif, system-ui, sans-serif`;
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

function gaitSummaryLine(serverId, features, match) {
  const labelId = displayTrackId(serverId);
  if (!features) return `#${labelId} — collecting steps…`;
  const pace = formatGaitPace(features.meanSpeed);
  const cadence = formatCadence(features.cadenceHz);
  let line = `#${labelId} · ${pace} · ${cadence}`;
  if (labelId !== serverId) {
    line += " · returned";
  } else if (match && !match.fromArchive) {
    line += ` · ${Math.round(match.score * 100)}% like #${match.priorId}`;
  }
  return line;
}

function refreshGaitPanel() {
  if (gaitSelectedSummary) {
    if (state.selectedId != null && state.tracks.has(state.selectedId)) {
      const f = state.gait.profiles.get(state.selectedId)?.features;
      const match = state.gait.matches.get(state.selectedId);
      gaitSelectedSummary.textContent = gaitSummaryLine(state.selectedId, f, match);
    } else {
      gaitSelectedSummary.textContent = "Click someone on the video to inspect their walk.";
    }
  }

  const ids = [...state.gait.profiles.keys()].sort((a, b) => a - b);
  const signature = ids
    .map((id) => {
      const f = state.gait.profiles.get(id)?.features;
      const m = state.gait.matches.get(id);
      return `${id}:${f?.n || 0}:${m?.priorId || ""}:${m?.score || 0}`;
    })
    .join("|");
  if (signature !== state.gait.listSignature) {
    state.gait.listSignature = signature;
    if (gaitTrackList) {
      gaitTrackList.replaceChildren();
      if (!ids.length) {
        const li = document.createElement("li");
        li.className = "gait-empty";
        li.textContent = "Tracking walks… need a few seconds of movement per person.";
        gaitTrackList.append(li);
      } else {
        for (const id of ids) {
          const f = state.gait.profiles.get(id)?.features;
          const match = state.gait.matches.get(id);
          const li = document.createElement("li");
          li.className = "gait-track-item";
          if (state.selectedId === id) li.classList.add("active");
          li.textContent = gaitSummaryLine(id, f, match);
          gaitTrackList.append(li);
        }
      }
    }
  }

  if (gaitMatchList) {
    gaitMatchList.replaceChildren();
    const rows = [...state.gait.matches.entries()].sort((a, b) => b[1].score - a[1].score);
    if (!rows.length) {
      const li = document.createElement("li");
      li.className = "gait-empty";
      li.textContent = "When someone leaves and returns, we compare movement style here.";
      gaitMatchList.append(li);
    } else {
      for (const [id, match] of rows) {
        const li = document.createElement("li");
        li.className = "gait-match-item";
        const labelId = displayTrackId(id);
        if (labelId !== id) {
          li.textContent = `#${labelId} returned (${Math.round(match.score * 100)}% same walk as before)`;
        } else {
          li.textContent = `#${id} may match earlier #${match.priorId} (${Math.round(match.score * 100)}% similar walk)`;
        }
        gaitMatchList.append(li);
      }
    }
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

function selectTab(tab) {
  const source = tab === "source";
  tabSource.classList.toggle("active", source);
  tabMetrics.classList.toggle("active", !source);
  tabSource.setAttribute("aria-selected", String(source));
  tabMetrics.setAttribute("aria-selected", String(!source));
  panelSource.hidden = !source;
  panelMetrics.hidden = source;
  if (!source) {
    if (state.zones.length && !state.metricsSelectedZoneIds.length) {
      state.metricsSelectedZoneIds = state.zones.map((zone) => zone.id);
      applyMetricsZoneSelection();
    }
    if (state.metricsScopeStep === "pick" || !metricsMainStep || metricsMainStep.hidden) {
      showMetricsMainStep();
      return;
    }
    if (state.metricsNavStep === "detail" && state.metricsActiveView) {
      showMetricsDetail(state.metricsActiveView);
    } else {
      showMetricsDetail("overview");
    }
    refreshMetrics();
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
  const x = state.mirror ? 1 - nx : nx;
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
  const corners = zoneCorners(zone);
  const samples = [
    [box.x + box.w * 0.5, box.y + box.h * 0.92],
    [box.x + box.w * 0.5, box.y + box.h * 0.78],
    [box.x + box.w * 0.15, box.y + box.h * 0.9],
    [box.x + box.w * 0.85, box.y + box.h * 0.9],
  ];
  return samples.some(([nx, ny]) => pointInPolygon(nx, ny, corners));
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
  scheduleSaveSettings();
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
    if (!panelMetrics.hidden) {
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
  ctx.fillStyle = draft ? "rgba(240, 224, 122, 0.16)" : rgbaFromHex(color, 0.22);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = (highlight || draft ? 3.5 : 2.5) * dpr;
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
      const anchor = trailAnchor(placed);
      state.trails.set(track.id, [{ x: anchor.x, y: anchor.y }]);
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
        relinkTrackIdentity(newId, priorId);
        state.gait.matches.set(newId, {
          priorId: displayTrackId(priorId),
          score,
          fromArchive: true,
          relinked: true,
        });
        refreshGaitPanel();
      },
    });
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
      archiveGaitProfile(state.gait, id, sessionSeconds(), displayTrackId(id));
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
  return { x: box.x + box.w / 2, y: box.y + box.h * 0.86 };
}

function rememberTrail(id, box) {
  const raw = trailAnchor(box);
  const history = state.trails.get(id) || [];
  if (history.sx == null) {
    history.sx = raw.x;
    history.sy = raw.y;
  } else {
    const k = 0.22;
    history.sx += (raw.x - history.sx) * k;
    history.sy += (raw.y - history.sy) * k;
  }
  const last = history[history.length - 1];
  if (!last || Math.hypot(history.sx - last.x, history.sy - last.y) > 0.006) {
    history.push({ x: history.sx, y: history.sy });
    if (history.length > 320) history.shift();
    state.trails.set(id, history);
  }
}

function chaikin(points) {
  if (points.length < 3) return points;
  const next = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
    next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
  }
  next.push(points[points.length - 1]);
  return next;
}

function strokeSmoothPath(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    return;
  }
  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function drawTrail(rect, id, history, box, color = TRACK_COLOR) {
  if (!history || history.length < 2) return;
  const dpr = overlay.width / Math.max(stage.clientWidth, 1);
  const points = history.map((point) => ({
    x: mapX(point.x, 0, rect),
    y: rect.y + point.y * rect.h,
  }));
  if (box) {
    const anchor = trailAnchor(box);
    points.push({
      x: mapX(anchor.x, 0, rect),
      y: rect.y + anchor.y * rect.h,
    });
  }
  const smooth = chaikin(chaikin(points));
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 10 * dpr;
  strokeSmoothPath(smooth);
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 4.5 * dpr;
  strokeSmoothPath(smooth);
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
  updateZoneListUi(now);

  drawCrop(selected);
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
  if (state.sourceKind === "camera") {
    activeSourceLine.textContent = "Now playing: Camera (not a benchmark clip).";
    return;
  }
  const name = state.sourceLabel || "Video";
  if (state.casiaBenchmark) {
    const sid = state.casiaSubjectId ? ` · subject ${state.casiaSubjectId}` : "";
    activeSourceLine.textContent = `Now playing: ${name} — CASIA-B gait silhouettes${sid}. Metrics → Walk.`;
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
    setMot17Hint("Official MOT17 train clips — press Use, then Metrics → Walk.");
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
    setCasiaBHint("Silhouette gait benchmark — pick subject → Use → Metrics → Walk.");
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
        ? `${seq.label}: ${seq.frames} frames · open Metrics → Walk for gait vs. session relinks.`
        : ""
    );
  } catch {
    setMot17Hint(
      "Could not load that MOT17 clip. Use http://localhost:5173 (npm run dev) or restart the backend after prepare_mot17.py.",
      true
    );
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

function wireUi({ signal }) {
  tabSource.addEventListener("click", () => selectTab("source"), { signal });
  tabMetrics.addEventListener("click", () => selectTab("metrics"), { signal });

  for (const btn of metricSubtabs) {
    btn.setAttribute("role", "menuitem");
    btn.addEventListener(
      "click",
      () => {
        if (panelMetrics.hidden) selectTab("metrics");
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

  if (zoneModeBtn) zoneModeBtn.addEventListener("click", toggleZoneMode, { signal });
  if (zoneClearBtn) zoneClearBtn.addEventListener("click", clearZones, { signal });
  if (zoneMetricsNext) zoneMetricsNext.addEventListener("click", goToMetricsMain, { signal });
  if (metricsChangeScope) metricsChangeScope.addEventListener("click", backToMetricsPick, { signal });

  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && state.zoneMode) {
        state.zoneDraft = null;
        zoneDragPointer = null;
        setZoneMode(false);
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
      if (state.zoneMode) return;
      if (cornerHandleHit(event)) {
        overlay.style.cursor = "grab";
        return;
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
      if (zoneDragPointer !== event.pointerId) return;
      zoneDragPointer = null;
      state.zoneDraft = null;
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
      const point = pointFromEvent(event);
      if (!point) return;
      const hit = trackAt(point.nx, point.ny);
      if (hit == null || hit === state.selectedId) {
        clearPersonSelection();
      } else {
        state.finishedTrail = null;
        state.selectedId = hit;
        updateFollowPopupChrome();
        refreshGaitPanel();
      }
    },
    { signal }
  );

  if (followPopupHead) {
    followPopupHead.addEventListener(
      "pointerdown",
      (event) => {
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

function applyMenuDock() {
  const main = document.querySelector("main");
  if (!main) return;
  main.classList.toggle("menu-bottom", state.menuDockBottom);
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

export function captureSessionSnapshot() {
  const durationSec = sessionSeconds();
  const crowdHistory = sortedCrowdHistory();
  const analysis = analyzeCrowd(crowdHistory);
  const heat = buildAveragedHeatGrid();
  const hotspot = heatmapHotspotFromGrid(heat.grid);
  const rankedZones = rankZonesByPopulation(state.zones);
  const leader = rankedZones[0];
  const entryTimes = [...state.entryTimes];
  const dwellTimes = [...state.dwellTimes];
  const uniqueCount = state.dwellTimes.length + state.trackLife.size;
  const walkSnap = exportGaitSnapshot(state.gait, { displayId: displayTrackId });

  const hasSignal =
    crowdHistory.length >= 2 ||
    entryTimes.length > 0 ||
    dwellTimes.length > 0 ||
    state.zones.some((z) => sortedZoneHistory(z).length >= 2);

  if (!state.running && !hasSignal) {
    return null;
  }

  return {
    v: 1,
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
    zones: rankedZones.map(({ zone, avg, peak, personSeconds, entries }) => ({
      id: zone.id,
      name: zone.name,
      color: zoneColor(zone),
      avgInZone: avg,
      peakInZone: peak,
      personSeconds,
      entries,
      history: sortedZoneHistory(zone).map((p) => ({ t: p.t, count: p.count })),
    })),
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

export function mountPeopleTracker(options = {}) {
  snapshotNavigateHandler = options.onOpenSnapshot ?? null;
  bindDom();
  loadSettings();
  const ac = new AbortController();
  wireUi({ signal: ac.signal });

  const metricsResize = () => {
    if (!panelMetrics.hidden && state.metricsNavStep === "detail") refreshMetrics();
  };
  stageResizeObserver = new ResizeObserver(() => {
    resize();
    clampFollowPopupPosition();
  });
  stageResizeObserver.observe(stage);
  metricsResizeObserver = new ResizeObserver(metricsResize);
  if (metricsChartWrap) metricsResizeObserver.observe(metricsChartWrap);
  if (panelMetrics) metricsResizeObserver.observe(panelMetrics);

  connect();
  void loadMot17Manifest();
  void loadCasiaBManifest();
  syncZoneControls();
  showMetricsPickStep();
  updateChartEmptyStates();
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
