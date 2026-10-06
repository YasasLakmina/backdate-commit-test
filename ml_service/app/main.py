"""FastAPI app exposing the M3 explanation service to the Node.js backend.

    uvicorn app.main:app --port 8001

No model logic lives here: requests are validated and passed to ExplanationService.
Errors: invalid scenario/month -> 422; model not available -> 503. There is no
silent fallback to another model or to cached numbers.
"""
from __future__ import annotations

import time
from typing import Callable

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app import settings  # also puts tea_m3 on sys.path
from tea_m3.forecasting import ScenarioError, load_forecaster

from app.explain import ExplanationUnavailable
from app.service import ExplanationService


class ExplainRequest(BaseModel):
    origin: str = Field(pattern=r"^\d{4}-\d{2}$", examples=["2024-03"])


class ScenarioRequest(ExplainRequest):
    overrides: dict[str, float] = Field(min_length=1, examples=[{"rain_mm": 200.0}])


class GoalSeekRequest(BaseModel):
    origin: str = Field(pattern=r"^\d{4}-\d{2}$")
    driver: str
    target_value: float


def _default_service() -> ExplanationService:
    return ExplanationService(load_forecaster(settings.MODEL_PATH))


def create_app(service_factory: Callable[[], ExplanationService] = _default_service) -> FastAPI:
    app = FastAPI(title="M3 XAI ML service", version="0.1.0")
    state: dict = {"service": None, "error": None}

    def service() -> ExplanationService:
        if state["service"] is None:
            try:
                state["service"] = service_factory()
                state["error"] = None
            except (FileNotFoundError, ExplanationUnavailable, TypeError) as err:
                state["error"] = str(err)
                raise HTTPException(503, f"Model not available: {err}") from err
        return state["service"]

    @app.middleware("http")
    async def timing(request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Latency-Ms"] = f"{(time.perf_counter() - started) * 1000:.1f}"
        return response

    @app.exception_handler(ScenarioError)
    async def scenario_error(_: Request, err: ScenarioError):
        return JSONResponse(status_code=422, content={"detail": str(err)})

    @app.exception_handler(ValueError)
    async def value_error(_: Request, err: ValueError):
        return JSONResponse(status_code=422, content={"detail": str(err)})

    @app.get("/health")
    def health():
        try:
            svc = service()
            live = svc.list_live_months()
            return {
                "status": "ok",
                "model_id": svc.forecaster.model_version()["model_id"],
                "live_months_count": len(live),
                "latest_live_month": live[-1]["month"] if live else None,
            }
        except HTTPException as err:
            return JSONResponse(status_code=503, content={"status": "unavailable", "detail": err.detail})

    @app.get("/meta")
    def meta():
        return service().meta()

    @app.get("/origins")
    def origins():
        return service().origins()

    @app.get("/ranges")
    def ranges(origin: str | None = None):
        return service().ranges(origin)

    @app.post("/explain")
    def explain(req: ExplainRequest):
        return service().explain(req.origin)

    @app.post("/scenario")
    def scenario(req: ScenarioRequest):
        return service().scenario(req.origin, req.overrides)

    @app.get("/global-importance")
    def global_importance():
        return {"reference": "held-out test months", "drivers": service().global_importance()}

    @app.get("/live/months")
    def get_live_months():
        return {"months": service().list_live_months()}

    @app.post("/live/months")
    def add_live_month(entry: dict):
        saved, warnings = service().add_live_month(entry)
        return {"month": saved, "warnings": warnings}

    @app.delete("/live/months/latest")
    def delete_live_month():
        return service().delete_latest_live_month()

    @app.post("/goal-seek")
    def goal_seek(req: GoalSeekRequest):
        svc = service()
        r = svc.ranges(req.origin).get(req.driver)
        if not r or r["p5"] is None or r["p95"] is None:
            raise HTTPException(422, f"Driver '{req.driver}' has no valid range at {req.origin}.")

        low, high = float(r["p5"]), float(r["p95"])
        grid = np.linspace(low, high, 50)
        best_val = low
        best_gap = float("inf")
        best_fc = None

        for val in grid:
            fc = svc.forecaster.forecast(req.origin, overrides={req.driver: float(val)})
            pred = float(fc["forecast_value"])
            gap = abs(pred - req.target_value)
            if gap < best_gap:
                best_gap = gap
                best_val = float(val)
                best_fc = pred

        return {
            "origin": req.origin,
            "driver": req.driver,
            "target_value": req.target_value,
            "best_driver_value": best_val,
            "resulting_forecast": best_fc,
            "gap_mkg": best_gap,
            "allowed_range": [low, high],
            "reachable": best_gap <= 0.1,
            "note": "Sensitivity exploration within historical p5-p95 range. Trees exhibit step responses; individual driver effects are small (~0.1-0.3 mkg).",
        }

    return app


app = create_app()
