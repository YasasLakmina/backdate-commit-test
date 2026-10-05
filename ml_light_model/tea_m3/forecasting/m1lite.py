"""M1-lite: a clearly labelled, lightweight stand-in for M1's hybrid forecaster.

Two branches with a FIXED blend weight w:
  * a small XGBoost model (100 shallow trees) on the full exogenous feature vector,
    explained by SHAP in M3;
  * a linear seasonal-autoregressive temporal branch standing in for M1's LSTM.

forecast = (1 - w) * xgb_pred + w * temporal_pred

Because w is fixed, the blend decomposes exactly into scaled SHAP terms plus one
separate temporal term. M1-lite has no regime classifier, so regime is None.
"""
from __future__ import annotations

import pickle
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

from tea_m3 import config
from tea_m3.features import feature_row
from tea_m3.forecasting.interface import DriverRange, ForecastResult, ScenarioError

# Light settings: 100 trees at learning rate 0.1 trains about 2x faster than the
# earlier 300 trees at 0.05, with near-identical walk-forward accuracy.
XGB_PARAMS = dict(
    n_estimators=100, max_depth=3, learning_rate=0.1, subsample=0.8, colsample_bytree=0.8,
    min_child_weight=3, reg_lambda=1.0, random_state=config.RANDOM_SEED, n_jobs=1,
)
RIDGE_ALPHA = 1.0
INTERVAL_LEVEL = 0.80
_QUANTILES = {"min": 0.0, "p5": 0.05, "median": 0.5, "p95": 0.95, "max": 1.0}


def training_rows(features: pd.DataFrame, last_target: str | pd.Period) -> pd.DataFrame:
    """Rows usable for fitting: real (non-imputed) target up to last_target, temporal lags present."""
    target_period = pd.PeriodIndex(features["target_period"], freq="M")
    keep = (
        (target_period <= pd.Period(last_target, freq="M"))
        & features["target"].notna()
        & ~features["target_imputed"]
        & features[config.TEMPORAL_FEATURES].notna().all(axis=1)
    )
    return features.loc[keep]


def fit_branches(rows: pd.DataFrame) -> tuple[XGBRegressor, object]:
    xgb = XGBRegressor(**XGB_PARAMS)
    xgb.fit(rows[config.XGB_FEATURES], rows["target"])
    temporal = make_pipeline(StandardScaler(), Ridge(alpha=RIDGE_ALPHA))
    temporal.fit(rows[config.TEMPORAL_FEATURES], rows["target"])
    return xgb, temporal


def range_stats(clean: pd.DataFrame, end: str) -> dict[str, dict[str, float]]:
    """Training-period distributions behind the slider limits.

    Stationary drivers: quantiles of the level. Nominal drivers: quantiles of the
    3-month ratio x[t] / x[t-3], applied to the origin's value at request time.
    """
    train = clean.loc[:end]
    stats = {}
    for name in config.SCENARIO_DRIVERS:
        s = train[name]
        if name in config.NOMINAL_DRIVERS:
            s = s / s.shift(3)
        s = s.dropna()
        stats[name] = {k: float(s.quantile(q)) for k, q in _QUANTILES.items()}
    return stats


