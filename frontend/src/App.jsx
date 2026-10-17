import { useEffect, useMemo, useState } from 'react';

import { api } from './api.js';
import { monthName } from './format.js';
import DecisionPrompts from './components/DecisionPrompts.jsx';
import DriverChart from './components/DriverChart.jsx';
import ForecastSummary from './components/ForecastSummary.jsx';
import GlobalImportance from './components/GlobalImportance.jsx';
import Limitations from './components/Limitations.jsx';
import Rationale from './components/Rationale.jsx';
import ScenarioComparison from './components/ScenarioComparison.jsx';
import Sidebar from './components/Sidebar.jsx';
import AddLiveMonthModal from './components/AddLiveMonthModal.jsx';
import RulesReviewModal from './components/RulesReviewModal.jsx';
import TrackRecordModal from './components/TrackRecordModal.jsx';
import GoalSeek from './components/GoalSeek.jsx';

const DEBOUNCE_MS = 350;

function useSessionId() {
  return useMemo(() => {
    try {
      const existing = sessionStorage.getItem('m3-session');
      if (existing) return existing;
      const id = crypto.randomUUID().slice(0, 18);
      sessionStorage.setItem('m3-session', id);
      return id;
    } catch {
      return null;
    }
  }, []);
}

// Deep link query parameters for scenario evaluation, e.g. ?origin=2024-03&interactive=1&rain_mm=395
const params = new URLSearchParams(window.location.search);
const DRIVER_PARAMS = ['rain_mm', 'usd_lkr', 'price_lkr_kg', 'bdi', 'oni'];
const linkOverrides = Object.fromEntries(
  DRIVER_PARAMS.filter((d) => params.has(d) && Number.isFinite(Number(params.get(d)))).map((d) => [d, Number(params.get(d))]),
);

