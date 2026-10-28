/** Shared canvas helpers for analytics panels. */

export function rgbaFromHex(hex, alpha) {
  const h = String(hex || "").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function chartPad(scale, withYAxis = true) {
  return {
    l: Math.round((withYAxis ? 36 : 8) * scale),
    r: Math.round(12 * scale),
    t: Math.round(14 * scale),
    b: Math.round(26 * scale),
  };
}

function drawYGrid(ctx, pad, plotW, plotH, yMax, scale, width) {
  const fontSize = Math.round(10 * scale);
  ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(244, 241, 232, 0.1)";
  ctx.lineWidth = 1;
  const yAt = (v) => pad.t + plotH - (v / yMax) * plotH;
  const yStep = Math.max(1, Math.ceil(yMax / Math.max(2, Math.floor(plotH / (26 * scale)))));
  for (let tick = 0; tick <= yMax; tick += yStep) {
    const y = yAt(tick);
    ctx.fillText(String(tick), pad.l - 6, y);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(width - pad.r, y);
    ctx.stroke();
  }
}

export function expandHistory(history) {
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

/** Time window and vertical scale that stay put until the data outgrows them. */
export function stableChartDomain(points) {
  let t0 = Infinity;
  let t1 = -Infinity;
  let peak = 1;
  for (const point of points) {
    if (point.t < t0) t0 = point.t;
    if (point.t > t1) t1 = point.t;
    if (point.count > peak) peak = point.count;
  }
  if (!Number.isFinite(t0)) return { t0: 0, t1: 8, yMax: 4 };
  const span = Math.max(t1 - t0, 0.25);
  const step = span < 20 ? 2 : span < 60 ? 5 : span < 180 ? 10 : 30;
  const start = Math.floor(t0 / step) * step;
  const end = Math.ceil(Math.max(t1, start + step * 4) / step) * step;
  const ySteps = [4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100];
  let yMax = ySteps[ySteps.length - 1];
  for (const stepY of ySteps) {
    if (stepY >= peak) {
      yMax = stepY;
      break;
    }
  }
  if (peak > yMax) yMax = Math.ceil(peak / 20) * 20;
  return { t0: start, t1: Math.max(end, start + step), yMax };
}

export function downsampleSeries(history, maxPoints = 96) {
  const sorted = [...history].sort((a, b) => a.t - b.t);
  if (sorted.length <= maxPoints) return sorted;
  const domain = stableChartDomain(sorted);
  const bucket = Math.max((domain.t1 - domain.t0) / (maxPoints - 1), 0.05);
  const out = [sorted[0]];
  let nextEdge = domain.t0 + bucket;
  let last = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const point = sorted[i];
    if (point.t >= nextEdge && last !== out[out.length - 1]) out.push(last);
    while (point.t >= nextEdge) nextEdge += bucket;
    last = point;
  }
  if (last !== out[out.length - 1]) out.push(last);
  return out;
}

export function drawStyledTimeSeries(canvas, ctx, history, color, style, formatTime) {
  if (!canvas || !ctx) return false;
  const series = expandHistory(downsampleSeries(history));
  if (series.length < 2) return false;

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
  const scale = cssWidth > 0 ? width / cssWidth : 1;
  const pad = chartPad(scale);
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  if (plotW < 8 || plotH < 8) return false;
  const domain = stableChartDomain(series);
  const span = Math.max(domain.t1 - domain.t0, 0.25);
  const { yMax } = domain;

  const xAt = (t) => pad.l + ((t - domain.t0) / span) * plotW;
  const yAt = (count) => pad.t + plotH - (count / yMax) * plotH;

  drawYGrid(ctx, pad, plotW, plotH, yMax, scale, width);

  if (style === "bar") {
    const barW = Math.max(2, Math.min((plotW / series.length) * 0.72, plotW * 0.14));
    series.forEach((point) => {
      const cx = xAt(point.t);
      const y = yAt(point.count);
      const bh = pad.t + plotH - y;
      ctx.fillStyle = color;
      ctx.fillRect(cx - barW / 2, y, barW, bh);
    });
  } else {
    if (style === "area") {
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
      ctx.fillStyle = rgbaFromHex(color, 0.22);
      ctx.fill();
    }
    ctx.beginPath();
    series.forEach((point, index) => {
      const x = xAt(point.t);
      const y = yAt(point.count);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, 2 * scale);
    ctx.stroke();
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.font = `${Math.round(10 * scale)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(formatTime(domain.t0), pad.l, height - 4);
  ctx.textAlign = "right";
  ctx.fillText(formatTime(domain.t1), width - pad.r, height - 4);
  return true;
}

/** Multiple zone series with shared time axis (line / area / bar). */
function alignSeriesToSharedDomain(seriesList) {
  const withPoints = seriesList.filter((s) => s.history.length);
  if (!withPoints.length) return [];
  const t0 = Math.min(...withPoints.flatMap((s) => s.history.map((p) => p.t)));
  const t1 = Math.max(...withPoints.flatMap((s) => s.history.map((p) => p.t)));
  return withPoints.map((series) => {
    const sorted = [...series.history].sort((a, b) => a.t - b.t);
    const points = [];
    if (sorted[0].t > t0 + 0.001) points.push({ t: t0, count: 0 });
    for (const point of sorted) points.push(point);
    const last = points[points.length - 1];
    if (last.t < t1 - 0.001) points.push({ t: t1, count: last.count });
    if (points.length === 1) {
      points.unshift({ t: Math.max(0, points[0].t - 0.2), count: 0 });
    }
    return { ...series, history: points };
  });
}

export function drawMultiStyledTimeSeries(canvas, ctx, seriesList, style, formatTime) {
  if (!canvas || !ctx || !seriesList?.length) return false;
  const prepared = seriesList
    .map((s) => ({
      ...s,
      history: downsampleSeries(s.history || []),
    }))
    .filter((s) => s.history.length);
  const valid = alignSeriesToSharedDomain(prepared).filter((s) => s.history.length >= 2);
  if (!valid.length) return false;

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const allPoints = valid.flatMap((s) => s.history);
  const domain = stableChartDomain(allPoints);
  const span = Math.max(domain.t1 - domain.t0, 0.25);
  const { yMax } = domain;

  const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
  const scale = cssWidth > 0 ? width / cssWidth : 1;
  const pad = chartPad(scale);
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const xAt = (t) => pad.l + ((t - domain.t0) / span) * plotW;
  const yAt = (count) => pad.t + plotH - (count / yMax) * plotH;

  drawYGrid(ctx, pad, plotW, plotH, yMax, scale, width);

  const nSeries = valid.length;
  const groupBarW = Math.max(2, Math.min((plotW / 48) * 0.85, plotW * 0.12));
  const barW = groupBarW / Math.max(1, nSeries);

  if (style === "area") {
    for (const series of valid) {
      const sorted = series.history;
      const color = series.color || "#d6ee6a";
      ctx.beginPath();
      ctx.moveTo(xAt(sorted[0].t), pad.t + plotH);
      for (const point of sorted) ctx.lineTo(xAt(point.t), yAt(point.count));
      ctx.lineTo(xAt(sorted[sorted.length - 1].t), pad.t + plotH);
      ctx.closePath();
      ctx.fillStyle = rgbaFromHex(color, 0.28);
      ctx.fill();
    }
  }

  valid.forEach((series, seriesIndex) => {
    const color = series.color || "#d6ee6a";
    const sorted = series.history;

    if (style === "bar") {
      sorted.forEach((point) => {
        const cx = xAt(point.t) + (seriesIndex - (nSeries - 1) / 2) * barW;
        const y = yAt(point.count);
        const bh = pad.t + plotH - y;
        ctx.fillStyle = color;
        ctx.fillRect(cx - barW / 2, y, barW, bh);
      });
      return;
    }

    ctx.beginPath();
    sorted.forEach((point, index) => {
      const x = xAt(point.t);
      const y = yAt(point.count);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, 2.4 * scale);
    ctx.stroke();
  });

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.font = `${Math.round(10 * scale)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(formatTime(domain.t0), pad.l, height - 4);
  ctx.textAlign = "right";
  ctx.fillText(formatTime(domain.t1), width - pad.r, height - 4);
  return true;
}

/**
 * @param {object} [options]
 * @param {boolean} [options.yAxis]
 * @param {number} [options.maxBarWidthRatio] cap bar width when few buckets
 * @param {string} [options.yLabel] optional axis hint (e.g. "entries")
 */
export function drawStyledBuckets(canvas, ctx, labels, values, color, style, options = {}) {
  if (!canvas || !ctx || !values.length) return false;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
  const scale = cssWidth > 0 ? width / cssWidth : 1;
  const yAxis = options.yAxis !== false;
  const pad = chartPad(scale, yAxis);
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const maxVal = Math.max(1, ...values);
  const yMax = Math.ceil(maxVal);
  const n = values.length;
  const slotW = plotW / n;
  const maxBarW = plotW * (options.maxBarWidthRatio ?? 0.14);

  if (yAxis) drawYGrid(ctx, pad, plotW, plotH, yMax, scale, width);

  const yAt = (v) => pad.t + plotH - (v / yMax) * plotH;

  if (style === "line" || style === "area") {
    const points = values.map((v, i) => ({
      x: pad.l + i * slotW + slotW / 2,
      y: yAt(v),
    }));
    if (style === "area") {
      ctx.beginPath();
      ctx.moveTo(points[0].x, pad.t + plotH);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, pad.t + plotH);
      ctx.closePath();
      ctx.fillStyle = rgbaFromHex(color, 0.2);
      ctx.fill();
    }
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, 2 * scale);
    ctx.stroke();
    points.forEach((p, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2, 3 * scale), 0, Math.PI * 2);
      ctx.fill();
      if (values[i] > 0) {
        ctx.font = `${Math.round(10 * scale)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = "rgba(244, 241, 232, 0.95)";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(values[i]), p.x, p.y - 4);
      }
    });
  } else {
    values.forEach((val, i) => {
      const bh = (val / yMax) * plotH;
      const cx = pad.l + i * slotW + slotW / 2;
      const w = Math.min(slotW * 0.76, maxBarW);
      const x = cx - w / 2;
      if (val > 0) {
        ctx.fillStyle = color;
        ctx.fillRect(x, yAt(val), w, bh);
      } else {
        ctx.fillStyle = rgbaFromHex(color, 0.08);
        ctx.fillRect(x, pad.t + plotH - 2, w, 2);
      }
      if (val > 0) {
        ctx.font = `${Math.round(10 * scale)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = "rgba(244, 241, 232, 0.95)";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(val), cx, yAt(val) - 2);
      }
    });
  }

  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.font = `${Math.round(10 * scale)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  labels.forEach((label, i) => {
    if (!label) return;
    const x = pad.l + i * slotW + slotW / 2;
    ctx.fillText(label, x, height - 4);
  });

  if (options.yLabel && yAxis) {
    ctx.save();
    ctx.translate(10 * scale, pad.t + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(163, 158, 145, 0.65)";
    ctx.font = `${Math.round(9 * scale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(options.yLabel, 0, 0);
    ctx.restore();
  }
  return true;
}

/** Side-by-side bars per time bucket, one series per zone. */
export function drawGroupedZoneBuckets(canvas, ctx, labels, zoneSeries) {
  if (!canvas || !ctx || !labels.length || !zoneSeries.length) return false;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
  const scale = cssWidth > 0 ? width / cssWidth : 1;
  const pad = chartPad(scale);
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const n = labels.length;
  const slotW = plotW / n;
  let yMax = 1;
  for (const zs of zoneSeries) {
    for (const v of zs.values) yMax = Math.max(yMax, v);
  }
  yMax = Math.ceil(yMax);
  const yAt = (v) => pad.t + plotH - (v / yMax) * plotH;

  drawYGrid(ctx, pad, plotW, plotH, yMax, scale, width);

  const groupW = slotW * 0.78;
  const barW = groupW / zoneSeries.length;

  zoneSeries.forEach((zs, zi) => {
    zs.values.forEach((val, i) => {
      if (val <= 0) return;
      const cx = pad.l + i * slotW + slotW / 2;
      const x = cx - groupW / 2 + zi * barW + barW * 0.08;
      const w = barW * 0.84;
      const y = yAt(val);
      const bh = pad.t + plotH - y;
      ctx.fillStyle = zs.color;
      ctx.fillRect(x, y, w, bh);
    });
  });

  ctx.fillStyle = "rgba(163, 158, 145, 0.9)";
  ctx.font = `${Math.round(10 * scale)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  labels.forEach((label, i) => {
    if (!label) return;
    const x = pad.l + i * slotW + slotW / 2;
    ctx.fillText(label, x, height - 4);
  });
  return true;
}

export function medianOf(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
