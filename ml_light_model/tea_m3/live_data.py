"""Live data extension store, ingestion, validation and history blending.

M1's raw dataset ends in 2024-12. Live months (2025-01 onward) extend the historical
series so M1-lite can forecast recent and current months (e.g. October 2026).

Non-negotiable rules:
- The original raw dataset is strictly read-only.
- No time leakage.
- No gaps: history must be continuous month by month.
- Provenance (source, entered_by_code, entered_at, is_assumed) is always recorded.
"""
from __future__ import annotations

import datetime as dt
import hashlib
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from tea_m3 import config
from tea_m3.data_prep import clean, load_raw

LIVE_DIR = config.OUT_DIR / "data" / "live"
LIVE_CSV = LIVE_DIR / "live_months.csv"

# Historical plausible sanity bands for validation (reject values outside these as impossible)
PLAUSIBLE_BOUNDS = {
    "exports_mkg": (1.0, 70.0),      # Historical ~10 to 34 mkg
    "price_lkr_kg": (50.0, 8000.0),   # Historical ~120 to 1500 LKR/kg
    "usd_lkr": (50.0, 1000.0),        # Historical ~75 to 370 LKR/USD
    "rain_mm": (0.0, 2000.0),         # Historical ~30 to 800 mm
    "oni": (-4.0, 4.0),               # ONI anomaly deg C
    "bdi": (-15.0, 25.0),             # Weighted GDP growth %
}

LIVE_COLUMNS = [
    "month",
    "exports_mkg",
    "price_lkr_kg",
    "usd_lkr",
    "rain_mm",
    "oni",
    "bdi",
    "source",
    "entered_by_code",
    "entered_at",
    "bdi_assumed",
    "notes",
]


def raw_dataset_sha256() -> str:
    """Return the SHA-256 hash of M1's original raw dataset file to verify it stays read-only."""
    if not config.RAW_CSV.exists():
        raise FileNotFoundError(f"Raw dataset not found at {config.RAW_CSV}")
    return hashlib.sha256(config.RAW_CSV.read_bytes()).hexdigest()


def ensure_live_storage() -> Path:
    LIVE_DIR.mkdir(parents=True, exist_ok=True)
    if not LIVE_CSV.exists():
        df = pd.DataFrame(columns=LIVE_COLUMNS)
        df.to_csv(LIVE_CSV, index=False)
    return LIVE_CSV


def load_live_months() -> pd.DataFrame:
    """Load the table of live months as a DataFrame sorted by month."""
    ensure_live_storage()
    if LIVE_CSV.stat().st_size == 0:
        return pd.DataFrame(columns=LIVE_COLUMNS)
    df = pd.read_csv(LIVE_CSV, dtype={"month": str, "source": str, "entered_by_code": str, "notes": str})
    if df.empty:
        return df
    df["month"] = df["month"].astype(str).str.strip()
    df = df.sort_values("month").reset_index(drop=True)
    return df


def validate_live_entry(entry: dict[str, Any], existing_months: list[str], training_ranges: dict[str, dict] | None = None) -> list[str]:
    """Validate a live month dictionary.

    Raises ValueError / ScenarioError on bad types, impossible values, or continuity gaps.
    Returns a list of warning strings (e.g. extrapolation or assumed inputs).
    """
    warnings: list[str] = []

    # 1. Month format & continuity
    month_str = str(entry.get("month", "")).strip()
    try:
        current_period = pd.Period(month_str, freq="M")
    except Exception as err:
        raise ValueError(f"Invalid month format '{month_str}'. Expected 'YYYY-MM'.") from err

    last_baseline = "2024-12"
    expected_month = str(pd.Period(existing_months[-1], freq="M") + 1) if existing_months else str(pd.Period(last_baseline, freq="M") + 1)

    if month_str in existing_months:
        pass  # update/replacement of an existing month is permitted
    elif month_str != expected_month:
        raise ValueError(
            f"Gap detected: Cannot add month {month_str}. Next expected continuous month is {expected_month}."
        )

    # 2. Field bounds and types
    for field, (low, high) in PLAUSIBLE_BOUNDS.items():
        val = entry.get(field)
        if val is None or val == "" or pd.isna(val):
            raise ValueError(f"Missing required numeric value for field '{field}'.")
        try:
            val_f = float(val)
        except (ValueError, TypeError) as err:
            raise ValueError(f"Field '{field}' must be a numeric value, got '{val}'.") from err

        if val_f < low or val_f > high:
            raise ValueError(
                f"Field '{field}' = {val_f:g} is outside the plausible physical range [{low}, {high}]."
            )

        # Check training extrapolation warning
        if training_ranges and field in training_ranges:
            tr = training_ranges[field]
            if val_f < tr.get("min", low) or val_f > tr.get("max", high):
                warnings.append(
                    f"Extrapolation: {field} ({val_f:g}) is outside historical training range [{tr['min']:.2f}, {tr['max']:.2f}]."
                )

    # 3. Provenance
    if not entry.get("source"):
        warnings.append("No source document specified for entered data.")
    if entry.get("bdi_assumed"):
        warnings.append("Buyer-Demand Index (bdi) is an assumed value carried forward.")

    return warnings


