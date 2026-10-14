import { fmt, monthName, signed } from '../format.js';

export default function ForecastSummary({ forecast, context, loading }) {
  const vsRecent = context.recent_3m_avg != null ? forecast.forecast_value - context.recent_3m_avg : null;
  const vsLastYear = context.same_month_last_year != null ? forecast.forecast_value - context.same_month_last_year : null;

  const isLive = forecast.origin_kind === 'live';
  const liveWarnings = (forecast.warnings || []).filter(
    (w) => w.includes('Live forecast') || w.includes('assumed') || w.includes('outside training range')
  );

  return (
    <section className={`card summary ${loading ? 'is-loading' : ''}`} aria-live="polite">
      {isLive && (
        <div className="banner banner-live">
          <span className="badge badge-live">LIVE FORECAST</span>
          <span>Forward prediction: no realized actual value exists yet. Not part of retrospective model evaluation.</span>
        </div>
      )}
      {liveWarnings.length > 0 && !isLive && (
        <div className="banner banner-warn">
          {liveWarnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
      <div className="summary-main">
        <div className="eyebrow">Forecast tea exports · {monthName(forecast.target_period)}</div>
        <div className="big-number">
          {fmt(forecast.forecast_value, 1)} <span className="unit">million kg</span>
        </div>
        {forecast.interval_lower != null && (
          <div className="muted">80% range {fmt(forecast.interval_lower, 1)} – {fmt(forecast.interval_upper, 1)} million kg</div>
        )}
      </div>
      <dl className="summary-stats">
        <div>
          <dt>vs previous 3-month average</dt>
          <dd>{signed(vsRecent, 1)} <span className="muted">({fmt(context.recent_3m_avg, 1)})</span></dd>
        </div>
        <div>
          <dt>vs same month last year</dt>
          <dd>{signed(vsLastYear, 1)} <span className="muted">({fmt(context.same_month_last_year, 1)})</span></dd>
        </div>
        <div>
          <dt>{Object.keys(forecast.overrides ?? {}).length ? 'Actual (not applicable to a scenario)' : 'Actual exports'}</dt>
          <dd>{forecast.actual_value != null ? fmt(forecast.actual_value, 1) : '–'}</dd>
        </div>
      </dl>
    </section>
  );
}
