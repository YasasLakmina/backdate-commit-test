"""SHAP explanation of the forecast, grouped into business drivers.

With a fixed blend weight w the forecast decomposes exactly:

    forecast = (1 - w) * base + sum((1 - w) * phi_i) + w * temporal_pred

SHAP explains only the XGBoost branch. The temporal branch is reported as one
separate term and is not broken down. Every explanation is checked against the
forecast and flagged if it does not reconcile.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import shap

from app import settings  # also puts tea_m3 on sys.path
from tea_m3 import config

RECONCILE_TOL = 1e-3
SCOPE_NOTE = ("SHAP explains the XGBoost component only. The temporal (recent-history) component "
              "is shown as one separate term and is not explained internally. Contributions are "
              "model attributions, not causal effects.")


class ExplanationUnavailable(RuntimeError):
    """The forecaster's model cannot be explained with the supported method."""


class ForecastExplainer:
    def __init__(self, forecaster, driver_groups: dict[str, list[str]] | None = None):
        self._names = forecaster.feature_names()
        self._groups = driver_groups or config.DRIVER_GROUPS
        missing = sorted(set(self._names) - {f for fs in self._groups.values() for f in fs})
        if missing:
            raise ExplanationUnavailable(f"Features without a driver group: {missing}")
        try:
            self._tree = shap.TreeExplainer(forecaster.get_xgb_model())
        except Exception as err:  # unsupported model type
            raise ExplanationUnavailable(f"TreeExplainer cannot explain this model: {err}") from err

    @property
    def base_value(self) -> float:
        # Read after shap_values(): shap updates expected_value on the first call.
        return float(np.ravel(self._tree.expected_value)[0])

    def feature_contributions(self, features: pd.DataFrame, blend_weight: float) -> pd.DataFrame:
        """Blend-scaled SHAP values for many rows (columns = feature names)."""
        phi = self._tree.shap_values(features[self._names].astype(float))
        return pd.DataFrame(np.asarray(phi) * (1 - blend_weight), columns=self._names, index=features.index)

    def explain(self, result: dict) -> dict:
        x = pd.DataFrame([result["features_used"]], columns=self._names).astype(float)
        w = float(result["blend_weight"])
        scaled = self.feature_contributions(x, w).iloc[0]

        drivers = []
        for group, feats in self._groups.items():
            value = float(scaled[feats].sum())
            drivers.append({
                "driver": group,
                "contribution": value,
                "direction": _direction(value),
                "features": {f: {"value": result["features_used"][f], "contribution": float(scaled[f])} for f in feats},
            })
        drivers.sort(key=lambda d: -abs(d["contribution"]))

        base_term = (1 - w) * self.base_value
        temporal_term = w * float(result["temporal_pred"])
        explained = float(scaled.sum())
        error = abs(base_term + explained + temporal_term - float(result["forecast_value"]))
        return {
            "method": "SHAP TreeExplainer (XGBoost component)",
            "base_term": base_term,
            "temporal_term": temporal_term,
            "explained_total": explained,
            "drivers": drivers,
            "reconciled": error <= RECONCILE_TOL,
            "reconciliation_error": error,
            "scope_note": SCOPE_NOTE,
        }

    def global_importance(self, features: pd.DataFrame, blend_weight: float) -> list[dict]:
        """Mean absolute contribution per driver over a reference set of months."""
        contrib = self.feature_contributions(features, blend_weight)
        rows = [{"driver": g, "mean_abs_contribution": float(contrib[fs].sum(axis=1).abs().mean())}
                for g, fs in self._groups.items()]
        return sorted(rows, key=lambda r: -r["mean_abs_contribution"])


def _direction(value: float) -> str:
    if value >= settings.NEUTRAL_CONTRIBUTION_MKG:
        return "up"
    if value <= -settings.NEUTRAL_CONTRIBUTION_MKG:
        return "down"
    return "neutral"
