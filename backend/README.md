# M3 Node.js Backend API

Component M3 (Explainable AI & Decision Support) of Project J26-IT-423.
This service provides the orchestration API, decision rules engine, study-mode manager, and live-data persistence.

## Architecture

- **Runtime:** Node.js 22+ (Express framework)
- **Port:** 4000 (default, configurable via `PORT`)
- **Persistence:** 
  - PostgreSQL when available (`DATABASE_URL`)
  - Seamless zero-database fallback: live months in `data/live/live_months.csv` and live forecast evidence in `data/live_forecast_log.json`
- **Security:** Write endpoints (`/api/live/months`, `/api/study/*`) protected via `API_WRITE_TOKEN`.

## Endpoints

### Core Explanations & Scenarios
- `GET /api/origins`: Available forecast origin months grouped by kind (`live`, `held_out`, `in_sample`).
- `GET /api/explain?origin=YYYY-MM`: Retrospective or live baseline forecast, SHAP attributions, natural-language rationale, and triggered decision prompts.
- `GET /api/explain?origin=YYYY-MM&interactive=1&<driver>=<val>`: What-if counterfactual scenario simulation.
- `POST /api/goal-seek`: Search single-driver parameter space (p5–p95) to achieve target volume.

### Live Mode Operations
- `GET /api/live/months`: Retrieve all ingested live actual months (2025-01 onward).
- `POST /api/live/months`: Ingest new actual month (validates physical bounds, requires continuous history without gaps, logs provenance and assumed inputs).
- `DELETE /api/live/months/:month`: Remove latest live month (restricted to latest to avoid history gaps).
- `GET /api/live/track-record`: Out-of-sample forward evaluation comparison (forecast vs actual) and running MAE.

### Decision Rules & Governance
- `GET /api/rules`: List all 15 decision rules with metadata, trigger thresholds, and review counts.
- `POST /api/rules/:ruleId/reviews`: Submit structured domain expert review (role, experience, assessment, rewording). Rules remain `DRAFT` until expert consensus.

### Study Mode (Locked by Default)
- `STUDY_MODE_ENABLED=false` by default. Requires supervisor and ethics clearance.
- Supports `STUDY_DESIGN`: `between_subjects` (Group A static, Group B interactive) or `within_subject_counterbalanced`.

## Running & Testing

```bash
npm install
npm test          # Node.js built-in test runner (node --test)
npm start         # Runs node src/server.js
```
