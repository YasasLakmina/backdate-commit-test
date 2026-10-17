import { useState } from 'react';

import { fmtDriverValue, monthName } from '../format.js';

export default function Sidebar({
  meta, originsInfo, origin, onOrigin, ranges, interactive, onInteractive,
  overrides, onOverride, onReset, onOpenAddLive, onOpenRules, onOpenTrackRecord,
}) {
  const [showAll, setShowAll] = useState(false);

  const liveMonths = originsInfo?.live || [];
  const heldOutMonths = originsInfo?.held_out || [];
  const inSampleMonths = originsInfo?.in_sample || [];

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark-svg" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 4 13C4 7 11 2 11 2s7 5 7 11a7 7 0 0 1-7 7Z"></path>
            <path d="M11 2v18"></path>
          </svg>
        </span>
        <div>
          <div className="brand-title">Tea Export DSS</div>
          <div className="brand-sub">Sri Lanka Market Intelligence · M3</div>
        </div>
      </div>

      <label className="field">
        <span className="field-label">Operating Period (Origin Month)</span>
        <select value={origin ?? ''} onChange={(e) => onOrigin(e.target.value)} disabled={!originsInfo}>
          {liveMonths.length > 0 && (
            <optgroup label="Live Operations (Verified Data)">
              {[...liveMonths].reverse().map((m) => (
                <option key={m} value={m}>● {monthName(m)} [Live Actuals]</option>
              ))}
            </optgroup>
          )}
          <optgroup label="Held-out Test Period (2022–2024)">
            {[...heldOutMonths].reverse().map((m) => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </optgroup>
          {showAll && inSampleMonths.length > 0 && (
            <optgroup label="In-sample Training Period (2000–2021)">
              {[...inSampleMonths].reverse().map((m) => (
                <option key={m} value={m}>{monthName(m)} (Training)</option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      <label className="check">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        <span>Show historical training months</span>
      </label>

      <div className="sidebar-btn-group">
        <button type="button" className="button button-sm button-accent" onClick={onOpenAddLive}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Ingest Verified Month</span>
        </button>
        <button type="button" className="button button-sm" onClick={onOpenRules}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>Decision Rules &amp; Review (15)</span>
        </button>
        <button type="button" className="button button-sm" onClick={onOpenTrackRecord}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span>Out-of-Sample Track Record</span>
        </button>
      </div>

      <hr />

      <label className="switch">
        <input type="checkbox" checked={interactive} onChange={(e) => onInteractive(e.target.checked)} />
        <span>Enable What-If Market Simulator</span>
      </label>
      <p className="hint">Simulate forward export response under hypothetical auction prices, currency, or rainfall adjustments.</p>

      {interactive && ranges && meta && (
        <div className="sliders">
          {Object.entries(meta.scenario_drivers).map(([name, info]) => {
            const r = ranges[name];
            if (!r || r.current == null) {
              return <p key={name} className="hint">{info.label}: not available for this month.</p>;
            }
            const lo = Math.min(r.p5, r.current);
            const hi = Math.max(r.p95, r.current);
            const value = overrides[name] ?? r.current;
            const changed = name in overrides;
            return (
              <label key={name} className={`slider ${changed ? 'slider-changed' : ''}`}>
                <span className="slider-head">
                  <span>{info.label}</span>
                  <strong>{fmtDriverValue(value)}</strong>
                </span>
                <input
                  type="range"
                  min={lo}
                  max={hi}
                  step={(hi - lo) / 200}
                  value={value}
                  onChange={(e) => onOverride(name, Number(e.target.value))}
                  aria-valuetext={`${fmtDriverValue(value, info.unit)}`}
                />
                <span className="slider-scale">
                  <span>{fmtDriverValue(lo)}</span>
                  <span className="muted">actual {fmtDriverValue(r.current)} {info.unit}</span>
                  <span>{fmtDriverValue(hi)}</span>
                </span>
              </label>
            );
          })}
          <button type="button" className="button button-reset" onClick={onReset} disabled={!Object.keys(overrides).length}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
            <span>Reset to Verified Baseline</span>
          </button>
          <p className="hint">Simulation sliders span the 5th–95th historical percentile. Reflects econometric sensitivity, not isolated policy interventions.</p>
        </div>
      )}
    </aside>
  );
}
