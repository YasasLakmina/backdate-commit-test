import { RULES, ruleMetadata } from './catalogue.js';

const SEVERITY_ORDER = { caution: 0, review: 1, info: 2 };
export const NO_PROMPT_MESSAGE = 'No decision prompt was triggered for this forecast.';
export const DISCLAIMER = 'Decision prompts are suggestions to think about, not advice. DRAFT prompts have not yet been reviewed by a tea-export expert.';

/**
 * Evaluate every rule against a forecast context.
 * statuses: optional { rule_id: 'DRAFT' | 'REVIEWED' | 'RETIRED' } from the database.
 * A rule that throws is reported in `errors`, never silently skipped.
 */
export function evaluateRules(ctx, { rules = RULES, statuses = {} } = {}) {
  const prompts = [];
  const errors = [];
  for (const rule of rules) {
    const status = statuses[rule.id] ?? 'DRAFT';
    if (status === 'RETIRED') continue;
    try {
      const hit = rule.evaluate(ctx);
      if (hit) prompts.push({ ...ruleMetadata(rule), status, evidence: hit.evidence, prompt: hit.prompt });
    } catch (err) {
      errors.push({ rule_id: rule.id, error: err.message });
    }
  }
  prompts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.rule_id.localeCompare(b.rule_id));
  return {
    prompts,
    errors,
    message: prompts.length ? null : NO_PROMPT_MESSAGE,
    disclaimer: DISCLAIMER,
  };
}