class M1Lite:
    """Implements the tea_m3.forecasting.interface.Forecaster contract."""

    def __init__(self, xgb, temporal, blend_weight: float, clean: pd.DataFrame,
                 rain_clim: pd.Series, train_end: str, data_hash: str,
                 residual_quantiles: tuple[float, float] | None = None, metrics: dict | None = None):
        self._xgb = xgb
        self._temporal = temporal
        self.blend_weight = float(blend_weight)
        self._clean = clean
        self._rain_clim = rain_clim
        self._range_stats = range_stats(clean, train_end)
        self.residual_quantiles = residual_quantiles
        self.train_end = train_end
        self.data_hash = data_hash
        self.metrics = metrics or {}
        self._origins = [str(p) for p in pd.period_range(clean.index[0] + 12, clean.index[-1], freq="M")]

    def get_clean_history(self) -> pd.DataFrame:
        """Return combined clean history (baseline + any live months)."""
        try:
            from tea_m3.live_data import combined_clean_history
            return combined_clean_history(self._clean)
        except Exception:
            return self._clean

    # ---- contract -----------------------------------------------------------
    def forecast(self, origin: str, overrides: dict[str, float] | None = None) -> ForecastResult:
        o = self._origin(origin)
        clean_df = self.get_clean_history()
        overrides = {k: v for k, v in (overrides or {}).items()}
        warnings = ["M1-lite stand-in forecaster: not the final M1 model."]
        warnings += self._validate_overrides(origin, overrides)
        overrides = {k: float(v) for k, v in overrides.items()}

        row = feature_row(clean_df, o, self._rain_clim, overrides)
        xgb_pred = float(self._xgb.predict(_frame(row, config.XGB_FEATURES))[0])
        temporal_pred = float(self._temporal.predict(_frame(row, config.TEMPORAL_FEATURES))[0])
        w = self.blend_weight
        value = (1 - w) * xgb_pred + w * temporal_pred

        lower = upper = None
        if self.residual_quantiles is not None:
            lower, upper = value + self.residual_quantiles[0], value + self.residual_quantiles[1]

        last_baseline = pd.Period("2024-12", freq="M")
        train_end_period = pd.Period(self.train_end, freq="M")

        if o > last_baseline:
            origin_kind = "live"
            warnings.append("Live forecast: no actual value yet, not part of the model evaluation.")
        elif o + 1 <= train_end_period:
            origin_kind = "in_sample"
            warnings.append("This month was in the training data (in-sample); use held-out months for evaluation.")
        else:
            origin_kind = "held_out"

        # Check for inputs outside training range
        for d in config.SCENARIO_DRIVERS:
            val = overrides.get(d, _loc_val(clean_df, o, d)) if o in clean_df.index else None
            if val is not None and d in self._range_stats:
                st = self._range_stats[d]
                if d not in config.NOMINAL_DRIVERS and (val < st["min"] or val > st["max"]):
                    warnings.append(f"Input outside training range: {d} ({val:g} outside [{st['min']:.2f}, {st['max']:.2f}]).")

        if o in clean_df.index and "fx_synthetic" in clean_df.columns and bool(_loc_val(clean_df, o, "fx_synthetic")):
            warnings.append("Exchange rate for this month is labelled synthetic in the M1 source data.")
        missing = [f for f in config.XGB_FEATURES if pd.isna(row[f])]
        if missing:
            warnings.append(f"Missing feature values handled by XGBoost defaults: {', '.join(missing)}.")

        actual = None
        if not overrides and (o + 1) in clean_df.index:
            if "exports_imputed" in clean_df.columns and bool(_loc_val(clean_df, o + 1, "exports_imputed")):
                actual = None
            else:
                act_val = _loc_val(clean_df, o + 1, "exports_mkg")
                actual = float(act_val) if pd.notna(act_val) and act_val != "" and act_val is not None else None

        return ForecastResult(
            origin_period=origin, target_period=str(o + 1), horizon_months=config.HORIZON_MONTHS,
            forecast_value=value, unit=config.UNIT, xgb_pred=xgb_pred, temporal_pred=temporal_pred,
            blend_weight=w, regime=None, interval_lower=lower, interval_upper=upper,
            interval_level=INTERVAL_LEVEL if lower is not None else None,
            features_used={f: _num(row[f]) for f in config.XGB_FEATURES},
            drivers={d: _num(overrides.get(d, _loc_val(clean_df, o, d))) for d in config.SCENARIO_DRIVERS},
            overrides=overrides, actual_value=actual, origin_kind=origin_kind,
            model_id=f"m1-lite-v{config.MODEL_VERSION}", model_mode="prototype", warnings=warnings,
        )

    def get_xgb_model(self) -> XGBRegressor:
        return self._xgb

    def feature_names(self) -> list[str]:
        return list(config.XGB_FEATURES)

    def driver_ranges(self, origin: str | None = None) -> dict[str, DriverRange]:
        """Slider limits for an origin month (default: the latest available origin)."""
        clean_df = self.get_clean_history()
        avail = self.available_origins()
        o = self._origin(origin or avail[-1])
        out = {}
        for name, meta in config.SCENARIO_DRIVERS.items():
            current = _num(_loc_val(clean_df, o, name)) if o in clean_df.index else None
            q = self._range_stats[name]
            if name in config.NOMINAL_DRIVERS:
                if current is not None:
                    limits = {k: float(current * v) for k, v in q.items()}
                    limits["median"] = current
                else:
                    limits = {k: None for k in q}
            else:
                limits = dict(q)
            out[name] = DriverRange(label=meta["label"], unit=meta["unit"], current=current, **limits)
        return out

    def model_version(self) -> dict:
        return {
            "model_name": config.MODEL_NAME, "model_id": f"m1-lite-v{config.MODEL_VERSION}",
            "version": config.MODEL_VERSION, "mode": "prototype", "is_stand_in": True,
            "target": "Total Sri Lankan tea exports, one month ahead", "unit": config.UNIT,
            "blend_weight": self.blend_weight, "trained_on_targets_up_to": self.train_end,
            "data_sha256": self.data_hash, "has_regime_classifier": False,
            "xgb_trees": XGB_PARAMS["n_estimators"],
        }

    def available_origins(self) -> list[str]:
        clean_df = self.get_clean_history()
        start = self._clean.index[0] + 12
        return [str(p) for p in pd.period_range(start, clean_df.index[-1], freq="M")]

    # ---- helpers ------------------------------------------------------------
    def _origin(self, origin: str) -> pd.Period:
        avail = self.available_origins()
        if origin not in avail:
            raise ScenarioError(f"Origin {origin} is not available; choose one of available_origins().")
        return pd.Period(origin, freq="M")

    def _validate_overrides(self, origin: str, overrides: dict) -> list[str]:
        unknown = sorted(set(overrides) - set(config.SCENARIO_DRIVERS))
        if unknown:
            raise ScenarioError(f"Unsupported scenario driver(s) {unknown}. Supported: {sorted(config.SCENARIO_DRIVERS)}")
        ranges = self.driver_ranges(origin)
        warnings = []
        for name, value in overrides.items():
            try:
                value = float(value)
            except (TypeError, ValueError):
                raise ScenarioError(f"Value for '{name}' must be a number.") from None
            r = ranges[name]
            if not np.isfinite(value):
                raise ScenarioError(f"Value for '{name}' must be finite.")
            if r["min"] is None:
                raise ScenarioError(f"{r['label']} has no value at {origin}, so it cannot be changed.")
            if value < r["min"] or value > r["max"]:
                raise ScenarioError(
                    f"{r['label']} = {value:g} is outside the historically supported range "
                    f"[{r['min']:.4g}, {r['max']:.4g}] {r['unit']}; the model cannot support it.")
            if value < r["p5"] or value > r["p95"]:
                warnings.append(f"{r['label']} = {value:g} is outside the usual range "
                                f"({r['p5']:.4g} to {r['p95']:.4g} {r['unit']}); treat the output with extra caution.")
        return warnings

    # ---- persistence --------------------------------------------------------
    def save(self, path: Path | None = None) -> Path:
        path = Path(path) if path else self.default_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.suffix == ".joblib":
            joblib.dump(self, path)
        else:
            with open(path, "wb") as f:
                pickle.dump(self, f, protocol=pickle.HIGHEST_PROTOCOL)
        return path

    @staticmethod
    def default_path() -> Path:
        return config.MODEL_DIR / f"m1lite_v{config.MODEL_VERSION}.pkl"

    @classmethod
    def load(cls, path: Path | None = None) -> "M1Lite":
        if path is None:
            pkl_path = cls.default_path()
            if pkl_path.exists():
                path = pkl_path
            else:
                joblib_path = config.MODEL_DIR / f"m1lite_v{config.MODEL_VERSION}.joblib"
                path = joblib_path if joblib_path.exists() else pkl_path
        else:
            path = Path(path)

        if not path.exists():
            raise FileNotFoundError(f"M1-lite model not found at {path}. Run notebook/training script first.")
        if path.suffix == ".joblib":
            model = joblib.load(path)
        else:
            with open(path, "rb") as f:
                model = pickle.load(f)
        if not isinstance(model, cls):
            raise TypeError(f"{path} does not contain an M1Lite model.")
        return model


def _frame(row: pd.Series, cols: list[str]) -> pd.DataFrame:
    return row[cols].astype(float).to_frame().T


def _num(v) -> float | None:
    return None if v is None or pd.isna(v) else float(v)


def _loc_val(df: pd.DataFrame, period: pd.Period, col: str):
    """Safely get scalar value from df with PeriodIndex avoiding typing warnings."""
    if period in df.index and col in df.columns:
        return df[col].get(period)
    return None
