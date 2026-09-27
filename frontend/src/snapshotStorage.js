const SNAPSHOT_STORAGE_KEY = "peopleTracker.snapshot.v1";

export function persistSnapshot(data) {
  try {
    sessionStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota or private mode */
  }
}

export function readPersistedSnapshot() {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPersistedSnapshot() {
  sessionStorage.removeItem(SNAPSHOT_STORAGE_KEY);
}

export function loadSnapshotForView() {
  if (window.location.hash !== "#/snapshot") return null;
  return readPersistedSnapshot();
}
