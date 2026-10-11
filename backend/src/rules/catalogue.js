/**
 * Decision-prompt rule catalogue (all DRAFT until reviewed by a domain expert).
 *
 * Each rule returns null (not triggered) or { evidence, prompt }. Wording is
 * deliberately soft ("consider reviewing ..."): prompts support a decision, they
 * do not make it. Thresholds come from the ML service's calibration (training
 * period only) or are provisional design choices labelled as such.
 *
 * ctx = { forecast, explanation, context, calibration, comparison? }
 */

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const inSentence = (name) => name.split(' ').map((w) => (w === w.toUpperCase() ? w : w.toLowerCase())).join(' ');
const mkg = (v) => `${v.toFixed(2)} million kg`;
const SOURCE = 'Threshold from 2000-2018 training history.';
const PROVISIONAL = 'Provisional threshold chosen by the developer.';

export const RULES = [
  {
    id: 'FORECAST_ABOVE_RECENT', version: '1.0', family: 'Forecast direction', severity: 'review',
    title: 'Forecast notably above recent months',
    trigger: 'Forecast exceeds the previous 3-month average by more than the 80th percentile of historical month-on-month changes.',
    limitation: `${SOURCE} A large rise can be normal in new market conditions.`,
    evaluate: ({ forecast, context, calibration }) => {
      const recent = context.recent_3m_avg;
      if (!recent) return null;
      const change = forecast.forecast_value / recent - 1;
      if (change <= calibration.recent_change.p80) return null;
      return {
        evidence: { forecast: forecast.forecast_value, recent_3m_avg: recent, change, threshold: calibration.recent_change.p80 },
        prompt: `Consider reviewing confirmed orders and available stock: the forecast is ${pct(change)} above the average of the last three months, a larger rise than in 80% of historical months.`,
      };
    },
  },
  {
    id: 'FORECAST_BELOW_RECENT', version: '1.0', family: 'Forecast direction', severity: 'review',
    title: 'Forecast notably below recent months',
    trigger: 'Forecast is below the previous 3-month average by more than the 20th percentile of historical month-on-month changes.',
    limitation: `${SOURCE} A temporary dip may not need a plan change.`,
    evaluate: ({ forecast, context, calibration }) => {
      const recent = context.recent_3m_avg;
      if (!recent) return null;
      const change = forecast.forecast_value / recent - 1;
      if (change >= calibration.recent_change.p20) return null;
      return {
        evidence: { forecast: forecast.forecast_value, recent_3m_avg: recent, change, threshold: calibration.recent_change.p20 },
        prompt: `Consider reviewing shipment commitments and stock-holding plans: the forecast is ${pct(-change)} below the average of the last three months, a larger fall than in 80% of historical months.`,
      };
    },
  },
  {
    id: 'ABOVE_LAST_YEAR', version: '1.0', family: 'Forecast direction', severity: 'info',
    title: 'Forecast above the same month last year',
    trigger: 'Forecast exceeds the same month last year by more than the 80th percentile of historical year-on-year changes.',
    limitation: `${SOURCE} Last year may itself have been unusual.`,
    evaluate: ({ forecast, context, calibration }) => {
      const ly = context.same_month_last_year;
      if (!ly) return null;
      const change = forecast.forecast_value / ly - 1;
      if (change <= calibration.yoy_change.p80) return null;
      return {
        evidence: { forecast: forecast.forecast_value, same_month_last_year: ly, change, threshold: calibration.yoy_change.p80 },
        prompt: `Consider checking whether buyer contracts reflect a volume ${pct(change)} higher than the same month last year.`,
      };
    },
  },
  {
    id: 'BELOW_LAST_YEAR', version: '1.0', family: 'Forecast direction', severity: 'info',
    title: 'Forecast below the same month last year',
    trigger: 'Forecast is below the same month last year by more than the 20th percentile of historical year-on-year changes.',
    limitation: `${SOURCE} Last year may itself have been unusual.`,
    evaluate: ({ forecast, context, calibration }) => {
      const ly = context.same_month_last_year;
      if (!ly) return null;
      const change = forecast.forecast_value / ly - 1;
      if (change >= calibration.yoy_change.p20) return null;
      return {
        evidence: { forecast: forecast.forecast_value, same_month_last_year: ly, change, threshold: calibration.yoy_change.p20 },
        prompt: `Consider checking market conditions: the forecast is ${pct(-change)} lower than the same month last year.`,
      };
    },
  },
  {
    id: 'WIDE_INTERVAL', version: '1.0', family: 'Uncertainty', severity: 'caution',
    title: 'Wide forecast range',
    trigger: 'The 80% range is wider than 25% of the forecast value.',
    limitation: `${PROVISIONAL} The range comes from validation errors and covered 74% of test months, below its 80% target.`,
    evaluate: ({ forecast, calibration }) => {
      if (forecast.interval_lower == null) return null;
      const width = (forecast.interval_upper - forecast.interval_lower) / forecast.forecast_value;
      const limit = calibration.provisional.interval_relative_width;
      if (width <= limit) return null;
      return {
        evidence: { interval_lower: forecast.interval_lower, interval_upper: forecast.interval_upper, relative_width: width, threshold: limit },
        prompt: `Use additional caution: the 80% range (${forecast.interval_lower.toFixed(1)} to ${forecast.interval_upper.toFixed(1)} million kg) is wide, so avoid committing volumes on the single forecast number alone.`,
      };
    },
  },
  {
    id: 'DRIVER_CONCENTRATION', version: '1.0', family: 'Explanation', severity: 'review',
    title: 'One driver dominates the explanation',
    trigger: 'One driver group accounts for at least 60% of the explained movement and at least 0.1 million kg.',
    limitation: `${PROVISIONAL} Attribution is to model features, not real-world causes.`,
    evaluate: ({ explanation, calibration }) => {
      const total = explanation.drivers.reduce((s, d) => s + Math.abs(d.contribution), 0);
      const top = explanation.drivers[0];
      if (!top || total === 0) return null;
      const share = Math.abs(top.contribution) / total;
      const p = calibration.provisional;
      if (share < p.driver_concentration_share || Math.abs(top.contribution) < p.driver_concentration_min_mkg) return null;
      return {
        evidence: { driver: top.driver, contribution: top.contribution, share, threshold: p.driver_concentration_share },
        prompt: `Consider reviewing the assumptions behind ${inSentence(top.driver)}: it accounts for ${pct(share)} of the explained movement in this forecast.`,
      };
    },
  },
  {
    id: 'MIXED_SIGNALS', version: '1.0', family: 'Explanation', severity: 'review',
    title: 'Drivers point in different directions',
    trigger: 'Upward and downward driver contributions are both at least 0.25 million kg.',
    limitation: `${PROVISIONAL}`,
    evaluate: ({ explanation, calibration }) => {
      const up = explanation.drivers.filter((d) => d.contribution > 0).reduce((s, d) => s + d.contribution, 0);
      const down = explanation.drivers.filter((d) => d.contribution < 0).reduce((s, d) => s + d.contribution, 0);
      const m = calibration.provisional.mixed_signal_mkg;
      if (up < m || down > -m) return null;
      return {
        evidence: { upward_total: up, downward_total: down, threshold: m },
        prompt: `The model signals are mixed (${mkg(up)} up, ${mkg(-down)} down); consider reviewing market context before acting.`,
      };
    },
  },
  {
    id: 'BRANCH_DISAGREEMENT', version: '1.0', family: 'Uncertainty', severity: 'caution',
    title: 'Model components disagree',
    trigger: 'The XGBoost and temporal components differ by more than the 90th percentile seen in validation (2019-2021).',
    limitation: 'Threshold from validation forecasts. Disagreement signals uncertainty, not which component is right.',
    evaluate: ({ forecast, calibration }) => {
      const gap = Math.abs(forecast.xgb_pred - forecast.temporal_pred);
      if (gap <= calibration.branch_gap_p90_mkg) return null;
      return {
        evidence: { xgb_pred: forecast.xgb_pred, temporal_pred: forecast.temporal_pred, gap, threshold: calibration.branch_gap_p90_mkg },
        prompt: `Use additional caution: the two model components disagree by ${mkg(gap)}, more than usual.`,
      };
    },
  },
  {
    id: 'DATA_QUALITY', version: '1.0', family: 'Data quality', severity: 'caution',
    title: 'Input data flagged',
    trigger: 'Forecast warnings mention synthetic or missing inputs, or the explanation does not reconcile.',
    limitation: 'Only detects issues the data pipeline flags.',
    evaluate: ({ forecast, explanation }) => {
      const flagged = forecast.warnings.filter((w) => /synthetic|Missing feature/i.test(w));
      if (!flagged.length && explanation.reconciled) return null;
      return {
        evidence: { warnings: flagged, explanation_reconciled: explanation.reconciled },
        prompt: 'Check the input data before interpreting this forecast: some inputs are flagged or the explanation does not fully reconcile.',
      };
    },
  },
  {
    id: 'IN_SAMPLE_MONTH', version: '1.0', family: 'Data quality', severity: 'info',
    title: 'Month was used for training',
    trigger: 'The forecast month was part of the model training data.',
    limitation: 'Accuracy on training months is optimistic.',
    evaluate: ({ forecast }) => (forecast.warnings.some((w) => w.includes('in-sample'))
      ? { evidence: { target_period: forecast.target_period }, prompt: 'This month was used to train the model, so its accuracy here looks better than it would on new data; use held-out months (2022-2024) to judge the model.' }
      : null),
  },
  {
    id: 'UNUSUAL_CONDITIONS', version: '1.0', family: 'Data quality', severity: 'caution',
    title: 'Current conditions are rare in history',
    trigger: "This month's driver combination is beyond the 97.5th percentile of training-period Mahalanobis distance.",
    limitation: 'Uses five stationary driver representations; rare is not the same as wrong.',
    evaluate: ({ context, comparison }) => {
      if (!context.unusual_combination || comparison?.unusual_combination) return null;
      return {
        evidence: { combination_d2: context.combination_d2 },
        prompt: "This month's market and weather conditions are rare compared with 2000-2018 history; the model may be less reliable here.",
      };
    },
  },
  {
    id: 'SCENARIO_OUTSIDE_USUAL_RANGE', version: '1.0', family: 'Scenario', severity: 'caution',
    title: 'Scenario uses unusual values',
    trigger: 'A scenario value lies outside the 5th-95th percentile of historical values.',
    limitation: 'Values outside the full historical range are rejected entirely.',
    evaluate: ({ comparison }) => (comparison?.out_of_usual_range
      ? { evidence: { warnings: comparison.warnings }, prompt: 'This scenario uses values outside the usual historical range; treat its output with extra caution.' }
      : null),
  },
  {
    id: 'SCENARIO_UNUSUAL_COMBINATION', version: '1.0', family: 'Scenario', severity: 'caution',
    title: 'Scenario combination is rare',
    trigger: 'The scenario moves the driver combination beyond the 97.5th percentile of training-period Mahalanobis distance.',
    limitation: 'Correlated drivers changed independently can create combinations that rarely occur.',
    evaluate: ({ comparison, context }) => (comparison?.unusual_combination
      ? { evidence: { combination_d2: context.combination_d2 }, prompt: 'This combination of driver values is rare in the historical data; the model output may be unreliable.' }
      : null),
  },
  {
    id: 'SCENARIO_MATERIAL', version: '1.0', family: 'Scenario', severity: 'review',
    title: 'Scenario changes the forecast materially',
    trigger: 'The scenario changes the forecast by at least 2% of the baseline.',
    limitation: `${PROVISIONAL} Model sensitivity, not a causal prediction.`,
    evaluate: ({ comparison }) => (comparison?.material
      ? { evidence: { absolute: comparison.absolute, relative_percent: comparison.relative_percent }, prompt: `This scenario changes the forecast by ${comparison.relative_percent.toFixed(1)}%; consider verifying the assumptions behind it before using it in planning.` }
      : null),
  },
  {
    id: 'SCENARIO_NEGLIGIBLE', version: '1.0', family: 'Scenario', severity: 'info',
    title: 'Model barely reacts to this scenario',
    trigger: 'The scenario changes the forecast by less than 0.5% of the baseline.',
    limitation: `${PROVISIONAL} Tree models respond in steps, so small changes may show no effect.`,
    evaluate: ({ comparison }) => (comparison?.negligible
      ? { evidence: { absolute: comparison.absolute, relative_percent: comparison.relative_percent }, prompt: 'The model is barely sensitive to this change; in this data, exports are driven mainly by recent momentum and season.' }
      : null),
  },
];

export const ruleMetadata = (rule) => ({
  rule_id: rule.id, version: rule.version, title: rule.title, family: rule.family,
  severity: rule.severity, trigger: rule.trigger, limitation: rule.limitation,
});
