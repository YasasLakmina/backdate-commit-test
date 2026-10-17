import { evidenceValue } from '../format.js';

const SEVERITY_LABEL = { caution: 'Caution', review: 'Review', info: 'Info' };

export default function DecisionPrompts({ decision }) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Operational Decision Advisory</h2>
          <p className="subtitle small">Rule-based market prompts calibrated against historical price, currency, and supply triggers</p>
        </div>
        <span className="badge badge-advisory">Operational Advisory</span>
      </div>
      <p className="muted small">{decision.disclaimer}</p>

      {decision.message && <p className="empty">{decision.message}</p>}
      {decision.errors?.length > 0 && (
        <div className="alert alert-warn">Certain operational rules could not be evaluated: {decision.errors.map((e) => e.rule_id).join(', ')}</div>
      )}

      <ul className="prompts">
        {decision.prompts.map((p) => (
          <li key={p.rule_id} className={`prompt prompt-${p.severity}`}>
            <div className="prompt-head">
              <span className={`pill pill-${p.severity}`}>{SEVERITY_LABEL[p.severity]}</span>
              <strong>{p.title}</strong>
              <span className="pill pill-rule-tag">
                {p.status === 'REVIEWED' ? 'Industry Verified' : 'Rule Reference'}
              </span>
            </div>
            <p>{p.prompt}</p>
            <details>
              <summary>View Rule Trigger &amp; Market Evidence</summary>
              <dl className="evidence">
                <dt>Trigger Condition</dt><dd>{p.trigger}</dd>
                <dt>Observed Metrics</dt>
                <dd>
                  {Object.entries(p.evidence).map(([k, v]) => (
                    <div key={k}><code>{k}</code>: {evidenceValue(v)}</div>
                  ))}
                </dd>
                <dt>Analytical Scope</dt><dd>{p.limitation}</dd>
                <dt>Rule Identifier</dt><dd><code>{p.rule_id}</code> (v{p.version} · {p.family})</dd>
              </dl>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
