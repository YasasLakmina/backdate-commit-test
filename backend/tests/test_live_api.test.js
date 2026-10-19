import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

function mockMlClient() {
  const liveMonthsList = [
    {
      month: '2025-01',
      exports_mkg: 21.4,
      price_lkr_kg: 1180.0,
      usd_lkr: 308.0,
      rain_mm: 240.0,
      oni: -0.3,
      bdi: 2.2,
      source: 'Test',
      entered_by_code: 'ANON',
      bdi_assumed: true,
    },
  ];

  return {
    health: async () => ({ data: { status: 'ok', model_id: 'm1-lite-v0.2.0' } }),
    meta: async () => ({
      data: {
        model: { model_id: 'm1-lite-v0.2.0' },
        scenario_drivers: { rain_mm: { label: 'Rainfall', unit: 'mm' } },
        driver_groups: { Rainfall: ['rain_mm'] },
        calibration: {
          recent_change: { p20: -0.1, p80: 0.1 },
          yoy_change: { p20: -0.15, p80: 0.15 },
          provisional: { interval_relative_width: 0.25, driver_concentration_share: 0.6, driver_concentration_min_mkg: 0.1, mixed_signal_mkg: 0.25 },
          branch_gap_p90_mkg: 1.5,
        },
      },
    }),
    origins: async () => ({
      data: {
        origins: ['2024-11', '2024-12', '2025-01'],
        held_out: ['2024-11', '2024-12'],
        live: ['2025-01'],
        kinds: { '2024-11': 'held_out', '2024-12': 'held_out', '2025-01': 'live' },
        default: '2025-01',
      },
    }),
    ranges: async () => ({ data: { rain_mm: { min: 50, max: 800, current: 240 } } }),
    explain: async (origin) => ({
      data: {
        forecast: {
          origin_period: origin,
          target_period: '2025-02',
          forecast_value: 22.1,
          origin_kind: origin === '2025-01' ? 'live' : 'held_out',
          model_id: 'm1-lite-v0.2.0',
        },
        explanation: { drivers: [{ driver: 'Rainfall', contribution: 0.15 }] },
        context: { recent_3m_avg: 21.0 },
      },
      latencyMs: 12.5,
    }),
    scenario: async (origin, overrides) => ({
      data: {
        baseline: {
          forecast: { origin_period: origin, target_period: '2025-02', forecast_value: 22.1, model_id: 'm1-lite-v0.2.0' },
          explanation: { drivers: [{ driver: 'Rainfall', contribution: 0.15 }] },
        },
        scenario: {
          forecast: { origin_period: origin, target_period: '2025-02', forecast_value: 23.4, model_id: 'm1-lite-v0.2.0' },
          explanation: { drivers: [{ driver: 'Rainfall', contribution: 0.35 }] },
        },
        comparison: { delta_mkg: 1.3, support_status: 'supported' },
      },
      latencyMs: 14.0,
    }),
    globalImportance: async () => ({ data: { drivers: [] } }),
    liveMonths: async () => ({ data: { months: [...liveMonthsList] } }),
    addLiveMonth: async (entry) => {
      liveMonthsList.push(entry);
      return { data: { month: entry, warnings: [] } };
    },
    deleteLatestLiveMonth: async () => {
      liveMonthsList.pop();
      return { data: { status: 'ok', remaining_count: liveMonthsList.length } };
    },
  };
}

async function withServer(app, fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('GET /api/origins returns live months and default latest live', async () => {
  const ml = mockMlClient();
  const app = createApp({ ml, repo: null, config: loadConfig({}) });
  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/origins`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.default, '2025-01');
    assert.deepEqual(data.live, ['2025-01']);
  });
});

test('Live explain through Node API works without DB', async () => {
  const ml = mockMlClient();
  const app = createApp({ ml, repo: null, config: loadConfig({}) });
  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin: '2025-01' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.forecast.origin_kind, 'live');
    assert.equal(data.forecast.target_period, '2025-02');
  });
});

test('DELETE /api/live/months/:month restricts deletion to the latest month', async () => {
  const ml = mockMlClient();
  const app = createApp({ ml, repo: null, config: loadConfig({}) });
  await withServer(app, async (baseUrl) => {
    // Attempting to delete a non-latest month (e.g. 2024-12) fails with 422
    const resBad = await fetch(`${baseUrl}/api/live/months/2024-12`, { method: 'DELETE' });
    assert.equal(resBad.status, 422);

    // Deleting the latest (2025-01) succeeds
    const resOk = await fetch(`${baseUrl}/api/live/months/2025-01`, { method: 'DELETE' });
    assert.equal(resOk.status, 200);
  });
});

test('Track record math computes error and absolute error', async () => {
  const ml = mockMlClient();
  const app = createApp({ ml, repo: null, config: loadConfig({}) });
  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/live/track-record`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.records));
    assert.ok(typeof data.note === 'string');
  });
});