export default function App() {
  const sessionId = useSessionId();
  const [meta, setMeta] = useState(null);
  const [originsInfo, setOriginsInfo] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [ranges, setRanges] = useState(null);
  const [interactive, setInteractive] = useState(params.get('interactive') === '1');
  const [overrides, setOverrides] = useState({});
  const [pendingLink, setPendingLink] = useState(linkOverrides);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddLive, setShowAddLive] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showTrackRecord, setShowTrackRecord] = useState(false);

  const handleMonthAdded = (newMonth) => {
    api.origins().then((o) => {
      setOriginsInfo(o);
      setOrigin(newMonth);
    }).catch((err) => setError(err.message));
  };

  // Load metadata and the month list once.
  useEffect(() => {
    Promise.all([api.meta(), api.origins()])
      .then(([m, o]) => {
        setMeta(m);
        setOriginsInfo(o);
        setOrigin(o.origins.includes(params.get('origin')) ? params.get('origin') : o.default);
      })
      .catch((err) => setError(err.message));
  }, []);

  // New month: fetch its slider ranges and reset the scenario.
  useEffect(() => {
    if (!origin) return undefined;
    const ctrl = new AbortController();
    setOverrides(pendingLink); // deep-link values apply to the first month only
    setPendingLink({});
    setRanges(null);
    api.ranges(origin, ctrl.signal).then(setRanges).catch((err) => err.name !== 'AbortError' && setError(err.message));
    return () => ctrl.abort();
  }, [origin]);

  // Explain, or run the scenario when interactive controls changed something.
  const overridesKey = JSON.stringify(overrides);
  useEffect(() => {
    if (!origin) return undefined;
    const ctrl = new AbortController();
    const active = interactive && Object.keys(overrides).length > 0;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = active
          ? await api.scenario(origin, overrides, sessionId, ctrl.signal)
          : await api.explain(origin, sessionId, ctrl.signal);
        if (ctrl.signal.aborted) return; // a newer request replaced this one
        setResult({ kind: active ? 'scenario' : 'explain', data });
        setError(null);
      } catch (err) {
        if (err.name === 'AbortError' || ctrl.signal.aborted) return;
        setResult(null); // never keep showing numbers that no longer match the inputs
        setError(err.message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, active ? DEBOUNCE_MS : 0);
    return () => { clearTimeout(timer); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, overridesKey, interactive, sessionId]);

  const view = result && (result.kind === 'scenario'
    ? { ...result.data.scenario, decision: result.data.decision }
    : result.data);
  const model = meta?.model;

  return (
    <div className="layout">
      <Sidebar
        meta={meta}
        originsInfo={originsInfo}
        origin={origin}
        onOrigin={setOrigin}
        ranges={ranges}
        interactive={interactive}
        onInteractive={(on) => { setInteractive(on); if (!on) setOverrides({}); }}
        overrides={overrides}
        onOverride={(name, value) => setOverrides((o) => ({ ...o, [name]: value }))}
        onReset={() => setOverrides({})}
        onOpenAddLive={() => setShowAddLive(true)}
        onOpenRules={() => setShowRules(true)}
        onOpenTrackRecord={() => setShowTrackRecord(true)}
      />

      <main className="main" aria-busy={loading}>
        <header className="page-header">
          <div>
            <h1>Sri Lanka Tea Export Decision Support System</h1>
            <p className="subtitle">Operational Forecasting, Market Intelligence &amp; Explainable Decision Support</p>
          </div>
          <div className="header-status-group">
            <span className={`mode-pill ${interactive ? 'mode-pill-sim' : 'mode-pill-base'}`}>
              <span className="status-dot" aria-hidden="true"></span>
              {interactive ? 'What-If Simulation Active' : 'Official Baseline Outlook'}
            </span>
            {view?.forecast && (
              <span className="horizon-pill">
                Forecast Target: <strong>{monthName(view.forecast.target_period)}</strong>
              </span>
            )}
          </div>
        </header>

        {error && (
          <div className="alert alert-error" role="alert">
            <strong>Something went wrong.</strong> {error}
            <div className="muted">No forecast numbers are shown until this is resolved.</div>
          </div>
        )}
        {!error && !view && <div className="card muted">Loading forecast…</div>}

        {view && (
          <>
            <ForecastSummary forecast={view.forecast} context={view.context} loading={loading} />
            {result.kind === 'scenario' && (
              <ScenarioComparison data={result.data} drivers={meta?.scenario_drivers} />
            )}
            <div className="grid-2">
              <DriverChart explanation={view.explanation} forecast={view.forecast} />
              <Rationale paragraphs={result.kind === 'scenario' ? result.data.baseline.rationale : view.rationale}
                         title={result.kind === 'scenario' ? 'Why the baseline forecast?' : 'Why this forecast?'} />
            </div>
            <DecisionPrompts decision={view.decision} />
            <GoalSeek
              origin={origin}
              meta={meta}
              ranges={ranges}
              onApplyOverride={(d, v) => {
                setInteractive(true);
                setOverrides((prev) => ({ ...prev, [d]: v }));
              }}
            />
            <GlobalImportance />
            <Limitations meta={meta} />
            <footer className="footer muted">
              {view.forecast.model_id} · data {meta?.model?.data_sha256?.slice(0, 10)} ·
              {' '}service {fmtMs(result.data.latency_ms?.ml)} / total {fmtMs(result.data.latency_ms?.total)} ·
              {' '}{result.data.logging?.enabled ? (result.data.logging.logged ? 'run logged' : 'run NOT logged') : 'no database'}
            </footer>
          </>
        )}
      </main>

      <AddLiveMonthModal
        isOpen={showAddLive}
        onClose={() => setShowAddLive(false)}
        onMonthAdded={handleMonthAdded}
        existingMonths={originsInfo?.origins || []}
      />

      <RulesReviewModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
      />

      <TrackRecordModal
        isOpen={showTrackRecord}
        onClose={() => setShowTrackRecord(false)}
        onSelectOrigin={(o) => {
          setOrigin(o);
          setShowTrackRecord(false);
        }}
        originsInfo={originsInfo}
      />
    </div>
  );
}

const fmtMs = (v) => (v == null ? '–' : `${Math.round(v)} ms`);
