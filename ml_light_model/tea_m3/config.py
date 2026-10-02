"""Central configuration: paths, chronological splits, feature lists and driver groups.

Assumptions live here rather than inside model or UI code so they can be reviewed
and changed in one place.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# The M1 dataset is read from data/raw/ if a copy exists there, otherwise from the
# group's shared "Full detail Document" folder. M3_RAW_CSV overrides both.
_RAW_NAME = "M1_combined_monthly_raw.csv"
_RAW_CANDIDATES = [ROOT / "data" / "raw" / _RAW_NAME, ROOT.parent / "Full detail Document" / _RAW_NAME]
RAW_CSV = Path(os.environ.get("M3_RAW_CSV") or next((p for p in _RAW_CANDIDATES if p.exists()), _RAW_CANDIDATES[0]))

# Generated outputs go under M3_OUT_DIR (default: this project folder). Override it
# when the project folder is not writable, e.g. under Windows Controlled Folder Access.
OUT_DIR = Path(os.environ.get("M3_OUT_DIR") or ROOT)
CLEAN_CSV = OUT_DIR / "data" / "processed" / "tea_monthly_clean.csv"
MODEL_DIR = OUT_DIR / "models"
REPORT_DIR = OUT_DIR / "reports"

MODEL_NAME = "M1-lite"
MODEL_VERSION = "0.2.0"
RANDOM_SEED = 42

# Chronological splits by TARGET month (the month being forecast), matching the
# group's M1 plan: train 2000-2018, validate 2019-2021, test 2022-2024.
TRAIN_END = "2018-12"
VAL_START, VAL_END = "2019-01", "2021-12"
TEST_START, TEST_END = "2022-01", "2024-12"

# Target: total national tea exports (million kg) for month t+1, forecast from
# information available at the end of month t.
TARGET = "exports_mkg"
HORIZON_MONTHS = 1
UNIT = "million_kg"

# Raw drivers that the what-if simulator may override at the forecast origin.
# Derived features are recomputed from these after an override.
SCENARIO_DRIVERS = {
    "rain_mm": {"label": "Rainfall (3-station mean)", "unit": "mm/month"},
    "usd_lkr": {"label": "Exchange rate", "unit": "LKR per USD"},
    "price_lkr_kg": {"label": "Colombo auction price (3-elevation mean)", "unit": "LKR/kg"},
    "bdi": {"label": "Buyer-demand index (constructed proxy)", "unit": "weighted GDP growth, %"},
    "oni": {"label": "ENSO (ONI anomaly, lag-safe)", "unit": "deg C"},
}
# Nominal LKR series trend strongly (FX ~77 in 2000, ~330 in 2023), so their slider
# limits are set relative to the origin month from historical 3-month moves, and
# the model sees them only as USD price and percentage changes.
NOMINAL_DRIVERS = ["usd_lkr", "price_lkr_kg"]

# XGBoost branch features (names are relative to the TARGET month t+1:
# exp_lag1 = exports in month t, exp_lag12 = same month last year).
XGB_FEATURES = [
    "exp_lag1", "exp_lag2", "exp_lag3", "exp_lag12", "exp_roll3",
    "month_sin", "month_cos",
    "price_usd_kg", "price_chg_3m", "price_vol_6m",
    "fx_chg_3m", "fx_chg_12m",
    "rain_mm", "rain_anom",
    "oni", "oni_lag3",
    "bdi",
]

# Temporal branch (linear seasonal-autoregressive stand-in for M1's LSTM).
TEMPORAL_FEATURES = ["exp_lag1", "exp_lag2", "exp_lag3", "exp_lag12", "month_sin", "month_cos"]

# Business-friendly driver groups for M3 explanations.
DRIVER_GROUPS = {
    "Export momentum": ["exp_lag1", "exp_lag2", "exp_lag3", "exp_lag12", "exp_roll3"],
    "Seasonality": ["month_sin", "month_cos"],
    "Auction prices": ["price_usd_kg", "price_chg_3m", "price_vol_6m"],
    "Exchange rate": ["fx_chg_3m", "fx_chg_12m"],
    "Rainfall": ["rain_mm", "rain_anom"],
    "ENSO": ["oni", "oni_lag3"],
    "Buyer demand": ["bdi"],
}

BUYER_COUNTRIES = [
    "Azerbaijan", "Chile", "Iran", "Iraq", "Japan", "Libya",
    "Russian_Federation", "Syrian_Arab_Republic", "Turkiye", "United_Arab_Emirates",
]
RAIN_STATIONS = ["Badulla", "Nuwara_Eliya", "Ratnapura"]
