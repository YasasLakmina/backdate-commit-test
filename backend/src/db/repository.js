import pg from 'pg';

/** Create a repository, or null when no DATABASE_URL is configured. */
export function createRepositoryFromUrl(databaseUrl) {
  if (!databaseUrl) return null;
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 3000 });
  pool.on('error', (err) => console.error('PostgreSQL pool error:', err.message));
  return createRepository(pool);
}

export function createRepository(pool) {
  const q = (text, params) => pool.query(text, params);

  return {
    async ping() {
      await q('SELECT 1');
      return true;
    },

    async close() {
      await pool.end();
    },

    // ---- decision rules ---------------------------------------------------
    async syncRules(rules) {
      for (const r of rules) {
        await q(
          `INSERT INTO decision_rules (rule_id, version, title, family, severity, trigger_text, limitation)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (rule_id) DO UPDATE SET
             version = EXCLUDED.version, title = EXCLUDED.title, family = EXCLUDED.family,
             severity = EXCLUDED.severity, trigger_text = EXCLUDED.trigger_text,
             limitation = EXCLUDED.limitation, updated_at = now()
           WHERE decision_rules.version IS DISTINCT FROM EXCLUDED.version
              OR decision_rules.trigger_text IS DISTINCT FROM EXCLUDED.trigger_text`,
          [r.id, r.version, r.title, r.family, r.severity, r.trigger, r.limitation],
        );
      }
    },

    /** Effective status: RETIRED if retired, REVIEWED if the current version has a review, else DRAFT. */
    async ruleStatuses() {
      const { rows } = await q(
        `SELECT d.rule_id, d.status,
                COUNT(r.review_id) FILTER (WHERE r.verdict = 'agree')    AS agree,
                COUNT(r.review_id) FILTER (WHERE r.verdict = 'partly')   AS partly,
                COUNT(r.review_id) FILTER (WHERE r.verdict = 'disagree') AS disagree
           FROM decision_rules d
           LEFT JOIN rule_reviews r ON r.rule_id = d.rule_id AND r.rule_version = d.version
          GROUP BY d.rule_id, d.status`,
      );
      return Object.fromEntries(rows.map((row) => {
        const reviews = { agree: Number(row.agree), partly: Number(row.partly), disagree: Number(row.disagree) };
        const total = reviews.agree + reviews.partly + reviews.disagree;
        const status = row.status === 'RETIRED' ? 'RETIRED' : total > 0 ? 'REVIEWED' : 'DRAFT';
        return [row.rule_id, { status, reviews }];
      }));
    },

    async addReview(ruleId, version, review) {
      const { rows } = await q(
        `INSERT INTO rule_reviews (rule_id, rule_version, reviewer_role, verdict, suggested_wording, comment)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING review_id, created_at`,
        [ruleId, version, review.reviewer_role, review.verdict, review.suggested_wording ?? null, review.comment ?? null],
      );
      return rows[0];
    },

    async listReviews(ruleId) {
      const { rows } = await q(
        `SELECT review_id, rule_version, reviewer_role, verdict, suggested_wording, comment, created_at
           FROM rule_reviews WHERE rule_id = $1 ORDER BY created_at DESC`,
        [ruleId],
      );
      return rows;
    },

    // ---- audit log --------------------------------------------------------
    async logRun(run) {
      const { rows } = await q(
        `INSERT INTO analysis_runs (session_id, kind, origin_period, target_period, overrides, baseline_value,
                                    scenario_value, model_id, support_status, prompt_ids, latency_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING run_id`,
        [run.session_id ?? null, run.kind, run.origin_period, run.target_period, JSON.stringify(run.overrides ?? {}),
          run.baseline_value, run.scenario_value ?? null, run.model_id, run.support_status ?? null,
          run.prompt_ids ?? [], run.latency_ms ?? null],
      );
      return rows[0].run_id;
    },

    async listRuns(sessionId, limit = 20) {
      const { rows } = await q(
        `SELECT run_id, created_at, kind, origin_period, target_period, overrides, baseline_value,
                scenario_value, model_id, support_status, prompt_ids, latency_ms
           FROM analysis_runs WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [sessionId, limit],
      );
      return rows;
    },

    // ---- TAM study (only reachable when study mode is enabled) ------------
    async addParticipant(p) {
      await q(
        `INSERT INTO study_participants (participant_code, participant_type, role, years_experience, condition_order, consent_given)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [p.participant_code, p.participant_type, p.role ?? null, p.years_experience ?? null, p.condition_order, p.consent_given],
      );
    },

    async addVignetteResponse(v) {
      const { rows } = await q(
        `INSERT INTO study_vignette_responses (participant_code, vignette_id, condition, decision, reference_decision,
                                               agrees_with_reference, confidence, completion_seconds, interaction_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING response_id`,
        [v.participant_code, v.vignette_id, v.condition, v.decision, v.reference_decision ?? null,
          v.reference_decision ? v.decision === v.reference_decision : null,
          v.confidence ?? null, v.completion_seconds ?? null, v.interaction_count ?? 0],
      );
      return rows[0].response_id;
    },

    async addQuestionnaireResponses(participantCode, condition, items) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const it of items) {
          await client.query(
            `INSERT INTO study_questionnaire_responses (participant_code, condition, construct, item_code, score)
             VALUES ($1, $2, $3, $4, $5)`,
            [participantCode, condition, it.construct, it.item_code, it.score],
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
