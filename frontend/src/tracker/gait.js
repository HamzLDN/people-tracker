const GAIT_SAMPLE_MAX = 96;
const GAIT_MIN_SAMPLES = 14;
export const GAIT_MATCH_THRESHOLD = 0.68;

export function createGaitState() {
  return {
    profiles: new Map(),
    archive: [],
    matches: new Map(),
    listSignature: "",
  };
}

function footFromBox(box) {
  return { x: box.x + box.w / 2, y: box.y + box.h * 0.92 };
}

function pathLength(samples) {
  let len = 0;
  for (let i = 1; i < samples.length; i += 1) {
    len += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  }
  return len;
}

function variance(nums) {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((s, v) => s + (v - mean) ** 2, 0) / nums.length;
}

function countSpeedPeaks(speeds) {
  if (speeds.length < 5) return 0;
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const floor = mean * 0.45;
  let peaks = 0;
  for (let i = 1; i < speeds.length - 1; i += 1) {
    if (speeds[i] < floor) continue;
    if (speeds[i] >= speeds[i - 1] && speeds[i] > speeds[i + 1]) peaks += 1;
  }
  return peaks;
}

export function computeGaitFeatures(samples) {
  if (samples.length < GAIT_MIN_SAMPLES) return null;

  const speeds = samples.map((s) => s.speed).filter((v) => v > 0.0005);
  const meanSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const speedStd = speeds.length > 1 ? Math.sqrt(variance(speeds)) : 0;

  const duration = samples[samples.length - 1].t - samples[0].t;
  const peaks = countSpeedPeaks(speeds);
  const cadenceHz = duration > 0.6 ? peaks / duration : 0;

  const dx = samples[samples.length - 1].x - samples[0].x;
  const dy = samples[samples.length - 1].y - samples[0].y;
  const len = pathLength(samples);
  const directness = len > 0.015 ? Math.hypot(dx, dy) / len : 0;

  const xs = samples.map((s) => s.x);
  const ys = samples.map((s) => s.y);
  const lateralVar = variance(xs) + variance(ys) * 0.35;

  return {
    meanSpeed,
    speedStd,
    cadenceHz,
    directness,
    lateralVar,
    n: samples.length,
    duration,
  };
}

function featureVector(f) {
  return [
    f.meanSpeed,
    f.cadenceHz * 0.55,
    f.directness,
    f.speedStd * 2.5,
    Math.sqrt(f.lateralVar) * 3,
  ];
}

export function gaitSimilarity(fa, fb) {
  if (!fa || !fb) return 0;
  const a = featureVector(fa);
  const b = featureVector(fb);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na < 1e-10 || nb < 1e-10) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function updateGaitProfile(gait, id, box, tSec) {
  let profile = gait.profiles.get(id);
  if (!profile) {
    profile = { footSamples: [], features: null };
    gait.profiles.set(id, profile);
  }
  const foot = footFromBox(box);
  const samples = profile.footSamples;
  const last = samples[samples.length - 1];
  let speed = 0;
  if (last) {
    const dt = tSec - last.t;
    if (dt > 0.02 && dt < 1.5) {
      speed = Math.hypot(foot.x - last.x, foot.y - last.y) / dt;
    }
  }
  samples.push({ t: tSec, x: foot.x, y: foot.y, speed });
  if (samples.length > GAIT_SAMPLE_MAX) samples.shift();
  profile.features = computeGaitFeatures(samples);
  return profile.features;
}

export function archiveGaitProfile(gait, id, endedAt, identityId = id) {
  const profile = gait.profiles.get(id);
  if (!profile?.features) {
    gait.profiles.delete(id);
    gait.matches.delete(id);
    return;
  }
  gait.archive.push({
    id: identityId,
    features: { ...profile.features },
    endedAt,
  });
  if (gait.archive.length > 32) gait.archive.shift();
  gait.profiles.delete(id);
  gait.matches.delete(id);
}

export function tryGaitMatch(gait, id, { identityId, onReappear } = {}) {
  const profile = gait.profiles.get(id);
  if (!profile?.features || profile.features.n < GAIT_MIN_SAMPLES) return;
  const who = identityId?.(id) ?? id;
  if (gait.matches.has(id)) return;

  let best = null;
  for (const entry of gait.archive) {
    if (entry.id === who) continue;
    const score = gaitSimilarity(profile.features, entry.features);
    if (score >= GAIT_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { priorId: entry.id, score, fromArchive: true };
    }
  }

  for (const [otherId, other] of gait.profiles) {
    if (otherId === id || !other.features || other.features.n < GAIT_MIN_SAMPLES) continue;
    const otherWho = identityId?.(otherId) ?? otherId;
    if (otherWho === who) continue;
    const score = gaitSimilarity(profile.features, other.features);
    if (score >= GAIT_MATCH_THRESHOLD + 0.05 && (!best || score > best.score)) {
      best = { priorId: otherWho, score, live: true };
    }
  }

  if (!best) return;

  gait.matches.set(id, best);
  if (best.fromArchive && onReappear) {
    onReappear(id, best.priorId, best.score);
  }
}

export function resetGaitState(gait) {
  gait.profiles.clear();
  gait.archive.length = 0;
  gait.matches.clear();
  gait.listSignature = "";
}

export function formatGaitPace(meanSpeed) {
  if (!meanSpeed || meanSpeed < 0.002) return "Still / slow";
  const rel = meanSpeed * 100;
  if (rel < 2.5) return "Slow walk";
  if (rel < 6) return "Normal walk";
  if (rel < 12) return "Brisk walk";
  return "Fast move";
}

export function formatCadence(cadenceHz) {
  if (!cadenceHz || cadenceHz < 0.3) return "—";
  const stepsPerMin = cadenceHz * 60;
  return `~${Math.round(stepsPerMin)} steps/min (est.)`;
}

export function exportGaitSnapshot(gait, { displayId } = {}) {
  const active = [];
  for (const [id, profile] of gait.profiles) {
    if (!profile.features) continue;
    const match = gait.matches.get(id);
    const labelId = displayId?.(id) ?? id;
    active.push({
      id,
      labelId,
      features: profile.features,
      match: match ? { priorId: match.priorId, score: match.score, relinked: Boolean(match.relinked) } : null,
    });
  }
  return {
    active,
    archive: gait.archive.map((e) => ({ id: e.id, features: e.features, endedAt: e.endedAt })),
    matches: [...gait.matches.entries()].map(([id, m]) => ({
      trackId: id,
      labelId: displayId?.(id) ?? id,
      priorId: m.priorId,
      score: m.score,
      relinked: Boolean(m.relinked),
    })),
  };
}
