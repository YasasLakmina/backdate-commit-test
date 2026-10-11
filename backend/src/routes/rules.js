import { Router } from 'express';

import { HttpError, unavailable } from '../errors.js';
import { RULES, ruleMetadata } from '../rules/catalogue.js';
import * as v from '../validation.js';

const VERDICTS = ['agree', 'partly', 'disagree'];

/** Rule catalogue and expert reviews ("is this prompt sensible? how would you reword it?"). */
export function rulesRouter({ repo }) {
  const router = Router();
  const findRule = (id) => {
    const rule = RULES.find((r) => r.id === id);
    if (!rule) throw new HttpError(404, `Unknown rule ${id}`);
    return rule;
  };

  router.get('/', async (_req, res) => {
    let statuses = {};
    let database = 'not_configured';
    if (repo) {
      try {
        statuses = await repo.ruleStatuses();
        database = 'ok';
      } catch {
        database = 'unavailable';
      }
    }
    res.json({
      database,
      rules: RULES.map((r) => ({
        ...ruleMetadata(r),
        status: statuses[r.id]?.status ?? 'DRAFT',
        reviews: statuses[r.id]?.reviews ?? { agree: 0, partly: 0, disagree: 0 },
      })),
    });
  });

  router.get('/:id/reviews', async (req, res) => {
    findRule(req.params.id);
    if (!repo) throw unavailable('Database not configured; reviews are unavailable.');
    res.json({ reviews: await repo.listReviews(req.params.id) });
  });

  router.post('/:id/reviews', async (req, res) => {
    const rule = findRule(req.params.id);
    if (!repo) throw unavailable('Database not configured; reviews cannot be stored.');
    const body = req.body ?? {};
    const review = {
      reviewer_role: v.optionalText(body.reviewer_role, 'reviewer_role', 100),
      verdict: v.oneOf(body.verdict, VERDICTS, 'verdict'),
      suggested_wording: v.optionalText(body.suggested_wording, 'suggested_wording'),
      comment: v.optionalText(body.comment, 'comment'),
    };
    if (!review.reviewer_role) throw new HttpError(422, 'reviewer_role is required (a role, not a name).');
    const saved = await repo.addReview(rule.id, rule.version, review);
    res.status(201).json({ rule_id: rule.id, rule_version: rule.version, ...saved });
  });

  return router;
}
