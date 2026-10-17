import { fmt, fmtDriverValue, signed } from '../format.js';
import { Bars } from './DriverChart.jsx';

export default function ScenarioComparison({ data, drivers }) {
  const { baseline, scenario, comparison, scenario_rationale: rationale } = data;
  const b = baseline.forecast;
  const s = scenario.forecast;
  const changeRows = [
    ...comparison.driver_changes.map((c) => ({ driver: c.driver, change: c.change })),
    { driver: 'Temporal component', change: comparison.temporal_change },
  ];

  return (
    <section className={`card scenario ${comparison.support_status === 'warning' ? 'scenario-warning' : ''}`}>
      <div className="card-head">
        <h2>Simulated Market Scenario vs. Baseline</h2>
        <span className="badge badge-sim">{comparison.label}</span>
      </div>

      {comparison.warnings.length > 0 && (
        <div className="alert alert-warn" role="status">
          {comparison.warnings.map((w) => (
            <div key={w} className="alert-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2">
        <div>
          <table className="table">
            <thead><tr><th /><th>Baseline</th><th>Scenario</th><th>Change</th></tr></thead>
            <tbody>
              <tr className="row-strong">
                <td>Forecast (million kg)</td><td>{fmt(b.forecast_value)}</td><td>{fmt(s.forecast_value)}</td>
                <td>{signed(comparison.absolute)} ({signed(comparison.relative_percent, 1)}%)</td>
              </tr>
              {Object.entries(s.overrides).map(([name, value]) => (
                <tr key={name}>
                  <td>{drivers?.[name]?.label ?? name}</td>
                  <td>{fmtDriverValue(b.drivers[name])}</td>
                  <td>{fmtDriverValue(value)}</td>
                  <td className="muted">{drivers?.[name]?.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="rationale">
            {rationale.map((p) => <p key={p}>{p}</p>)}
          </div>
        </div>
        <div>
          <h3>How each driver's contribution changed</h3>
          <Bars rows={changeRows} valueKey="change" />
        </div>
      </div>
    </section>
  );
}
