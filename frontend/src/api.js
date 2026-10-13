async function request(path, { method, body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method: method || (body ? 'POST' : 'GET'),
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Cannot reach the M3 backend. Is it running on port 4000?');
  }
  let data;
  try {
    data = await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (res.ok) throw new Error('The M3 backend returned an unreadable response.');
    data = {};
  }
  if (!res.ok) {
    const error = new Error(data.detail ?? `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  health: () => request('/health'),
  meta: () => request('/meta'),
  origins: () => request('/origins'),
  ranges: (origin, signal) => request(`/ranges?origin=${encodeURIComponent(origin)}`, { signal }),
  globalImportance: () => request('/global-importance'),
  explain: (origin, sessionId, signal) => request('/explain', { body: { origin, sessionId }, signal }),
  scenario: (origin, overrides, sessionId, signal) => request('/scenario', { body: { origin, overrides, sessionId }, signal }),
  liveMonths: () => request('/live/months'),
  addLiveMonth: (entry) => request('/live/months', { body: entry }),
  deleteLiveMonth: (month) => request(`/live/months/${encodeURIComponent(month)}`, { method: 'DELETE' }),
  trackRecord: () => request('/live/track-record'),
  rules: () => request('/rules'),
  addReview: (ruleId, review) => request(`/rules/${encodeURIComponent(ruleId)}/reviews`, { body: review }),
  goalSeek: (origin, driver, target_value) => request('/goal-seek', { body: { origin, driver, target_value } }),
};
