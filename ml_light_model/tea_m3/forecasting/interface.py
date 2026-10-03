"""The forecasting contract M3 depends on.

M3 (explanations, rationale, rules, scenarios, UI) must only use this interface,
never a model's internals. M1-lite implements it now; the real M1 implements it
later through an adapter, and the same contract tests must pass for both.

Contract (five agreed functions, plus available_origins for the month selector):
    forecast(origin, overrides=None) -> ForecastResult
    get_xgb_model()                  -> tree model compatible with shap.TreeExplainer
    feature_names()                  -> ordered XGBoost-branch feature names
    driver_ranges(origin=None)       -> slider limits per scenario driver for an origin month
    model_version()                  -> identity and mode, shown as a badge
    available_origins()              -> origin months that can be forecast
"""
from __future__ import annotations

from typing import Any, Protocol, TypedDict, runtime_checkable


class ScenarioError(ValueError):
    """A scenario request that must be rejected (unknown driver, out-of-range value, bad month)."""


class ForecastResult(TypedDict):
    origin_period: str          # last month of information used (YYYY-MM)
    target_period: str          # month being forecast (YYYY-MM)
    horizon_months: int
    forecast_value: float       # blended forecast
    unit: str
    xgb_pred: float             # XGBoost branch output (explained by SHAP)
    temporal_pred: float        # temporal branch output (shown as one separate term)
    blend_weight: float         # w: forecast = (1 - w) * xgb_pred + w * temporal_pred
    regime: str | None          # None when the model has no regime classifier
    interval_lower: float | None
    interval_upper: float | None
    interval_level: float | None
    features_used: dict[str, float]   # XGBoost-branch features, in feature_names() order
    drivers: dict[str, float]         # raw scenario-driver values at the origin
    overrides: dict[str, float]
    actual_value: float | None        # realised target if known (for held-out demo months)
    origin_kind: str                  # 'live', 'held_out', or 'in_sample'
    model_id: str
    model_mode: str
    warnings: list[str]


class DriverRange(TypedDict):
    label: str
    unit: str
    current: float | None   # value at the origin month (slider default)
    min: float              # outside [min, max]: scenario rejected
    p5: float               # outside [p5, p95]: scenario allowed with a warning
    median: float
    p95: float
    max: float


@runtime_checkable
class Forecaster(Protocol):
    def forecast(self, origin: str, overrides: dict[str, float] | None = None) -> ForecastResult: ...
    def get_xgb_model(self) -> Any: ...
    def feature_names(self) -> list[str]: ...
    def driver_ranges(self, origin: str | None = None) -> dict[str, DriverRange]: ...
    def model_version(self) -> dict[str, Any]: ...
    def available_origins(self) -> list[str]: ...
