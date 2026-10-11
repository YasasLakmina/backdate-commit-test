export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT ?? 4000),
    mlServiceUrl: env.ML_SERVICE_URL ?? 'http://127.0.0.1:8001',
    mlTimeoutMs: Number(env.ML_TIMEOUT_MS ?? 10000),
    // M3_DISABLE_DATABASE=true lets a launcher run without PostgreSQL even when .env has a DATABASE_URL.
    databaseUrl: env.M3_DISABLE_DATABASE === 'true' ? '' : (env.DATABASE_URL ?? ''),
    studyModeEnabled: env.STUDY_MODE_ENABLED === 'true',
    studyDesign: env.STUDY_DESIGN ?? 'between_subjects',
    apiWriteToken: env.API_WRITE_TOKEN ?? '',
  };
}
