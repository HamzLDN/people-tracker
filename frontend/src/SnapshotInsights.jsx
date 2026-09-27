function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatSec(sec) {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function CrowdSparkline({ history }) {
  if (!history?.length) return null;
  const max = Math.max(1, ...history.map((p) => p.count));
  return (
    <div className="snapshot-sparkline" aria-hidden>
      {history.map((p, i) => (
        <span
          key={`${p.t}-${i}`}
          className="snapshot-sparkline-bar"
          style={{ height: `${Math.max(4, (p.count / max) * 100)}%` }}
          title={`${p.count} at ${formatSec(p.t)}`}
        />
      ))}
    </div>
  );
}

function HeatMini({ grid, heatW, heatH }) {
  if (!grid?.length) return null;
  const peak = Math.max(...grid, 0.0001);
  return (
    <div
      className="snapshot-heat"
      style={{ gridTemplateColumns: `repeat(${heatW}, 1fr)` }}
      aria-label="Foot traffic heatmap"
    >
      {grid.map((v, i) => (
        <span
          key={i}
          className="snapshot-heat-cell"
          style={{ opacity: 0.12 + (v / peak) * 0.88 }}
        />
      ))}
    </div>
  );
}

export default function SnapshotInsights({ data, onBack }) {
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
            {data.session.sourceLabel} · {data.session.durationLabel} · captured {formatWhen(data.capturedAt)}
          </p>
        </div>
        <button type="button" className="btn primary" onClick={downloadJson}>
          Export JSON
        </button>
      </header>

      <div className="snapshot-body">
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

        <section className="snapshot-card">
          <h2>Insights</h2>
          <ul className="snapshot-insights">
            {data.insights.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>

        <div className="snapshot-grid">
          <section className="snapshot-card">
            <h2>Crowd over time</h2>
            {data.crowd.analysis && (
              <p className="snapshot-sub">
                Peak {Math.round(data.crowd.analysis.peakCount)} at {data.crowd.analysis.peakAtLabel}
                {data.crowd.analysis.rampAtLabel
                  ? ` · build-up from ${data.crowd.analysis.rampAtLabel}`
                  : ""}
              </p>
            )}
            <CrowdSparkline history={data.crowd.history} />
          </section>

          <section className="snapshot-card">
            <h2>Foot traffic heatmap</h2>
            {data.traffic.hotspot && (
              <p className="snapshot-sub">Hotspot: {data.traffic.hotspot.label}</p>
            )}
            <HeatMini grid={data.traffic.heatGrid} heatW={data.traffic.heatW} heatH={data.traffic.heatH} />
          </section>
        </div>

        {data.walk?.matches?.length > 0 && (
          <section className="snapshot-card">
            <h2>Walk similarity (experimental)</h2>
            <ul className="snapshot-insights">
              {data.walk.matches.map((m) => (
                <li key={`${m.trackId}-${m.priorId}`}>
                  Track #{m.trackId} · {Math.round(m.score * 100)}% similar to #{m.priorId}
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.zones.length > 0 && (
          <section className="snapshot-card">
            <h2>Zones compared</h2>
            <div className="snapshot-table-wrap">
              <table className="snapshot-table">
                <thead>
                  <tr>
                    <th scope="col">Zone</th>
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

        <div className="snapshot-grid">
          <section className="snapshot-card">
            <h2>Entries by time</h2>
            {data.people.entryBuckets.length === 0 ? (
              <p className="snapshot-sub">No entries recorded yet.</p>
            ) : (
              <ul className="snapshot-bars">
                {data.people.entryBuckets.map((b) => (
                  <li key={b.startSec}>
                    <span className="snapshot-bar-label">{formatSec(b.startSec)}</span>
                    <span className="snapshot-bar-track">
                      <span
                        className="snapshot-bar-fill"
                        style={{
                          width: `${(b.count / Math.max(...data.people.entryBuckets.map((x) => x.count))) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="snapshot-bar-value">{b.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="snapshot-card">
            <h2>Dwell time</h2>
            <ul className="snapshot-bars">
              {data.people.dwellBins.map((bin) => (
                <li key={bin.label}>
                  <span className="snapshot-bar-label">{bin.label}</span>
                  <span className="snapshot-bar-track">
                    <span
                      className="snapshot-bar-fill snapshot-bar-fill-muted"
                      style={{
                        width: `${bin.count ? (bin.count / Math.max(1, ...data.people.dwellBins.map((x) => x.count))) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <span className="snapshot-bar-value">{bin.count}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {data.performance.avgDetectMs != null && (
          <p className="snapshot-foot">
            Avg detect {Math.round(data.performance.avgDetectMs)} ms
            {data.performance.sampleFps != null ? ` · ~${data.performance.sampleFps} fps` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
