"""M3 explanation service: forecast + SHAP + rationale + scenario comparison.

Depends only on the forecaster contract (tea_m3.forecasting.interface), so the
real M1 can replace M1-lite without changing this module.
"""
from __future__ import annotations

import pandas as pd

from app import settings  # also puts tea_m3 on sys.path
from app.calibration import calibrate, combination_distance, load_features, public_view
from app.explain import SCOPE_NOTE, ForecastExplainer
from app.rationale import render_rationale, render_scenario_rationale
from tea_m3 import config

USUAL_RANGE_MARKER = "outside the usual range"


class ExplanationService:
    def __init__(self, forecaster, features: pd.DataFrame | None = None):
        self.forecaster = forecaster
        self.explainer = ForecastExplainer(forecaster)
        self._features = features if features is not None else load_features()
        self.calibration = calibrate(forecaster, self._features)

    # ---- read-only metadata -------------------------------------------------
    def meta(self) -> dict:
        return {
            "model": self.forecaster.model_version(),
            "scenario_drivers": config.SCENARIO_DRIVERS,
            "driver_groups": config.DRIVER_GROUPS,
            "explanation_scope": SCOPE_NOTE,
            "test_period": {"start": config.TEST_START, "end": config.TEST_END},
            "calibration": public_view(self.calibration),
        }

    def origins(self) -> dict:
        all_origins = self.forecaster.available_origins()
        first_test_origin = str(pd.Period(config.TEST_START, freq="M") - 1)
        last_test_origin = str(pd.Period(config.TEST_END, freq="M") - 1)
        last_baseline = "2024-12"
        train_end_origin = str(pd.Period(config.TRAIN_END, freq="M") - 1)

        in_sample = [o for o in all_origins if o <= train_end_origin]
        held_out = [o for o in all_origins if first_test_origin <= o <= last_test_origin]
        live = [o for o in all_origins if o > last_baseline]

        kinds = {}
        for o in all_origins:
            if o in live:
                kinds[o] = "live"
            elif o in held_out:
                kinds[o] = "held_out"
            else:
                kinds[o] = "in_sample"

        default_origin = live[-1] if live else (held_out[-1] if held_out else all_origins[-1])

        return {
            "origins": all_origins,
            "held_out": held_out,
            "in_sample": in_sample,
            "live": live,
            "kinds": kinds,
            "default": default_origin,
        }

    def ranges(self, origin: str | None) -> dict:
        return self.forecaster.driver_ranges(origin)

    def list_live_months(self) -> list[dict]:
        from tea_m3.live_data import load_live_months
        df = load_live_months()
        if df.empty:
            return []
        return df.to_dict(orient="records")

    def add_live_month(self, entry: dict) -> tuple[dict, list[str]]:
        from tea_m3.live_data import add_or_update_live_month
        df, warnings = add_or_update_live_month(entry, training_ranges=self.ranges(None))
        saved = df[df["month"] == str(entry["month"]).strip()].iloc[0].to_dict()
        return saved, warnings

    def delete_latest_live_month(self) -> dict:
        from tea_m3.live_data import delete_latest_live_month
        df = delete_latest_live_month()
        return {"status": "ok", "remaining_count": len(df)}

    # ---- explanation ---------------------------------------------------------
    def explain(self, origin: str) -> dict:
        result = self.forecaster.forecast(origin)
        explanation = self.explainer.explain(result)
        return {
            "forecast": result,
            "explanation": explanation,
            "rationale": render_rationale(result, explanation),
            "context": self._context(result),
        }

    def scenario(self, origin: str, overrides: dict) -> dict:
        baseline = self.forecaster.forecast(origin)
        scenario = self.forecaster.forecast(origin, overrides)
        base_exp = self.explainer.explain(baseline)
        scen_exp = self.explainer.explain(scenario)
        comparison = self._compare(baseline, scenario, base_exp, scen_exp)
        return {
            "baseline": {"forecast": baseline, "explanation": base_exp,
                         "rationale": render_rationale(baseline, base_exp), "context": self._context(baseline)},
            "scenario": {"forecast": scenario, "explanation": scen_exp, "context": self._context(scenario)},
            "comparison": comparison,
            "scenario_rationale": render_scenario_rationale(baseline, scenario, comparison),
        }

    def global_importance(self) -> list[dict]:
        tp = pd.PeriodIndex(self._features["target_period"], freq="M")
        held_out = self._features[(tp >= pd.Period(config.TEST_START, freq="M")) & self._features["target"].notna()]
        w = self.forecaster.model_version().get("blend_weight", 0.0)
        return self.explainer.global_importance(held_out[self.forecaster.feature_names()], w)

    # ---- helpers -------------------------------------------------------------
    def _context(self, result: dict) -> dict:
        f = result["features_used"]
        d2 = combination_distance(f, self.calibration)
        return {
            "recent_3m_avg": f.get("exp_roll3"),
            "same_month_last_year": f.get("exp_lag12"),
            "last_month": f.get("exp_lag1"),
            "combination_d2": d2,
            "unusual_combination": d2 is not None and d2 > self.calibration["combination"]["d2_p975"],
        }

    def _compare(self, baseline: dict, scenario: dict, base_exp: dict, scen_exp: dict) -> dict:
        b, s = baseline["forecast_value"], scenario["forecast_value"]
        base_by = {d["driver"]: d["contribution"] for d in base_exp["drivers"]}
        changes = [{"driver": d["driver"], "baseline": base_by[d["driver"]], "scenario": d["contribution"],
                    "change": d["contribution"] - base_by[d["driver"]]} for d in scen_exp["drivers"]]
        changes.sort(key=lambda c: -abs(c["change"]))
        pct = (s - b) / b * 100
        prov = self.calibration["provisional"]

        range_warnings = [w for w in scenario["warnings"] if USUAL_RANGE_MARKER in w]
        unusual = self._context(scenario)["unusual_combination"] and not self._context(baseline)["unusual_combination"]
        warnings = list(range_warnings)
        if unusual:
            warnings.append("This combination of driver values is rare in the historical training data.")
        return {
            "absolute": s - b,
            "relative_percent": pct,
            "driver_changes": changes,
            "temporal_change": scen_exp["temporal_term"] - base_exp["temporal_term"],
            "negligible": abs(pct) < prov["scenario_negligible_pct"],
            "material": abs(pct) >= prov["scenario_material_pct"],
            "out_of_usual_range": bool(range_warnings),
            "unusual_combination": unusual,
            "support_status": "warning" if warnings else "supported",
            "warnings": warnings,
            "label": "Model sensitivity, not a causal prediction.",
        }
