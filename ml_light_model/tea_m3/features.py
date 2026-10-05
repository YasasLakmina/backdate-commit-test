"""Feature engineering for a one-month-ahead forecast.

A row indexed by origin month t holds features built only from data up to and
including t, and the target is exports in month t+1. Scenario overrides are
applied to raw drivers at the origin, then every dependent feature is rebuilt by
the same code path, so lags, changes and anomalies never go stale.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from tea_m3 import config

# Months of history needed to build one feature row (fx_chg_12m needs t-12).
WINDOW_MONTHS = 13


def fit_rain_climatology(clean: pd.DataFrame, end: str = config.TRAIN_END) -> pd.Series:
    """Calendar-month mean rainfall, fitted on training months only."""
    train = clean.loc[:end, "rain_mm"]
    return train.groupby(train.index.month).mean()


def build_features(clean: pd.DataFrame, rain_clim: pd.Series) -> pd.DataFrame:
    e, p, fx = clean["exports_mkg"], clean["price_lkr_kg"], clean["usd_lkr"]
    target_month = (clean.index + 1).month

    f = pd.DataFrame(index=clean.index)
    f["exp_lag1"] = e
    f["exp_lag2"] = e.shift(1)
    f["exp_lag3"] = e.shift(2)
    f["exp_lag12"] = e.shift(11)
    f["exp_roll3"] = e.rolling(3).mean()
    f["month_sin"] = np.sin(2 * np.pi * target_month / 12)
    f["month_cos"] = np.cos(2 * np.pi * target_month / 12)
    f["price_usd_kg"] = p / fx
    f["price_chg_3m"] = p / p.shift(3) - 1
    f["price_vol_6m"] = p.pct_change().rolling(6).std()
    f["fx_chg_3m"] = fx / fx.shift(3) - 1
    f["fx_chg_12m"] = fx / fx.shift(12) - 1
    f["rain_mm"] = clean["rain_mm"]
    f["rain_anom"] = clean["rain_mm"] - pd.Series(clean.index.month, index=clean.index).map(rain_clim)
    f["oni"] = clean["oni"]
    f["oni_lag3"] = clean["oni"].shift(3)
    f["bdi"] = clean["bdi"]

    f["target"] = e.shift(-1)
    f["target_imputed"] = clean["exports_imputed"].shift(-1, fill_value=True).astype(bool)
    f["target_period"] = (clean.index + 1).astype(str)
    return f


def apply_overrides(clean: pd.DataFrame, origin: pd.Period, overrides: dict | None) -> pd.DataFrame:
    """Return a copy of the clean table with raw drivers replaced at the origin month."""
    if not overrides:
        return clean
    unknown = set(overrides) - set(config.SCENARIO_DRIVERS)
    if unknown:
        raise ValueError(f"Unsupported scenario driver(s): {sorted(unknown)}")
    changed = clean.copy()
    for name, value in overrides.items():
        changed.loc[origin, name] = float(value)
    return changed


def feature_row(clean: pd.DataFrame, origin: pd.Period, rain_clim: pd.Series,
                overrides: dict | None = None) -> pd.Series:
    """Features for a single origin month, rebuilt after any overrides."""
    window = clean.loc[origin - (WINDOW_MONTHS - 1): origin]
    if len(window) < WINDOW_MONTHS or window.index[-1] != origin:
        raise ValueError(f"Not enough history to build features for origin {origin}")
    window = apply_overrides(window, origin, overrides)
    return build_features(window, rain_clim).loc[origin]
