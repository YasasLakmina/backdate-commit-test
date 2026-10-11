import express from 'express';

import { HttpError, unavailable } from './errors.js';
import { DISCLAIMER, evaluateRules } from './rules/engine.js';
import { RULES } from './rules/catalogue.js';
import { studyRouter } from './routes/study.js';
import { rulesRouter } from './routes/rules.js';
import * as v from './validation.js';
import { saveLiveForecastLog, getLiveForecastLogs } from './liveForecastStore.js';

/**
 * Build the Express app.
 *   ml   - ML service client (see mlClient.js)
 *   repo - PostgreSQL repository, or null when no database is configured
 */
export function createApp({ ml, repo = null, config }) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  let metaCache = null;
  const meta = async () => (metaCache ??= (await ml.meta()).data);

  async function ruleStatuses() {
    if (!repo) return {};
    try {
      const rows = await repo.ruleStatuses();
      return Object.fromEntries(Object.entries(rows).map(([id, r]) => [id, r.status]));
    } catch (err) {
      console.warn('Could not read rule statuses; treating all rules as DRAFT:', err.message);
      return {};
    }
  }

  async function logRun(run) {
    if (!repo) return { enabled: false };
    try {
      return { enabled: true, logged: true, run_id: await repo.logRun(run) };
    } catch (err) {
      return { enabled: true, logged: false, error: `Run not logged: ${err.message}` };
    }
  }

  // ---- health and metadata --------------------------------------------------
  app.get('/api/health', async (_req, res) => {
    const [mlStatus, dbStatus] = await Promise.all([
      ml.health().then((r) => ({ status: 'ok', model_id: r.data.model_id })).catch((err) => ({ status: 'unavailable', detail: err.detail ?? err.message })),
      repo ? repo.ping().then(() => 'ok').catch(() => 'unavailable') : Promise.resolve('not_configured'),
    ]);
    const ok = mlStatus.status === 'ok' && dbStatus !== 'unavailable';
    res.status(mlStatus.status === 'ok' ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded', ml: mlStatus, database: dbStatus, study_mode: config.studyModeEnabled,
    });
  });

  app.get('/api/meta', async (_req, res) => {
    res.json({ ...(await meta()), decision_rules: { count: RULES.length, disclaimer: DISCLAIMER }, study_mode: config.studyModeEnabled });
  });

  app.get('/api/origins', async (_req, res) => res.json((await ml.origins()).data));

  app.get('/api/ranges', async (req, res) => {
    const origin = req.query.origin ? v.origin(req.query.origin) : undefined;
    res.json((await ml.ranges(origin)).data);
  });

  app.get('/api/global-importance', async (_req, res) => res.json((await ml.globalImportance()).data));

  // ---- explanation and scenarios ---------------------------------------------
  app.post('/api/explain', async (req, res) => {
    const started = performance.now();
    const origin = v.origin(req.body?.origin);
    const sessionId = v.optionalCode(req.body?.sessionId, 'sessionId');
    const [{ data, latencyMs }, m, statuses] = await Promise.all([ml.explain(origin), meta(), ruleStatuses()]);

    const decision = evaluateRules({ ...data, calibration: m.calibration }, { statuses });
    const total = performance.now() - started;
    const logging = await logRun({
      session_id: sessionId, kind: 'explain', origin_period: origin, target_period: data.forecast.target_period,
      baseline_value: data.forecast.forecast_value, model_id: data.forecast.model_id,
      prompt_ids: decision.prompts.map((p) => p.rule_id), latency_ms: total,
    });

    if (data.forecast?.origin_kind === 'live' || origin > '2024-12') {
      saveLiveForecastLog({
        origin_period: origin,
        target_period: data.forecast.target_period,
        forecast_value: data.forecast.forecast_value,
        interval_lower: data.forecast.interval_lower,
        interval_upper: data.forecast.interval_upper,
        model_id: data.forecast.model_id,
      });
    }

    res.json({ ...data, decision, logging, latency_ms: { ml: latencyMs, total } });
  });

  app.post('/api/scenario', async (req, res) => {
    const started = performance.now();
    const origin = v.origin(req.body?.origin);
    const overrides = v.overrides(req.body?.overrides);
    const sessionId = v.optionalCode(req.body?.sessionId, 'sessionId');
    const [{ data, latencyMs }, m, statuses] = await Promise.all([ml.scenario(origin, overrides), meta(), ruleStatuses()]);

    const decision = evaluateRules({ ...data.scenario, comparison: data.comparison, calibration: m.calibration }, { statuses });
    const baselineDecision = evaluateRules({ ...data.baseline, calibration: m.calibration }, { statuses });
    const total = performance.now() - started;
    const logging = await logRun({
      session_id: sessionId, kind: 'scenario', origin_period: origin, target_period: data.scenario.forecast.target_period,
      overrides, baseline_value: data.baseline.forecast.forecast_value, scenario_value: data.scenario.forecast.forecast_value,
      model_id: data.scenario.forecast.model_id, support_status: data.comparison.support_status,
      prompt_ids: decision.prompts.map((p) => p.rule_id), latency_ms: total,
    });
    res.json({ ...data, decision, baseline_decision: baselineDecision, logging, latency_ms: { ml: latencyMs, total } });
  });

  // ---- live data and track record -------------------------------------------
  function checkWriteAuth(req) {
    if (config.apiWriteToken) {
      const token = req.headers['x-api-token'] || req.query.token;
      if (token !== config.apiWriteToken) {
        throw new HttpError(403, 'Forbidden: valid API write token required.');
      }
    }
  }

  app.get('/api/live/months', async (_req, res) => {
    res.json((await ml.liveMonths()).data);
  });

  app.post('/api/live/months', async (req, res) => {
    checkWriteAuth(req);
    const result = await ml.addLiveMonth(req.body);
    res.status(201).json(result.data);
  });

  app.delete('/api/live/months/:month', async (req, res) => {
    checkWriteAuth(req);
    const { month } = req.params;
    const monthsData = (await ml.liveMonths()).data;
    const list = monthsData.months ?? [];
    if (!list.length) throw new HttpError(404, 'No live months found to delete.');
    const latest = list[list.length - 1].month;
    if (month !== latest) {
      throw new HttpError(422, `Cannot delete month ${month}; only the latest month (${latest}) can be deleted to maintain chronological continuity.`);
    }
    const result = await ml.deleteLatestLiveMonth();
    res.json(result.data);
  });

  app.get('/api/live/track-record', async (_req, res) => {
    const [liveData, logs] = await Promise.all([
      ml.liveMonths().then((r) => r.data.months || []).catch(() => []),
      Promise.resolve(getLiveForecastLogs()),
    ]);
    const actualsByMonth = Object.fromEntries(
      liveData.filter((m) => m.exports_mkg != null && m.exports_mkg !== '').map((m) => [m.month, Number(m.exports_mkg)])
    );
    const records = [];
    for (const log of logs) {
      const actual = actualsByMonth[log.target_period];
      const hasActual = actual != null;
      const error = hasActual ? log.forecast_value - actual : null;
      const absError = hasActual ? Math.abs(error) : null;
      records.push({
        origin_period: log.origin_period,
        target_period: log.target_period,
        forecast_value: log.forecast_value,
        interval_lower: log.interval_lower,
        interval_upper: log.interval_upper,
        model_id: log.model_id,
        actual_value: actual ?? null,
        error,
        abs_error: absError,
        covered_by_interval: hasActual && log.interval_lower != null
          ? (actual >= log.interval_lower && actual <= log.interval_upper)
          : null,
      });
    }
    const evaluated = records.filter((r) => r.actual_value != null);
    const meanAbsError = evaluated.length
      ? evaluated.reduce((s, r) => s + r.abs_error, 0) / evaluated.length
      : null;
    res.json({
      records,
      evaluated_count: evaluated.length,
      mean_abs_error: meanAbsError,
      note: 'Forward out-of-sample evidence. Covers only live months where actual export volume has subsequently been recorded.',
    });
  });

  app.post('/api/goal-seek', async (req, res) => {
    const origin = v.origin(req.body?.origin);
    const driver = v.requiredCode(req.body?.driver, 'driver');
    const targetValue = Number(req.body?.target_value);
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      throw new HttpError(422, 'target_value must be a positive number.');
    }
    const result = await ml.goalSeek(origin, driver, targetValue);
    res.json(result.data);
  });

  app.get('/api/runs', async (req, res) => {
    if (!repo) throw unavailable('Database not configured; run history is unavailable.');
    const sessionId = v.requiredCode(req.query.sessionId, 'sessionId');
    res.json({ runs: await repo.listRuns(sessionId, 20) });
  });

  app.use('/api/rules', rulesRouter({ repo }));
  app.use('/api/study', studyRouter({ repo, enabled: config.studyModeEnabled }));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ detail: err.detail });
    if (err.type === 'entity.parse.failed') return res.status(422).json({ detail: 'Request body must be valid JSON.' });
    if (err.code === '23505') return res.status(409).json({ detail: 'Record already exists.' });
    if (err.code === '23503') return res.status(422).json({ detail: 'Referenced record does not exist.' });
    console.error(err);
    return res.status(500).json({ detail: 'Internal server error' });
  });

  return app;
}
