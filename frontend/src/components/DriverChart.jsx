import { useState } from 'react';

import { fmt, signed } from '../format.js';

/** Horizontal bar chart of driver contributions (blue ▲ = pushes up, orange ▼ = pushes down). */
export function Bars({ rows, valueKey = 'contribution', labelKey = 'driver' }) {
  const max = Math.max(0.05, ...rows.map((r) => Math.abs(r[valueKey])));
  return (
    <div className="bars" role="list">
      {rows.map((r) => {
        const v = r[valueKey];
        const width = `${(Math.abs(v) / max) * 50}%`;
        const dir = v >= 0.005 ? 'up' : v <= -0.005 ? 'down' : 'zero'; // below display precision = neutral
        return (
          <div className="bar-row" role="listitem" key={r[labelKey]} aria-label={`${r[labelKey]} ${signed(v)} million kg`}>
            <span className="bar-label">{r[labelKey]}</span>
            <span className="bar-track">
              <span className="bar-axis" />
              <span className={`bar bar-${dir}`} style={dir === 'down' ? { right: '50%', width } : { left: '50%', width }} />
            </span>
            <span className={`bar-value value-${dir}`}>{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•'} {dir === 'zero' ? '0.00' : signed(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DriverChart({ explanation, forecast }) {
  const [technical, setTechnical] = useState(false);
  const features = explanation.drivers.flatMap((d) =>
    Object.entries(d.features).map(([name, f]) => ({ name, group: d.driver, ...f })));
  features.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return (
    <section className="card">
      <div className="card-head">
        <h2>What moved the forecast</h2>
        <label className="check small">
          <input type="checkbox" checked={technical} onChange={(e) => setTechnical(e.target.checked)} /> Technical view
        </label>
      </div>
      <p className="muted small">
        Contributions in million kg relative to the model's baseline. {explanation.method}.
      </p>

      {!technical ? (
        <Bars rows={explanation.drivers} />
      ) : (
        <table className="table">
          <thead><tr><th>Feature</th><th>Driver</th><th>Value</th><th>Contribution</th></tr></thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.name}><td><code>{f.name}</code></td><td>{f.group}</td><td>{fmt(f.value, 3)}</td><td>{signed(f.contribution, 3)}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="equation">
        <span>Baseline {fmt(explanation.base_term)}</span>
        <span>+ temporal component {fmt(explanation.temporal_term)}</span>
        <span>+ drivers {signed(explanation.explained_total)}</span>
        <span>= <strong>{fmt(forecast.forecast_value)}</strong> million kg</span>
        {!explanation.reconciled && <span className="value-down"> (does not reconcile!)</span>}
      </div>
      <p className="muted small">{explanation.scope_note}</p>
    </section>
  );
}
