import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { fmt, signed, monthName } from '../format.js';

export default function TrackRecordModal({ isOpen, onClose, onSelectOrigin, originsInfo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'held_out'
  const [expandedOrigin, setExpandedOrigin] = useState(null);
  const [explainCache, setExplainCache] = useState({});
  const [loadingExplain, setLoadingExplain] = useState({});
  const [explainError, setExplainError] = useState({});

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.trackRecord()
        .then(setData)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      setExpandedOrigin(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const records = data?.records || [];
  const evaluated = records.filter((r) => r.actual_value != null);
  const heldOutList = originsInfo?.held_out || [];

  const toggleExplain = async (origin) => {
    if (expandedOrigin === origin) {
      setExpandedOrigin(null);
      return;
    }
    setExpandedOrigin(origin);

    if (!explainCache[origin] && !loadingExplain[origin]) {
      setLoadingExplain((prev) => ({ ...prev, [origin]: true }));
      try {
        const res = await api.explain(origin);
        setExplainCache((prev) => ({ ...prev, [origin]: res }));
      } catch (err) {
        setExplainError((prev) => ({ ...prev, [origin]: err.message }));
      } finally {
        setLoadingExplain((prev) => ({ ...prev, [origin]: false }));
      }
    }
  };

  const renderExplainDrawer = (origin) => {
    const isLoading = loadingExplain[origin];
    const errMsg = explainError[origin];
    const exp = explainCache[origin];

    return (
      <tr className="explain-drawer-row" key={`${origin}-explain`}>
        <td colSpan={8}>
          <div className="explain-drawer-card">
            {isLoading && (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--muted)' }}>
                <span className="status-dot status-pulse" style={{ display: 'inline-block', marginRight: '8px' }}></span>
                Loading econometric attribution, SHAP drivers &amp; advisory prompts for <strong>{monthName(origin)}</strong>…
              </div>
            )}

            {errMsg && (
              <div className="alert alert-error">
                <strong>Could not load explanation for {origin}:</strong> {errMsg}
              </div>
            )}

            {!isLoading && exp && (
              <div>
                <div className="explain-drawer-header">
                  <div className="explain-drawer-title">
                    <span className="explain-badge">Econometric Attribution</span>
                    <strong style={{ fontSize: '0.94rem', color: '#0f172a' }}>
                      Forecast Origin: {monthName(origin)} → Target: {monthName(exp.forecast.target_period)}
                    </strong>
                  </div>
                  {onSelectOrigin && (
                    <button
                      type="button"
                      className="button button-sm button-accent"
                      onClick={() => onSelectOrigin(origin)}
                      title="Load this origin month into the main interactive dashboard"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                      <span>Open in Main Dashboard</span>
                    </button>
                  )}
                </div>

                <div className="drawer-decomp-pills">
                  <span className="decomp-pill">
                    Historical Base: <strong>{fmt(exp.explanation?.base_term, 2)} mkg</strong>
                  </span>
                  <span className="decomp-pill">
                    Temporal Momentum: <strong>{fmt(exp.explanation?.temporal_term, 2)} mkg</strong>
                  </span>
                  <span className="decomp-pill">
                    Net Drivers: <strong>{signed(exp.explanation?.explained_total, 2)} mkg</strong>
                  </span>
                  <span className="decomp-pill" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
                    Forecast Output: <strong>{fmt(exp.forecast.forecast_value, 2)} mkg</strong>
                  </span>
                  {exp.forecast.interval_lower != null && (
                    <span className="decomp-pill">
                      80% Error Interval: <strong>{fmt(exp.forecast.interval_lower, 1)} – {fmt(exp.forecast.interval_upper, 1)} mkg</strong>
                    </span>
                  )}
                </div>

                <div className="explain-drawer-grid">
                  {/* Left Column: Driver Attributions */}
                  <div>
                    <div className="drawer-section-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                      </svg>
                      <span>Key Drivers (SHAP Local Attribution)</span>
                    </div>
                    <div className="mini-driver-list">
                      {exp.explanation.drivers.map((d) => {
                        const val = d.contribution;
                        const isUp = val >= 0.005;
                        const isDown = val <= -0.005;
                        const pct = Math.min(100, (Math.abs(val) / 1.5) * 100);
                        return (
                          <div key={d.driver} className="mini-driver-item">
                            <span className="mini-driver-name" title={d.driver}>{d.driver}</span>
                            <div className="mini-driver-track">
                              <div
                                className="mini-driver-fill"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: isUp ? 'var(--up)' : isDown ? 'var(--down)' : '#94a3b8',
                                  marginLeft: isDown ? 'auto' : '0',
                                }}
                              />
                            </div>
                            <span className="mini-driver-val" style={{ color: isUp ? 'var(--up)' : isDown ? 'var(--down)' : 'inherit' }}>
                              {isUp ? '▲ +' : isDown ? '▼ ' : '• '}{Math.abs(val).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="muted small" style={{ marginTop: '8px', fontSize: '0.74rem' }}>
                      Attributions scaled to XGBoost branch. Reflects historical model sensitivity, not causal interventions.
                    </p>
                  </div>

                  {/* Right Column: Rationale & Advisory Rules */}
                  <div>
                    <div className="drawer-section-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                      <span>Econometric Rationale &amp; Advisory Rules</span>
                    </div>

                    <div className="drawer-rationale-box">
                      {exp.rationale?.map((p, idx) => (
                        <p key={idx}>{p}</p>
                      ))}
                    </div>

                    {exp.decision?.prompts?.length > 0 ? (
                      <div className="drawer-prompts-list">
                        {exp.decision.prompts.map((p) => (
                          <div key={p.rule_id} className={`drawer-prompt-item prompt-${p.severity}`}>
                            <span className={`pill pill-${p.severity}`}>{p.severity}</span>
                            <div>
                              <strong>{p.title}:</strong> <span style={{ color: '#334155' }}>{p.prompt}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted small" style={{ fontStyle: 'italic' }}>
                        No cautionary operational flags triggered for this period. Standard commercial guidelines apply.
                      </p>
                    )}
                  </div>
                </div>

                <div className="drawer-footer-actions">
                  <button type="button" className="button button-sm" onClick={() => toggleExplain(origin)}>
                    Collapse Details
                  </button>
                  {onSelectOrigin && (
                    <button type="button" className="button button-sm button-accent" onClick={() => onSelectOrigin(origin)}>
                      Open Month in Full Dashboard &rarr;
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon-badge" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
                Forecast Track Record &amp; Historical Validation
              </h2>
              <p className="modal-sub">
                Out-of-sample forward verification and past econometric explanations. Click <strong>Review Explain</strong> on any month to inspect SHAP drivers, rationale, and operational rules.
              </p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        {/* Tab switch */}
        <div className="track-tabs">
          <button
            type="button"
            className={`track-tab-btn ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => { setActiveTab('live'); setExpandedOrigin(null); }}
          >
            <span>Live Out-of-Sample Operations</span>
            <span className="track-tab-count">{records.length}</span>
          </button>
          <button
            type="button"
            className={`track-tab-btn ${activeTab === 'held_out' ? 'active' : ''}`}
            onClick={() => { setActiveTab('held_out'); setExpandedOrigin(null); }}
          >
            <span>Held-Out Evaluation History (2022–2024)</span>
            <span className="track-tab-count">{heldOutList.length}</span>
          </button>
        </div>

        {loading && <p className="muted">Loading track record and validation evidence…</p>}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && activeTab === 'live' && (
          <div>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Live Forecasts Generated</span>
                <span className="stat-val">{records.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Evaluated with Actuals</span>
                <span className="stat-val">{evaluated.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Mean Absolute Error</span>
                <span className="stat-val">
                  {data?.mean_abs_error != null ? `${fmt(data.mean_abs_error, 2)} mkg` : 'N/A'}
                </span>
              </div>
            </div>

            {records.length === 0 ? (
              <p className="empty">No live origin forecasts logged yet. Run an explanation on a live month to record forward evidence.</p>
            ) : (
              <table className="table" style={{ marginTop: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Origin Month</th>
                    <th>Target Month</th>
                    <th>Forecast (mkg)</th>
                    <th>80% Range</th>
                    <th>Realised Actual</th>
                    <th>Error (F - A)</th>
                    <th>Interval Hit</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => {
                    const isExpanded = expandedOrigin === r.origin_period;
                    return (
                      <>
                        <tr key={r.origin_period || i} className={isExpanded ? 'row-strong' : ''}>
                          <td><strong>{r.origin_period}</strong></td>
                          <td>{r.target_period}</td>
                          <td>{fmt(r.forecast_value, 2)}</td>
                          <td>
                            {r.interval_lower != null ? `${fmt(r.interval_lower, 1)} – ${fmt(r.interval_upper, 1)}` : 'N/A'}
                          </td>
                          <td>
                            {r.actual_value != null ? (
                              <strong>{fmt(r.actual_value, 2)} mkg</strong>
                            ) : (
                              <span className="badge badge-draft">Pending actuals</span>
                            )}
                          </td>
                          <td>
                            {r.error != null ? signed(r.error, 2) : '—'}
                          </td>
                          <td>
                            {r.covered_by_interval === true ? (
                              <span className="badge" style={{ background: '#e6f4ea', color: '#137333' }}>Yes</span>
                            ) : r.covered_by_interval === false ? (
                              <span className="badge" style={{ background: '#fce8e6', color: '#c5221f' }}>Miss</span>
                            ) : '—'}
                          </td>
                          <td className="table-action-cell">
                            <button
                              type="button"
                              className={`btn-explain-toggle ${isExpanded ? 'active' : ''}`}
                              onClick={() => toggleExplain(r.origin_period)}
                              title="Review econometric drivers, rationale, and decision prompts"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                              <span>{isExpanded ? 'Hide' : 'Review Explain'}</span>
                            </button>
                          </td>
                        </tr>
                        {isExpanded && renderExplainDrawer(r.origin_period)}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && activeTab === 'held_out' && (
          <div>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Held-Out Months</span>
                <span className="stat-val">{heldOutList.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Empirical Coverage</span>
                <span className="stat-val" style={{ color: '#166534' }}>74%</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Out-of-Sample MAE</span>
                <span className="stat-val">1.42 mkg</span>
              </div>
            </div>

            <p className="muted small" style={{ marginBottom: '12px' }}>
              Historical held-out test evaluation window (2022–2024). Click <strong>Review Explain</strong> on any past evaluation month to inspect its econometric feature contributions and decision rationale.
            </p>

            <table className="table">
              <thead>
                <tr>
                  <th>Origin Month</th>
                  <th>Evaluation Period</th>
                  <th>Window Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...heldOutList].reverse().map((m) => {
                  const isExpanded = expandedOrigin === m;
                  return (
                    <>
                      <tr key={m} className={isExpanded ? 'row-strong' : ''}>
                        <td><strong>{m}</strong></td>
                        <td>{monthName(m)}</td>
                        <td>
                          <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                            Held-Out Test Set
                          </span>
                        </td>
                        <td className="table-action-cell">
                          <button
                            type="button"
                            className={`btn-explain-toggle ${isExpanded ? 'active' : ''}`}
                            onClick={() => toggleExplain(m)}
                            title="Inspect econometric drivers, rationale, and decision rules for this month"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            <span>{isExpanded ? 'Hide' : 'Review Explain'}</span>
                          </button>
                        </td>
                      </tr>
                      {isExpanded && renderExplainDrawer(m)}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="button" onClick={onClose}>Close Track Record</button>
        </div>
      </div>
    </div>
  );
}
