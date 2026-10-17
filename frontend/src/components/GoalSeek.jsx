import { useState } from 'react';
import { api } from '../api.js';
import { fmt, fmtDriverValue } from '../format.js';

export default function GoalSeek({ origin, meta, ranges, onApplyOverride }) {
  const [driver, setDriver] = useState('rain_mm');
  const [targetValue, setTargetValue] = useState('22.5');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const drivers = meta?.scenario_drivers || {};

  const handleSeek = async (e) => {
    e.preventDefault();
    if (!origin || !driver || !targetValue) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.goalSeek(origin, driver, Number(targetValue));
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card goal-seek-card">
      <div className="card-head">
        <div>
          <h2>Target Volume Sensitivity Planner (Goal-Seek)</h2>
          <p className="subtitle small">Calculate the driver adjustment required to reach a specific national export volume</p>
        </div>
        <span className="badge badge-subtle">Sensitivity Planner</span>
      </div>
      <p className="muted small">
        Analyzes the feasible 5th–95th historical percentile range of a chosen market or agro-climatic driver to identify the setting that brings forecasted exports closest to your operational target.
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSeek} className="goal-seek-form">
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Target volume (million kg)</span>
            <input
              type="number"
              step="0.1"
              min="1"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Driver to adjust</span>
            <select value={driver} onChange={(e) => setDriver(e.target.value)}>
              {Object.entries(drivers).map(([k, d]) => (
                <option key={k} value={k}>{d.label}</option>
              ))}
            </select>
          </label>
        </div>

        <button type="submit" className="button button-primary" style={{ marginTop: '0.8rem' }} disabled={loading}>
          {loading ? 'Searching range...' : 'Find closest driver setting'}
        </button>
      </form>

      {result && (
        <div className="goal-seek-result" style={{ marginTop: '1rem', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Closest Achievable Forecast: {fmt(result.resulting_forecast, 2)} million kg</strong>
            <span className={`pill ${result.reachable ? 'pill-reviewed' : 'pill-caution'}`}>
              {result.reachable ? 'Within ±0.1 mkg' : `Gap ${fmt(result.gap_mkg, 2)} mkg`}
            </span>
          </div>
          <p className="small" style={{ margin: '6px 0' }}>
            Required <strong>{drivers[result.driver]?.label}</strong>: <code>{fmtDriverValue(result.best_driver_value, drivers[result.driver]?.unit)}</code>
            <span className="muted"> (Allowed 5th–95th range: {fmt(result.allowed_range[0], 1)} to {fmt(result.allowed_range[1], 1)})</span>
          </p>
          <p className="muted small" style={{ fontStyle: 'italic', margin: '4px 0 8px' }}>{result.note}</p>
          {onApplyOverride && (
            <button
              type="button"
              className="button button-sm button-accent"
              onClick={() => onApplyOverride(result.driver, result.best_driver_value)}
            >
              Apply to What-If Simulator
            </button>
          )}
        </div>
      )}
    </section>
  );
}
