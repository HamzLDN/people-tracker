import { useEffect, useRef, useState } from "react";
import {
  drawGroupedZoneBuckets,
  drawMultiStyledTimeSeries,
  drawStyledBuckets,
  drawStyledTimeSeries,
  rgbaFromHex,
} from "./tracker/metricsCharts.js";

const TABS = [
  ["summary", "Summary"],
  ["occupancy", "Occupancy"],
  ["arrivals", "Arrivals"],
  ["dwell", "Dwell"],
  ["traffic", "Traffic"],
  ["compare", "Compare"],
  ["performance", "Performance"],
];

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatAxisTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ChartFrame({ label, draw, empty = "No samples for this chart." }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const paint = () => {
      const bounds = wrap.getBoundingClientRect();
      if (bounds.width < 8 || bounds.height < 8) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(bounds.width * dpr);
      const height = Math.round(bounds.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext("2d");
      const ok = Boolean(drawRef.current(canvas, ctx));
      wrap.classList.toggle("is-ready", ok);
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className="snapshot-chart">
      {label ? <figcaption className="chart-style-label">{label}</figcaption> : null}
      <div className="charts-plot charts-plot-tall snapshot-plot" ref={wrapRef}>
        <canvas ref={canvasRef} aria-label={label || "Chart"} />
        <p className="chart-empty">{empty}</p>
      </div>
    </figure>
  );
}

function Legend({ items }) {
  if (!items?.length) return null;
  return (
    <div className="snapshot-legend">
      {items.map((item) => (
        <span key={item.label} className="chart-legend-item">
          <span className="snapshot-zone-swatch" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function drawHeat(canvas, ctx, grid, heatW, heatH) {
  if (!grid?.length || !heatW || !heatH) return false;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const peak = Math.max(...grid, 0);
  if (peak <= 0) return false;
  const pad = 8;
  const availW = width - pad * 2;
  const availH = height - pad * 2;
  const gridAspect = heatW / heatH;
  let plotW = availW;
  let plotH = plotW / gridAspect;
  if (plotH > availH) {
    plotH = availH;
    plotW = plotH * gridAspect;
  }
  const originX = pad + (availW - plotW) / 2;
  const originY = pad + (availH - plotH) / 2;
  const cellW = plotW / heatW;
  const cellH = plotH / heatH;
  for (let y = 0; y < heatH; y += 1) {
    for (let x = 0; x < heatW; x += 1) {
      const raw = grid[y * heatW + x];
      const v = raw / peak;
      if (v <= 0) continue;
      ctx.fillStyle = `rgba(214, 238, 106, ${0.08 + v * 0.82})`;
      ctx.fillRect(originX + x * cellW, originY + y * cellH, cellW + 0.5, cellH + 0.5);
    }
  }
  return true;
}

function drawRankBars(canvas, ctx, rows, valueOf, format) {
  if (!rows?.length) return false;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const max = Math.max(...rows.map(valueOf), 0.05);
  if (!rows.some((row) => valueOf(row) > 0)) return false;
  const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
  const scale = cssWidth > 0 ? width / cssWidth : 1;
  const pad = { l: 12 * scale, r: 160 * scale, t: 10 * scale, b: 10 * scale };
  const rowH = (height - pad.t - pad.b) / rows.length;
  const barH = Math.max(4, rowH * 0.62);
  const plotW = width - pad.l - pad.r;
  rows.forEach((row, i) => {
    const y = pad.t + i * rowH + (rowH - barH) / 2;
    const barW = Math.max(2, (valueOf(row) / max) * plotW);
    ctx.fillStyle = rgbaFromHex(row.color || "#d6ee6a", 0.9);
    ctx.fillRect(pad.l, y, barW, barH);
    ctx.fillStyle = "rgba(244, 241, 232, 0.92)";
    ctx.font = `${Math.round(12 * scale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(format(row), pad.l + barW + 8, y + barH / 2);
  });
  return true;
}

function chartsOf(data) {
  if (data.charts) return data.charts;
  const buckets = data.people?.entryBuckets || [];
  const bins = data.people?.dwellBins || [];
  return {
    scope: "Whole frame",
    summary: null,
    occupancy: {
      multi: false,
      style: "line",
      color: "#d6ee6a",
      history: data.crowd?.history || [],
    },
    arrivals: buckets.length
      ? {
          multi: false,
          style: "bar",
          color: "#d6ee6a",
          labels: buckets.map((b) => formatAxisTime(b.startSec)),
          values: buckets.map((b) => b.count),
          caption: `${data.people.totalEntries} entries`,
        }
      : null,
    dwell: {
      multi: false,
      style: "bar",
      color: "#7ad7f0",
      labels: bins.map((b) => b.label),
      values: bins.map((b) => b.count),
      total: bins.reduce((sum, b) => sum + b.count, 0),
    },
    compare: (data.zones || []).map((z) => ({
      name: z.name,
      color: z.color,
      avg: z.avgInZone,
    })),
    performance: {
      detect: data.performance?.detect || [],
      fps: data.performance?.fps || [],
      detectStyle: "line",
      fpsStyle: "line",
    },
  };
}

export default function SnapshotInsights({ data, onBack }) {
  const [tab, setTab] = useState("summary");
  const charts = chartsOf(data);
  const showNow = (data.zones || []).some((z) => z.now != null);

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `people-tracker-snapshot-${data.capturedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const peak = data.crowd.analysis?.peakCount;
  const avg = data.crowd.average;

  return (
    <div className="snapshot-page">
      <header className="snapshot-header">
        <button type="button" className="btn snapshot-back" onClick={onBack}>
          ← Back to tracker
        </button>
        <div className="snapshot-header-main">
          <h1 className="snapshot-title">Session snapshot</h1>
          <p className="snapshot-meta">
            {data.session.sourceLabel} · {data.session.durationLabel} · {charts.scope || "Whole frame"} · captured{" "}
            {formatWhen(data.capturedAt)}
          </p>
        </div>
        <button type="button" className="btn primary" onClick={downloadJson}>
          Export JSON
        </button>
      </header>

      <div className="snapshot-body">
        <div className="charts-tabs snapshot-tabs" role="tablist" aria-label="Snapshot charts">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`charts-tab${tab === id ? " active" : ""}`}
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "summary" && (
          <>
            {charts.summary?.multi ? (
              <section className="snapshot-zone-summary" aria-label="Key metrics">
                {charts.summary.zones.map((zone) => (
                  <div className="snapshot-zone-row" key={zone.name}>
                    <span className="snapshot-zone-row-name">
                      <span className="snapshot-zone-swatch" style={{ background: zone.color }} />
                      {zone.name}
                    </span>
                    <span>
                      Now {zone.now} · Avg {zone.avg != null ? zone.avg.toFixed(1) : "—"} · {zone.entries} entries · Peak{" "}
                      {zone.busiest}
                    </span>
                  </div>
                ))}
              </section>
            ) : charts.summary?.cards ? (
              <section className="snapshot-kpis" aria-label="Key metrics">
                {charts.summary.cards.map((card) => (
                  <div className="snapshot-kpi" key={card.label}>
                    <span className="snapshot-kpi-label">{card.label}</span>
                    <strong className={card.label === "Scope" ? "snapshot-kpi-wide" : undefined}>{card.value}</strong>
                  </div>
                ))}
              </section>
            ) : (
              <section className="snapshot-kpis" aria-label="Key metrics">
                <div className="snapshot-kpi">
                  <span className="snapshot-kpi-label">Peak in frame</span>
                  <strong>{peak != null ? Math.round(peak) : "—"}</strong>
                </div>
                <div className="snapshot-kpi">
                  <span className="snapshot-kpi-label">Average in frame</span>
                  <strong>{avg != null ? avg.toFixed(1) : "—"}</strong>
                </div>
                <div className="snapshot-kpi">
                  <span className="snapshot-kpi-label">Unique seen</span>
                  <strong>{data.people.uniqueSeen || "—"}</strong>
                </div>
                <div className="snapshot-kpi">
                  <span className="snapshot-kpi-label">Frame entries</span>
                  <strong>{data.people.totalEntries}</strong>
                </div>
                <div className="snapshot-kpi">
                  <span className="snapshot-kpi-label">Median dwell</span>
                  <strong>
                    {data.people.medianDwellSec != null ? `${data.people.medianDwellSec.toFixed(1)}s` : "—"}
                  </strong>
                </div>
                <div className="snapshot-kpi">
                  <span className="snapshot-kpi-label">Busiest area</span>
                  <strong className="snapshot-kpi-wide">{data.traffic.busiestSummary || "—"}</strong>
                </div>
              </section>
            )}

            <section className="snapshot-card">
              <h2>Insights</h2>
              <ul className="snapshot-insights">
                {data.insights.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>

            {data.zones.length > 0 && (
              <section className="snapshot-card">
                <h2>Zones</h2>
                <div className="snapshot-table-wrap">
                  <table className="snapshot-table">
                    <thead>
                      <tr>
                        <th scope="col">Zone</th>
                        {showNow && <th scope="col">Now</th>}
                        <th scope="col">Avg inside</th>
                        <th scope="col">Peak</th>
                        <th scope="col">Person·seconds</th>
                        <th scope="col">Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.zones.map((z) => (
                        <tr key={z.id}>
                          <td>
                            <span className="snapshot-zone-swatch" style={{ background: z.color }} />
                            {z.name}
                          </td>
                          {showNow && <td>{z.now}</td>}
                          <td>{z.avgInZone.toFixed(1)}</td>
                          <td>{z.peakInZone}</td>
                          <td>{z.personSeconds.toFixed(0)}</td>
                          <td>{z.entries}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {tab === "occupancy" && (
          <section className="snapshot-card">
            <h2>Occupancy</h2>
            <p className="snapshot-sub">{charts.scope || "Whole frame"} · people over time</p>
            {charts.occupancy?.multi && <Legend items={charts.occupancy.series} />}
            <ChartFrame
              label="People over time"
              empty="Waiting for occupancy…"
              draw={(canvas, ctx) => {
                const occ = charts.occupancy;
                if (!occ) return false;
                if (occ.multi) {
                  return drawMultiStyledTimeSeries(canvas, ctx, occ.series, occ.style || "line", formatAxisTime);
                }
                return drawStyledTimeSeries(canvas, ctx, occ.history, occ.color, occ.style || "line", formatAxisTime);
              }}
            />
          </section>
        )}

        {tab === "arrivals" && (
          <section className="snapshot-card">
            <h2>Arrivals</h2>
            {charts.arrivals?.caption && <p className="snapshot-sub">{charts.arrivals.caption}</p>}
            {charts.arrivals?.multi && <Legend items={charts.arrivals.zoneSeries} />}
            <ChartFrame
              label="Arrivals over time"
              empty="Waiting for arrivals…"
              draw={(canvas, ctx) => {
                const arrivals = charts.arrivals;
                if (!arrivals) return false;
                const style = arrivals.style || "bar";
                if (arrivals.multi) {
                  if (style === "line" || style === "area") {
                    return drawMultiStyledTimeSeries(
                      canvas,
                      ctx,
                      arrivals.zoneSeries,
                      style,
                      formatAxisTime
                    );
                  }
                  return drawGroupedZoneBuckets(canvas, ctx, arrivals.labels, arrivals.zoneSeries);
                }
                if (style === "line" || style === "area") {
                  return drawStyledTimeSeries(canvas, ctx, arrivals.series, arrivals.color, style, formatAxisTime);
                }
                return drawStyledBuckets(canvas, ctx, arrivals.labels, arrivals.values, arrivals.color, style, {
                  yAxis: true,
                  yLabel: "entries / window",
                  maxBarWidthRatio: 0.12,
                });
              }}
            />
          </section>
        )}

        {tab === "dwell" && (
          <section className="snapshot-card">
            <h2>Dwell</h2>
            <p className="snapshot-sub">
              {charts.dwell?.multi ? "Median time inside each zone" : "How long people stayed"}
            </p>
            <ChartFrame
              label="Dwell time"
              empty="Waiting for dwell samples…"
              draw={(canvas, ctx) => {
                const dwell = charts.dwell;
                if (!dwell) return false;
                if (dwell.multi) {
                  return drawRankBars(
                    canvas,
                    ctx,
                    dwell.rows,
                    (row) => row.median,
                    (row) => `${row.name} · ${row.median.toFixed(1)}s med (${row.samples})`
                  );
                }
                if (!dwell.total) return false;
                return drawStyledBuckets(canvas, ctx, dwell.labels, dwell.values, dwell.color, dwell.style || "bar", {
                  yAxis: true,
                  yLabel: "people",
                  maxBarWidthRatio: 0.22,
                });
              }}
            />
          </section>
        )}

        {tab === "traffic" && (
          <section className="snapshot-card">
            <h2>Traffic</h2>
            {data.traffic.hotspot && <p className="snapshot-sub">Hotspot: {data.traffic.hotspot.label}</p>}
            <ChartFrame
              label="Foot traffic"
              empty="Waiting for traffic…"
              draw={(canvas, ctx) =>
                drawHeat(canvas, ctx, data.traffic.heatGrid, data.traffic.heatW, data.traffic.heatH)
              }
            />
          </section>
        )}

        {tab === "compare" && (
          <section className="snapshot-card">
            <h2>Compare</h2>
            <p className="snapshot-sub">Average people inside each zone</p>
            <ChartFrame
              label="Zone comparison"
              empty="Pick two or more zones to compare."
              draw={(canvas, ctx) =>
                drawRankBars(
                  canvas,
                  ctx,
                  charts.compare || [],
                  (row) => row.avg,
                  (row) => `${row.name} · ${row.avg.toFixed(1)}`
                )
              }
            />
          </section>
        )}

        {tab === "performance" && (
          <section className="snapshot-card">
            <h2>Performance</h2>
            <p className="snapshot-sub">
              {charts.performance?.avgDetectMs != null
                ? `Avg detect ${Math.round(charts.performance.avgDetectMs)} ms`
                : data.performance.avgDetectMs != null
                  ? `Avg detect ${Math.round(data.performance.avgDetectMs)} ms`
                  : "Detection time and frame rate"}
              {charts.performance?.lastFps != null ? ` · ${charts.performance.lastFps.toFixed(1)} fps` : ""}
            </p>
            <ChartFrame
              label="Detect time"
              empty="Waiting for detection time…"
              draw={(canvas, ctx) =>
                drawStyledTimeSeries(
                  canvas,
                  ctx,
                  charts.performance?.detect || [],
                  "#f0a37a",
                  charts.performance?.detectStyle || "line",
                  formatAxisTime
                )
              }
            />
            <ChartFrame
              label="Frame rate"
              empty="Waiting for frame rate…"
              draw={(canvas, ctx) =>
                drawStyledTimeSeries(
                  canvas,
                  ctx,
                  charts.performance?.fps || [],
                  "#7ad7f0",
                  charts.performance?.fpsStyle || "line",
                  formatAxisTime
                )
              }
            />
          </section>
        )}
      </div>
    </div>
  );
}
