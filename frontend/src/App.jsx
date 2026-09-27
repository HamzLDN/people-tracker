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
      <main>
        <section className="stage-wrap">
          <div className="stage" id="stage">
            <video id="video" autoPlay playsInline muted />
            <canvas id="overlay" />
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

        <aside className="sidebar">
          <table className="hud" id="hud" aria-label="Live stats" hidden>
            <thead>
              <tr>
                <th scope="col">People</th>
                <th scope="col">Detect</th>
                <th scope="col">FPS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td id="peopleStat">0 people</td>
                <td id="detectStat">— ms</td>
                <td id="fpsStat">— fps</td>
              </tr>
            </tbody>
          </table>

          <div className="sidebar-controls" id="sidebarControls" hidden>
            <div className="row">
              <button type="button" className="primary" id="cameraBtn">
                Use camera
              </button>
              <label className="btn">
                Open video
                <input id="file" type="file" accept="video/*" hidden />
              </label>
            </div>
            <label className="check">
              <input id="mirror" type="checkbox" defaultChecked />
              Mirror camera
            </label>
            <label className="check">
              <input id="showPopulatedArea" type="checkbox" />
              Show traffic heatmap on video
            </label>
          </div>

          <div className="tabs" id="sidebarTabs" role="tablist" aria-label="Sidebar panels" hidden>
            <button
              type="button"
              className="tab active"
              id="tabSource"
              role="tab"
              aria-selected="true"
              aria-controls="panelSource"
            >
              Source
            </button>
            <button
              type="button"
              className="tab"
              id="tabMetrics"
              role="tab"
              aria-selected="false"
              aria-controls="panelMetrics"
            >
              Metrics
            </button>
          </div>

          <div className="sidebar-body">
            <div className="panel" id="panelSource" role="tabpanel" aria-labelledby="tabSource">
              <section className="source-panel">
                <div className="saved-setups" id="savedSetups" aria-label="Recent sessions">
                  <span className="saved-setups-label">Select session</span>
                  <div className="row saved-setups-use">
                    <select id="savedProfileSelect" className="saved-profile-select" aria-label="Recent session">
                      <option value="">—</option>
                    </select>
                    <button type="button" className="btn primary" id="useRecentSession">
                      Use
                    </button>
                  </div>
                  <p className="hint error" id="sourceError" hidden />
                </div>
                <div className="zones-toolbar">
                  <button type="button" className="btn zone-mode-btn" id="zoneModeBtn">
                    Draw zone
                  </button>
                  <button type="button" className="btn" id="zoneClearBtn" disabled>
                    Clear all
                  </button>
                </div>
                <ul className="zone-list" id="zoneList" aria-label="Count zones" />
              </section>
            </div>

            <div className="panel" id="panelMetrics" role="tabpanel" aria-labelledby="tabMetrics" hidden>
              <section className="metrics">
                <section className="metrics-pick-step" id="metricsPickStep" aria-label="Choose zones">
                  <p className="panel-hint" id="zoneMetricsHint">
                    Tap each zone to include it. Then press <strong>Next</strong>.
                  </p>
                  <p className="zone-metrics-prompt" id="zoneMetricsPrompt" hidden />
                  <div
                    className="zone-pick-list"
                    id="zoneMetricsMenu"
                    role="listbox"
                    aria-label="Zones to include"
                  />
                  <button type="button" className="btn primary zone-metrics-next" id="zoneMetricsNext" disabled>
                    Next
                  </button>
                </section>

                <div className="metrics-main-step" id="metricsMainStep" hidden>
                  <div className="metrics-scope-bar">
                    <span className="metrics-scope-label" id="metricsScopeLabel">
                      —
                    </span>
                    <button type="button" className="btn metrics-change-scope" id="metricsChangeScope">
                      Change
                    </button>
                  </div>

                  <div className="metrics-menu-step" id="metricsMenuStep" aria-label="Choose report">
                    <button type="button" className="btn primary snapshot-open-btn" id="openSnapshot">
                      Session snapshot
                    </button>
                    <div className="metrics-subtabs" role="menu">
                      <button type="button" className="metrics-subtab" data-metric="overview">
                        Overview
                      </button>
                      <button type="button" className="metrics-subtab" data-metric="crowd">
                        Crowd
                      </button>
                      <button type="button" className="metrics-subtab" data-metric="traffic">
                        Traffic
                      </button>
                      <button type="button" className="metrics-subtab" data-metric="zones">
                        Zones
                      </button>
                      <button type="button" className="metrics-subtab" data-metric="walk">
                        Walk
                      </button>
                    </div>
                  </div>

                  <div className="metrics-detail-step" id="metricsDetailStep" hidden>
                    <div className="metrics-detail-head">
                      <button type="button" className="btn metrics-back" id="metricsBack">
                        ← Back
                      </button>
                      <span className="metrics-detail-title" id="metricsDetailTitle">
                        Overview
                      </span>
                    </div>
                    <div className="metrics-detail-body">
                  <div className="metric-view" id="metricOverview" data-metric="overview" hidden>
                    <p className="metrics-summary" id="metricsSummary">
                      People in frame over time. Run the video for a few seconds to fill the charts.
                    </p>
                    <div className="metrics-chart-wrap metrics-chart-main">
                      <span className="metrics-y-label">People in frame</span>
                      <canvas id="metricsChart" aria-label="People in frame over time" />
                      <p className="chart-empty" id="metricsChartEmpty">
                        Waiting for samples…
                      </p>
                    </div>
                    <dl className="metrics-facts">
                      <div className="metrics-fact-full">
                        <dt>Most populated area</dt>
                        <dd id="metricsBusiestArea">—</dd>
                      </div>
                      <div className="metrics-fact-full">
                        <dt>Busiest at</dt>
                        <dd id="metricsBusiest">—</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="metric-view" id="metricCrowd" data-metric="crowd" hidden>
                    <div className="stat-row">
                      <div className="stat-pill">
                        <span className="stat-pill-label">Unique seen</span>
                        <strong id="statUnique">—</strong>
                      </div>
                      <div className="stat-pill">
                        <span className="stat-pill-label">Avg in frame</span>
                        <strong id="statAvg">—</strong>
                      </div>
                    </div>
                    <div className="metrics-grid">
                      <div className="metrics-mini">
                        <span className="metrics-mini-label">Entries</span>
                        <canvas id="metricsEntries" aria-label="Entries over time" />
                        <p className="chart-empty" id="metricsEntriesEmpty">
                          Waiting for entries…
                        </p>
                      </div>
                      <div className="metrics-mini">
                        <span className="metrics-mini-label">Dwell</span>
                        <canvas id="metricsDwell" aria-label="Dwell time distribution" />
                        <p className="chart-empty" id="metricsDwellEmpty">
                          Waiting for dwell samples…
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="metric-view" id="metricTraffic" data-metric="traffic" hidden>
                    <p className="panel-hint">Where people spend time — ranked zones and frame heatmap.</p>
                    <dl className="metrics-facts">
                      <div className="metrics-fact-full">
                        <dt>Busiest area</dt>
                        <dd id="trafficBusiestArea">—</dd>
                      </div>
                    </dl>
                    <div className="metrics-mini metrics-mini-wide">
                      <span className="metrics-mini-label">Heatmap</span>
                      <canvas id="metricsHeat" aria-label="Traffic heatmap" />
                      <p className="chart-empty" id="metricsHeatEmpty">
                        Waiting for traffic…
                      </p>
                    </div>
                    <ol className="traffic-zone-rank" id="trafficZoneRank" />
                  </div>

                  <div className="metric-view" id="metricWalk" data-metric="walk" hidden>
                    <p className="panel-hint gait-disclaimer">
                      Experimental movement signature from path and pace — not face ID. Needs a few seconds of
                      walking per person.
                    </p>
                    <dl className="metrics-facts">
                      <div className="metrics-fact-full">
                        <dt>Selected person</dt>
                        <dd id="gaitSelectedSummary">Click someone on the video to inspect their walk.</dd>
                      </div>
                    </dl>
                    <h3 className="gait-section-title">Active tracks</h3>
                    <ul className="gait-track-list" id="gaitTrackList" />
                    <h3 className="gait-section-title">Similar walks this session</h3>
                    <ul className="gait-match-list" id="gaitMatchList" />
                  </div>

                  <div className="metric-view" id="metricZones" data-metric="zones" hidden>
                    <p className="panel-hint">Compare drawn zones — live counts, averages, and entries.</p>
                    <div className="metrics-mini metrics-mini-wide">
                      <span className="metrics-mini-label">Zone comparison</span>
                      <canvas id="metricsZonesChart" aria-label="Zone comparison chart" />
                      <p className="chart-empty" id="metricsZonesEmpty">
                        Draw zones on Source…
                      </p>
                    </div>
                    <div className="stat-row">
                      <div className="stat-pill">
                        <span className="stat-pill-label">Zones</span>
                        <strong id="statZoneCount">—</strong>
                      </div>
                      <div className="stat-pill">
                        <span className="stat-pill-label">Leader</span>
                        <strong id="statZoneLeader">—</strong>
                      </div>
                    </div>
                    <ul className="zones-metrics-list" id="zonesMetricsList" />
                  </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
