import { Router } from 'express';

import { HttpError, unavailable } from '../errors.js';
import * as v from '../validation.js';

const CONDITIONS = ['static', 'interactive'];
const DECISIONS = ['increase', 'hold', 'reduce'];
const CONSTRUCTS = ['perceived_usefulness', 'perceived_ease_of_use', 'trust', 'explanation_satisfaction'];

/**
 * TAM evaluation study endpoints. Locked (403) unless STUDY_MODE_ENABLED=true,
 * which must only be set after supervisor and ethics approval.
 */
export function studyRouter({ repo, enabled }) {
  const router = Router();

  router.use((_req, _res, next) => {
    if (!enabled) {
      return next(new HttpError(403, 'Study mode is disabled until supervisor and ethics approval are confirmed (STUDY_MODE_ENABLED=true).'));
    }
    if (!repo) return next(unavailable('Database not configured; study data cannot be stored.'));
    return next();
  });

  router.post('/participants', async (req, res) => {
    const b = req.body ?? {};
    if (b.consent_given !== true) throw new HttpError(422, 'Informed consent must be recorded before any study data.');
    const participant = {
      participant_code: v.requiredCode(b.participant_code, 'participant_code'),
      participant_type: v.oneOf(b.participant_type, ['expert', 'proxy'], 'participant_type'),
      role: v.optionalText(b.role, 'role', 100),
      years_experience: v.intInRange(b.years_experience, 'years_experience', 0, 70, { optional: true }),
      condition_order: v.oneOf(b.condition_order, ['static_first', 'interactive_first', 'group_a', 'group_b'], 'condition_order'),
      consent_given: true,
    };
    await repo.addParticipant(participant);
    res.status(201).json({ participant_code: participant.participant_code });
  });

  router.post('/vignette-responses', async (req, res) => {
    const b = req.body ?? {};
    const response = {
      participant_code: v.requiredCode(b.participant_code, 'participant_code'),
      vignette_id: v.requiredCode(b.vignette_id, 'vignette_id'),
      condition: v.oneOf(b.condition, CONDITIONS, 'condition'),
      decision: v.oneOf(b.decision, DECISIONS, 'decision'),
      reference_decision: b.reference_decision == null ? null : v.oneOf(b.reference_decision, DECISIONS, 'reference_decision'),
      confidence: v.intInRange(b.confidence, 'confidence', 1, 7, { optional: true }),
      completion_seconds: b.completion_seconds == null ? null : Number(b.completion_seconds),
      interaction_count: v.intInRange(b.interaction_count ?? 0, 'interaction_count', 0, 100000),
    };
    if (response.completion_seconds != null && !(response.completion_seconds >= 0)) {
      throw new HttpError(422, 'completion_seconds must be a non-negative number.');
    }
    const id = await repo.addVignetteResponse(response);
    res.status(201).json({ response_id: id });
  });

  router.post('/questionnaire-responses', async (req, res) => {
    const b = req.body ?? {};
    const participantCode = v.requiredCode(b.participant_code, 'participant_code');
    const condition = v.oneOf(b.condition, CONDITIONS, 'condition');
    if (!Array.isArray(b.items) || b.items.length === 0) throw new HttpError(422, 'items must be a non-empty array.');
    const items = b.items.map((it, i) => ({
      construct: v.oneOf(it?.construct, CONSTRUCTS, `items[${i}].construct`),
      item_code: v.requiredCode(it?.item_code, `items[${i}].item_code`),
      score: v.intInRange(it?.score, `items[${i}].score`, 1, 7),
    }));
    await repo.addQuestionnaireResponses(participantCode, condition, items);
    res.status(201).json({ stored: items.length });
  });

  return router;
}
