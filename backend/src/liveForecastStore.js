import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_FILE = path.resolve(__dirname, '../data/live_forecast_log.json');

function ensureStore() {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, '[]', 'utf8');
}

export function saveLiveForecastLog(entry) {
  try {
    ensureStore();
    const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8') || '[]');
    // Update existing for same origin or append
    const idx = data.findIndex((e) => e.origin_period === entry.origin_period && e.model_id === entry.model_id);
    const record = {
      ...entry,
      created_at: new Date().toISOString(),
    };
    if (idx >= 0) {
      data[idx] = record;
    } else {
      data.push(record);
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not save live forecast to file store:', err.message);
  }
}

export function getLiveForecastLogs() {
  try {
    ensureStore();
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}
