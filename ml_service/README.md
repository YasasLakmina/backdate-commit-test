# M3 Machine Learning Service (FastAPI)

Component M3 (Explainable AI & Decision Support) of Project J26-IT-423.
This Python service provides high-performance SHAP feature attributions, natural-language business rationale, and scenario simulations.

## Architecture

- **Runtime:** Python 3.11+ / 3.14+ (FastAPI + Uvicorn)
- **Port:** 8001
- **Model:** M1-lite stand-in (`tea_m3.forecasting.m1lite.M1Lite`), persisted as `m1lite_v0.2.0.pkl`
- **Explainability:** `shap.TreeExplainer` on XGBoost branch with exact blend additivity:
  $$\text{Forecast} = (1 - w) \cdot \text{base} + \sum (1 - w)\phi_i + w \cdot \text{temporal}$$
- **Rationale Engine:** Jinja2 structured templates generating human-readable business narratives from SHAP values and directional momentum.

## Endpoints

- `GET /health`: Service health check, active model ID, and live months count.
- `GET /origins`: List of valid origin months with origin kinds (`live`, `held_out`, `in_sample`).
- `GET /explain?origin=YYYY-MM`: Core forecast, exact SHAP attributions, and English business rationale.
- `POST /scenario`: What-if simulation evaluating raw driver overrides, recalculating dependent features, and comparing against baseline.
- `POST /goal-seek`: Grid search across 5th–95th percentile driver domain to identify closest setting achieving a user-specified export target.
- `GET /live/months`: List of live extension months.
- `POST /live/months`: Ingest and validate new live month into combined clean history.
- `DELETE /live/months/latest`: Roll back latest live month.

## Running

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8001
```
