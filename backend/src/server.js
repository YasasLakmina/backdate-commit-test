import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createRepositoryFromUrl } from './db/repository.js';
import { createMlClient } from './mlClient.js';
import { RULES } from './rules/catalogue.js';

const config = loadConfig();
const ml = createMlClient(config.mlServiceUrl, config.mlTimeoutMs);
const repo = createRepositoryFromUrl(config.databaseUrl);

if (repo) {
  try {
    await repo.syncRules(RULES);
    console.log(`Database connected; ${RULES.length} decision rules synced.`);
  } catch (err) {
    console.warn(`Database unavailable (${err.message}). The API runs, but logging, reviews and study storage will fail until it is reachable.`);
  }
} else {
  console.warn('DATABASE_URL not set: running without a database (no run log, reviews or study storage).');
}
if (config.studyModeEnabled) console.warn('STUDY MODE ENABLED: only use after supervisor and ethics approval.');

createApp({ ml, repo, config }).listen(config.port, () => {
  console.log(`M3 backend on http://localhost:${config.port} (ML service: ${config.mlServiceUrl})`);
});
