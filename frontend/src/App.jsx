import { useEffect, useState } from "react";

function ChartStyleBar({ styleKey }) {
  return (
    <div className="chart-style-bar" data-style-key={styleKey}>
      {["line", "bar", "area"].map((style) => (
        <button key={style} type="button" className="chart-style-btn" data-chart-style={style}>
          {style[0].toUpperCase() + style.slice(1)}
        </button>
      ))}
    </div>
  );
}
import { mountPeopleTracker } from "./tracker/engine.js";
import SnapshotInsights from "./SnapshotInsights.jsx";
import {
  clearPersistedSnapshot,
  loadSnapshotForView,
  persistSnapshot,
  readPersistedSnapshot,
} from "./snapshotStorage.js";

export default function App() {
  const [snapshot, setSnapshot] = useState(() => loadSnapshotForView());

  useEffect(() => {
    const unmount = mountPeopleTracker({
      onOpenSnapshot: (data) => {
        persistSnapshot(data);
        setSnapshot(data);
        window.location.hash = "#/snapshot";
      },
    });
    return unmount;
  }, []);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === "#/snapshot") {
        const saved = readPersistedSnapshot();
        if (saved) setSnapshot(saved);
        return;
      }
      setSnapshot(null);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const backFromSnapshot = () => {
    clearPersistedSnapshot();
    setSnapshot(null);
    if (window.location.hash === "#/snapshot") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  if (snapshot) {
    return <SnapshotInsights data={snapshot} onBack={backFromSnapshot} />;
  }

  if (window.location.hash === "#/snapshot") {
    return (
      <div className="snapshot-page snapshot-page-empty">
        <header className="snapshot-header">
          <button
            type="button"
            className="btn snapshot-back"
            onClick={() => {
              history.replaceState(null, "", window.location.pathname + window.location.search);
              setSnapshot(null);
            }}
          >
            ← Back to tracker
          </button>
        </header>
        <p className="snapshot-empty-msg">No saved snapshot in this tab. Open the tracker and take a new session snapshot.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="shell">
        <header className="topbar" id="topbar">
          <button type="button" className="primary" id="cameraBtn">
            Camera
          </button>
          <label className="btn">
            Open video
            <input id="file" type="file" accept="video/*" hidden />
          </label>
          <details className="samples">
            <summary className="btn">Samples</summary>
            <div className="samples-panel">
              <label className="samples-field">
                <span>MOT17</span>
                <div className="row">
                  <select id="mot17SampleSelect" aria-label="MOT17 train sequence">
                    <option value="">Loading…</option>
                  </select>
                  <button type="button" className="btn primary" id="useMot17Sample">
                    Use
                  </button>
                </div>
              </label>
              <p className="hint" id="mot17SampleHint" hidden />
              <label className="samples-field">
                <span>CASIA-B</span>
                <div className="row">
                  <select id="casiaBSampleSelect" aria-label="CASIA-B subject sequence">
                    <option value="">Loading…</option>
                  </select>
                  <button type="button" className="btn primary" id="useCasiaBSample">
                    Use
                  </button>
                </div>
              </label>
              <p className="hint" id="casiaBSampleHint" hidden />
              <label className="samples-field">
                <span>Recent</span>
                <div className="row">
                  <select id="savedProfileSelect" aria-label="Recent session">
                    <option value="">—</option>
                  </select>
                  <button type="button" className="btn primary" id="useRecentSession">
                    Use
                  </button>
                </div>
              </label>
              <p className="hint" id="activeSourceLine">No video loaded.</p>
              <p className="hint error" id="sourceError" hidden />
            </div>
          </details>
          <label className="check">
            <input id="mirror" type="checkbox" defaultChecked />
            Mirror
          </label>
          <label className="check">
            <input id="showPopulatedArea" type="checkbox" />
            Heatmap
          </label>
          <button type="button" className="btn" id="openSnapshot">
            Snapshot
          </button>
        </header>

        <section className="stage-wrap">
          <div className="stage" id="stage">
            <video id="video" autoPlay playsInline muted />
            <canvas id="overlay" />
            <div className="stage-tools" id="stageTools">
              <div className="draw-menu" id="drawMenu" role="toolbar" aria-label="Draw zones">
                <button type="button" className="btn draw-tool" id="drawBoxBtn">
                  Box
                </button>
                <button type="button" className="btn draw-tool" id="drawLineBtn">
                  Line
                </button>
                <button type="button" className="btn" id="zoneEditBtn" hidden>
                  Edit
                </button>
                <button type="button" className="btn" id="zoneDeleteBtn" hidden>
                  Delete
                </button>
                <button type="button" className="btn" id="zoneClearBtn" disabled>
                  Clear
                </button>
              </div>
            </div>
            <div className="empty" id="empty">
              <p>Start the camera, or open a video. Boxes are drawn on the people in frame.</p>
              <div className="empty-actions">
                <button type="button" className="primary" id="cameraBtnEmpty">
                  Use camera
                </button>
                <label className="btn">
                  Open video
                  <input id="fileEmpty" type="file" accept="video/*" hidden />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="chart-strip" id="panelMetrics" hidden>
          <div className="chart-strip-label">
            <span>People over time</span>
            <span id="chartScope">Whole frame</span>
          </div>
          <div className="chart-plot" id="metricsChartPlot">
            <canvas id="metricsChart" aria-label="People in frame over time" />
            <p className="chart-empty" id="metricsChartEmpty">
              Waiting for samples…
            </p>
          </div>
        </section>

        <aside className="inspector" id="inspector" hidden>
          <div className="inspector-body" id="inspectorBody">
          <section className="inspector-card" id="inspectorFrame">
            <h2>Frame</h2>
            <dl className="inspector-stats">
              <div>
                <dt>In frame</dt>
                <dd id="statNow">—</dd>
              </div>
              <div>
                <dt>Unique seen</dt>
                <dd id="statUnique">—</dd>
              </div>
              <div>
                <dt>Average</dt>
                <dd id="statAvg">—</dd>
              </div>
              <div>
                <dt>Busiest</dt>
                <dd id="metricsBusiest">—</dd>
              </div>
            </dl>
          </section>

          <section className="inspector-card" id="inspectorZone" hidden>
            <h2 id="inspectorZoneTitle">Zone</h2>
            <dl className="inspector-stats">
              <div>
                <dt>Inside</dt>
                <dd id="inspectorZoneNow">—</dd>
              </div>
              <div>
                <dt>Average</dt>
                <dd id="inspectorZoneAvg">—</dd>
              </div>
              <div>
                <dt>Entries</dt>
                <dd id="inspectorZoneEntries">—</dd>
              </div>
            </dl>
          </section>

          <section className="inspector-card" id="inspectorPerson" hidden>
            <p className="inspector-note" id="gaitSelectedSummary">
              Click a person on the video to lock the follow camera.
            </p>
          </section>

          <section className="inspector-zones" id="inspectorZones" hidden>
            <h2>Zones</h2>
            <ul className="zone-list" id="zoneList" aria-label="Count zones" />
          </section>
          </div>

          <section className="charts-dock" id="chartsDock">
            <div className="analysis-scope" id="analysisScope">
              <p className="hint analysis-scope-lead" id="analysisScopeLead">
                Tap a zone on the video to include it, or pick below.
              </p>
              <div className="zone-scope-list is-visible" id="zoneScopeList" />
              <div className="analysis-scope-empty" id="analysisScopeEmpty">
                <p className="hint analysis-scope-hint">
                  No zones on this video yet. Draw one on the frame, then tap it to select.
                </p>
                <button type="button" className="btn" id="analysisDrawZoneBtn">
                  Draw zone on video
                </button>
              </div>
              <div className="analysis-scope-actions">
                <button type="button" className="primary" id="analyticsScopeNext">
                  Next
                </button>
              </div>
            </div>
            <div className="charts-panel" id="chartsPanel">
              <div className="analytics-scope-summary" id="analyticsScopeSummary">
                <div className="analytics-zone-chips" id="analyticsZoneChips" />
                <button type="button" className="analytics-change-zones" id="analyticsChangeZones">
                  Change zones
                </button>
              </div>
              <div className="charts-tabs" role="tablist" aria-label="Metrics">
                <button type="button" className="charts-tab active" data-extra-tab="summary">
                  Summary
                </button>
                <button type="button" className="charts-tab" data-extra-tab="occupancy">
                  Occupancy
                </button>
                <button type="button" className="charts-tab" data-extra-tab="arrivals">
                  Arrivals
                </button>
                <button type="button" className="charts-tab" data-extra-tab="dwell">
                  Dwell
                </button>
                <button type="button" className="charts-tab" data-extra-tab="traffic">
                  Traffic
                </button>
                <button type="button" className="charts-tab" data-extra-tab="compare">
                  Compare
                </button>
                <button type="button" className="charts-tab" data-extra-tab="performance">
                  Performance
                </button>
              </div>
              <div className="charts-extra" data-extra-chart="summary">
                <div className="metrics-kpi-grid" id="metricsKpiGrid" />
                <ul className="metrics-insight-list" id="metricsInsightList" />
                <div className="metrics-zone-table-wrap" id="metricsZoneTableWrap" hidden>
                  <table className="metrics-zone-table">
                    <thead>
                      <tr>
                        <th>Zone</th>
                        <th>Now</th>
                        <th>Avg</th>
                        <th>Peak</th>
                        <th>Entries</th>
                      </tr>
                    </thead>
                    <tbody id="metricsZoneTableBody" />
                  </table>
                </div>
              </div>
              <div className="charts-extra" data-extra-chart="occupancy" hidden>
                <ChartStyleBar styleKey="occupancy" />
                <div className="charts-plot charts-plot-tall" id="metricsOccupancyPlot">
                  <canvas id="metricsOccupancy" aria-label="Occupancy over time" />
                  <p className="chart-empty">Waiting for occupancy…</p>
                </div>
              </div>
              <div className="charts-extra" data-extra-chart="arrivals" hidden>
                <ChartStyleBar styleKey="entries" />
                <p className="chart-caption" id="metricsEntriesCaption" hidden />
                <div className="charts-plot charts-plot-tall" id="metricsEntriesPlot">
                  <canvas id="metricsEntries" aria-label="Arrivals over time" />
                  <p className="chart-empty" id="metricsEntriesEmpty">Waiting for arrivals…</p>
                </div>
              </div>
              <div className="charts-extra" data-extra-chart="dwell" hidden>
                <ChartStyleBar styleKey="dwell" />
                <div className="charts-plot charts-plot-tall" id="metricsDwellPlot">
                  <canvas id="metricsDwell" aria-label="Dwell time" />
                  <p className="chart-empty" id="metricsDwellEmpty">Waiting for dwell samples…</p>
                </div>
              </div>
              <div className="charts-extra" data-extra-chart="traffic" hidden>
                <div className="charts-plot charts-plot-tall" id="metricsHeatPlot">
                  <canvas id="metricsHeat" aria-label="Traffic heatmap" />
                  <p className="chart-empty" id="metricsHeatEmpty">Waiting for traffic…</p>
                </div>
                <p className="metrics-hotspot-line" id="metricsHotspotLine" hidden />
              </div>
              <div className="charts-extra" data-extra-chart="compare" hidden>
                <div className="charts-plot charts-plot-tall" id="metricsZonesPlot">
                  <canvas id="metricsZonesChart" aria-label="Zone comparison" />
                  <p className="chart-empty" id="metricsZonesEmpty">Pick two or more zones to compare.</p>
                </div>
              </div>
              <div className="charts-extra" data-extra-chart="performance" hidden>
                <p className="chart-style-label">Detect time</p>
                <ChartStyleBar styleKey="perf" />
                <div className="charts-plot charts-plot-tall" id="metricsPerfPlot">
                  <canvas id="metricsPerf" aria-label="Detection time" />
                  <p className="chart-empty">Waiting for detection time…</p>
                </div>
                <p className="chart-style-label">Frame rate</p>
                <ChartStyleBar styleKey="fps" />
                <div className="charts-plot charts-plot-tall" id="metricsFpsPlot">
                  <canvas id="metricsFps" aria-label="Frames per second" />
                  <p className="chart-empty">Waiting for frame rate…</p>
                </div>
              </div>
            </div>
          </section>
          <div className="follow-popup" id="followPopup" hidden>
            <div className="follow-popup-head" id="followPopupHead">
              <span className="follow-popup-title" id="followPopupLabel">
                Person
              </span>
              <button
                type="button"
                className="follow-popup-close"
                id="followPopupClose"
                aria-label="Close follow view"
              >
                ×
              </button>
            </div>
            <canvas id="followPopupCanvas" aria-label="Follow zoom" />
            <div className="follow-resize" id="followResize" role="separator" aria-label="Drag to change follow camera height" />
          </div>
        </aside>
      </main>
    </div>
  );
}
