import { useEffect, useState } from "react";
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
              <button type="button" className="btn zone-mode-btn" id="zoneModeBtn">
                Draw zone
              </button>
              <button type="button" className="btn" id="zoneClearBtn" disabled>
                Clear zones
              </button>
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
          <div className="chart-plot">
            <canvas id="metricsChart" aria-label="People in frame over time" />
            <p className="chart-empty" id="metricsChartEmpty">
              Waiting for samples…
            </p>
          </div>
        </section>

        <aside className="inspector" id="inspector" hidden>
          <div className="inspector-body">
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
            </div>
            <p className="inspector-note" id="gaitSelectedSummary">
              Click someone on the video.
            </p>
          </section>

          <section className="inspector-zones" id="inspectorZones" hidden>
            <h2>Zones</h2>
            <ul className="zone-list" id="zoneList" aria-label="Count zones" />
          </section>
          </div>

          <section className="charts-dock" id="chartsDock">
            <div className="charts-panel" id="chartsPanel">
              <div className="charts-tabs" role="tablist" aria-label="More charts">
                <button type="button" className="charts-tab active" data-extra-tab="entries">
                  Entries
                </button>
                <button type="button" className="charts-tab" data-extra-tab="dwell">
                  Dwell
                </button>
                <button type="button" className="charts-tab" data-extra-tab="heat">
                  Heatmap
                </button>
                <button type="button" className="charts-tab" data-extra-tab="zones">
                  Zones
                </button>
                <button type="button" className="charts-tab" data-extra-tab="walk">
                  Walk
                </button>
              </div>
              <div className="combine-zones" id="combineZones">
                <p className="combine-label">Combine zones</p>
                <div className="combine-zone-list" id="combineZoneList" />
              </div>
              <div className="charts-plot" data-extra-chart="entries">
                <canvas id="metricsEntries" aria-label="Entries over time" />
                <p className="chart-empty" id="metricsEntriesEmpty">Waiting for entries…</p>
              </div>
              <div className="charts-plot" data-extra-chart="dwell" hidden>
                <canvas id="metricsDwell" aria-label="Dwell time distribution" />
                <p className="chart-empty" id="metricsDwellEmpty">Waiting for dwell samples…</p>
              </div>
              <div className="charts-plot" data-extra-chart="heat" hidden>
                <canvas id="metricsHeat" aria-label="Traffic heatmap" />
                <p className="chart-empty" id="metricsHeatEmpty">Waiting for traffic…</p>
              </div>
              <div className="charts-plot" data-extra-chart="zones" hidden>
                <canvas id="metricsZonesChart" aria-label="Zone comparison chart" />
                <p className="chart-empty" id="metricsZonesEmpty">Draw a zone to compare.</p>
              </div>
              <div className="charts-walk" data-extra-chart="walk" hidden>
                <p className="inspector-note">Path and pace only. Not face ID.</p>
                <h3>Active tracks</h3>
                <ul className="gait-track-list" id="gaitTrackList" />
                <h3>Similar walks</h3>
                <ul className="gait-match-list" id="gaitMatchList" />
              </div>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
