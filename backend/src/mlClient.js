import { HttpError } from './errors.js';

/**
 * HTTP client for the Python ML service (forecast, SHAP, rationale, scenarios).
 * Errors are never hidden: 422 passes through, anything else becomes 503/502 so
 * the frontend shows an error instead of stale or invented numbers.
 */
export function createMlClient(baseUrl, timeoutMs = 10000) {
  async function call(path, { method = 'GET', body, query } = {}) {
    const url = new URL(path, baseUrl);
    for (const [k, v] of Object.entries(query ?? {})) if (v != null) url.searchParams.set(k, v);

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new HttpError(503, `ML service unavailable at ${baseUrl}: ${err.message}`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? res.statusText);
      const status = res.status === 422 ? 422 : res.status === 503 ? 503 : 502;
      throw new HttpError(status, `ML service: ${detail}`);
    }
    return { data, latencyMs: Number(res.headers.get('x-latency-ms')) || null };
  }

  return {
    health: () => call('/health'),
    meta: () => call('/meta'),
    origins: () => call('/origins'),
    ranges: (origin) => call('/ranges', { query: { origin } }),
    explain: (origin) => call('/explain', { method: 'POST', body: { origin } }),
    scenario: (origin, overrides) => call('/scenario', { method: 'POST', body: { origin, overrides } }),
    globalImportance: () => call('/global-importance'),
    liveMonths: () => call('/live/months'),
    addLiveMonth: (entry) => call('/live/months', { method: 'POST', body: entry }),
    deleteLatestLiveMonth: () => call('/live/months/latest', { method: 'DELETE' }),
    goalSeek: (origin, driver, target_value) => call('/goal-seek', { method: 'POST', body: { origin, driver, target_value } }),
  };
}