def add_or_update_live_month(entry: dict[str, Any], training_ranges: dict[str, dict] | None = None) -> tuple[pd.DataFrame, list[str]]:
    """Validate and record a live month into live storage.

    Returns (updated DataFrame, warnings list).
    """
    df = load_live_months()
    existing = list(df["month"].values) if not df.empty else []
    warnings = validate_live_entry(entry, existing, training_ranges=training_ranges)

    row = {
        "month": str(entry["month"]).strip(),
        "exports_mkg": float(entry["exports_mkg"]),
        "price_lkr_kg": float(entry["price_lkr_kg"]),
        "usd_lkr": float(entry["usd_lkr"]),
        "rain_mm": float(entry["rain_mm"]),
        "oni": float(entry["oni"]),
        "bdi": float(entry["bdi"]),
        "source": str(entry.get("source") or "User entry"),
        "entered_by_code": str(entry.get("entered_by_code") or "ANON"),
        "entered_at": str(entry.get("entered_at") or dt.datetime.now(dt.timezone.utc).isoformat()),
        "bdi_assumed": bool(entry.get("bdi_assumed", False)),
        "notes": str(entry.get("notes") or ""),
    }

    if not df.empty and row["month"] in df["month"].values:
        idx = df[df["month"] == row["month"]].index[0]
        for col, val in row.items():
            df.at[idx, col] = val
    else:
        df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)

    df = df.sort_values("month").reset_index(drop=True)
    df.to_csv(LIVE_CSV, index=False)
    return df, warnings


def delete_latest_live_month() -> pd.DataFrame:
    """Delete only the latest live month to preserve continuous chronological history."""
    df = load_live_months()
    if df.empty:
        raise ValueError("No live months to delete.")
    df = df.iloc[:-1].reset_index(drop=True)
    df.to_csv(LIVE_CSV, index=False)
    return df


def combined_clean_history(clean_baseline_df: pd.DataFrame | None = None) -> pd.DataFrame:
    """Combine M1's cleaned historical table (up to 2024-12) with live months (2025-01 onward).

    Ensures seamless continuity and identical column structure.
    """
    if clean_baseline_df is None:
        if config.CLEAN_CSV.exists():
            clean_baseline_df = pd.read_csv(config.CLEAN_CSV, index_col="date")
            clean_baseline_df.index = pd.PeriodIndex(clean_baseline_df.index, freq="M")
        else:
            raw = load_raw()
            clean_baseline_df, _ = clean(raw)

    live_df = load_live_months()
    if live_df.empty:
        return clean_baseline_df.copy()

    # Convert live rows to clean_df format
    live_rows = []
    for _, r in live_df.iterrows():
        p = pd.Period(r["month"], freq="M")
        live_rows.append({
            "date": p,
            "exports_mkg": float(r["exports_mkg"]),
            "exports_imputed": False,
            "price_lkr_kg": float(r["price_lkr_kg"]),
            "price_filled": False,
            "usd_lkr": float(r["usd_lkr"]),
            "fx_synthetic": False,
            "rain_mm": float(r["rain_mm"]),
            "rain_n_obs": 3,
            "oni": float(r["oni"]),
            "bdi": float(r["bdi"]),
        })

    live_ext = pd.DataFrame(live_rows).set_index("date")
    combined = pd.concat([clean_baseline_df, live_ext])
    combined = combined[~combined.index.duplicated(keep="last")].sort_index()

    # Verify no month gaps in the combined period range
    expected_range = pd.period_range(combined.index[0], combined.index[-1], freq="M")
    if len(combined) != len(expected_range):
        missing = set(expected_range) - set(combined.index)
        raise ValueError(f"Chronological gap in combined dataset: missing months {sorted(str(m) for m in missing)}")

    return combined


def generate_template_csv(through_month: str = "2026-09", output_path: Path | None = None) -> Path:
    """Generate a template CSV for live months with default values and blank actuals."""
    ensure_live_storage()
    path = output_path or (LIVE_DIR / "live_months_template.csv")
    start = pd.Period("2025-01", freq="M")
    end = pd.Period(through_month, freq="M")

    # Fetch last known values from baseline or live for defaults
    base = combined_clean_history()
    last_row = base.iloc[-1]

    rows = []
    for p in pd.period_range(start, end, freq="M"):
        rows.append({
            "month": str(p),
            "exports_mkg": "",
            "price_lkr_kg": f"{last_row['price_lkr_kg']:.1f}",
            "usd_lkr": f"{last_row['usd_lkr']:.1f}",
            "rain_mm": "",
            "oni": f"{last_row['oni']:.2f}",
            "bdi": f"{last_row['bdi']:.2f}",
            "source": "Forbes & Walker Monthly Review / CBSL / NOAA",
            "entered_by_code": "RESEARCHER",
            "entered_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d"),
            "bdi_assumed": True,
            "notes": "Template row",
        })

    pd.DataFrame(rows).to_csv(path, index=False)
    return path
