export default function Limitations({ meta }) {
  return (
    <details className="card">
      <summary><h2 className="inline">Methodological Scope &amp; Operational Governance Disclosures</h2></summary>
      <ul className="limitations">
        <li><strong>Forecasting Architecture:</strong> Forecasts are computed by the M1-lite hybrid model (combining gradient-boosted decision trees with autoregressive temporal dynamics), integrated via a decoupled protocol.</li>
        <li><strong>Attribution vs. Causality:</strong> {meta?.explanation_scope}</li>
        <li><strong>Econometric Sensitivity:</strong> What-if simulator sliders demonstrate model sensitivity across the 5th–95th historical driver range, not isolated real-world policy intervention outcomes.</li>
        <li><strong>Driver Effect Magnitudes:</strong> In monthly time-series data, short-term national exports are dominated by recent plucking momentum and seasonal cycles; individual macro drivers typically induce shifts of 0.1–0.3 million kg.</li>
        <li><strong>Prediction Intervals:</strong> The 80% error interval is derived from validation residual quantiles and demonstrated 74% empirical coverage across the 2022–2024 held-out evaluation period.</li>
        <li><strong>Data Provenance:</strong> Exchange rates prior to 2014 utilize Central Bank synthetic series; Buyer Demand Index (BDI) is constructed from UN Comtrade trade-share weighted partner GDP.</li>
        <li><strong>Operational Decision Advisory Governance:</strong> Decision prompts provide structured operational alerts calibrated from historical distribution thresholds; formal industry consensus review remains in progress with Colombo tea brokers.</li>
      </ul>
    </details>
  );
}
