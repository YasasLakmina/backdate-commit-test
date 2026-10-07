"""Training-derived thresholds for decision prompts and scenario checks.

Every threshold comes from the training period (targets up to config.TRAIN_END) or
from validation forecasts, never from test months. Provisional presentation
thresholds that are design choices are listed separately and labelled as such.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app import settings  # also puts tea_m3 on sys.path
from tea_m3 import config
from tea_m3.data_prep import clean, load_raw
from tea_m3.features import build_features, fit_rain_climatology

# Stationary driver representations used for the unusual-combination check.
COMBINATION_FEATURES = ["rain_mm", "oni", "bdi", "fx_chg_3m", "price_chg_3m"]

PROVISIONAL = {
    "interval_relative_width": 0.25,      # 80% range wider than 25% of the forecast
    "driver_concentration_share": 0.60,   # one driver >= 60% of explained movement
    "driver_concentration_min_mkg": 0.10,
    "mixed_signal_mkg": 0.25,             # both up and down sums at least this large
    "scenario_material_pct": 2.0,         # scenario change >= 2% of baseline
    "scenario_negligible_pct": 0.5,       # scenario change < 0.5% of baseline
}


def load_features() -> pd.DataFrame:
    clean_df, _ = clean(load_raw())
    return build_features(clean_df, fit_rain_climatology(clean_df, config.TRAIN_END))


def calibrate(forecaster, features: pd.DataFrame) -> dict:
    target_period = pd.PeriodIndex(features["target_period"], freq="M")
    usable = features["target"].notna() & ~features["target_imputed"]
    train = features[usable & (target_period <= pd.Period(config.TRAIN_END, freq="M"))]

    recent_change = (train["target"] / train["exp_roll3"] - 1).dropna()
    yoy_change = (train["target"] / train["exp_lag12"] - 1).dropna()

    # Gap between the two branches on validation origins (out-of-sample for the
    # branch-disagreement rule; never test months).
    gaps = []
    for target in pd.period_range(config.VAL_START, config.VAL_END, freq="M"):
        r = forecaster.forecast(str(target - 1))
        gaps.append(abs(r["xgb_pred"] - r["temporal_pred"]))

    combo = train[COMBINATION_FEATURES].dropna().astype(float)
    mean = combo.mean().to_numpy()
    cov_inv = np.linalg.pinv(np.cov(combo.to_numpy(), rowvar=False))
    d2 = _mahalanobis_sq(combo.to_numpy(), mean, cov_inv)

    return {
        "source": f"training targets up to {config.TRAIN_END}; branch gap from validation {config.VAL_START} to {config.VAL_END}",
        "recent_change": {"p20": float(recent_change.quantile(0.2)), "p80": float(recent_change.quantile(0.8))},
        "yoy_change": {"p20": float(yoy_change.quantile(0.2)), "p80": float(yoy_change.quantile(0.8))},
        "branch_gap_p90_mkg": float(np.quantile(gaps, 0.9)),
        "combination": {"features": COMBINATION_FEATURES, "mean": mean.tolist(),
                        "cov_inv": cov_inv.tolist(), "d2_p975": float(np.quantile(d2, 0.975))},
        "provisional": dict(PROVISIONAL),
    }


def combination_distance(features_used: dict, calibration: dict) -> float | None:
    """Squared Mahalanobis distance of a month's driver combination from training data."""
    c = calibration["combination"]
    values = [features_used.get(f) for f in c["features"]]
    if any(v is None or not np.isfinite(v) for v in values):
        return None
    return float(_mahalanobis_sq(np.array([values], dtype=float), np.array(c["mean"]), np.array(c["cov_inv"]))[0])


def public_view(calibration: dict) -> dict:
    """Thresholds the Node.js rule engine needs (without matrices)."""
    return {k: v for k, v in calibration.items() if k != "combination"} | {
        "combination_d2_p975": calibration["combination"]["d2_p975"]}


def _mahalanobis_sq(x: np.ndarray, mean: np.ndarray, cov_inv: np.ndarray) -> np.ndarray:
    diff = x - mean
    return np.einsum("ij,jk,ik->i", diff, cov_inv, diff)
