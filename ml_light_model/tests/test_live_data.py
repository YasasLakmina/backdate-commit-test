"""Unit tests for Stage 2: live data storage, validation, gap detection, and hash preservation."""
from pathlib import Path
import pytest
import pandas as pd

from tea_m3 import config
from tea_m3.live_data import (
    raw_dataset_sha256,
    validate_live_entry,
    add_or_update_live_month,
    delete_latest_live_month,
    load_live_months,
    combined_clean_history,
    generate_template_csv,
    LIVE_CSV,
)

ORIGINAL_HASH = "f35a9cde764724e6a927c48b110a7e3b53301a0d1f808486b13f2e70bd380f03"


def test_original_dataset_is_unchanged():
    """Verify that M1's raw dataset file has not been altered."""
    current_hash = raw_dataset_sha256()
    assert current_hash == ORIGINAL_HASH, f"Raw CSV was modified! {current_hash} != {ORIGINAL_HASH}"


def test_gap_detection():
    """Verify that attempting to add a discontinuous month is rejected."""
    # With no live months, the next expected month after 2024-12 is 2025-01.
    bad_entry = {
        "month": "2025-03", # skipped 2025-01 and 2025-02
        "exports_mkg": 22.5,
        "price_lkr_kg": 1150.0,
        "usd_lkr": 305.0,
        "rain_mm": 210.0,
        "oni": -0.4,
        "bdi": 2.1,
    }
    with pytest.raises(ValueError, match="Gap detected"):
        validate_live_entry(bad_entry, existing_months=[])


def test_impossible_values_rejected():
    """Verify out-of-physical-bounds or non-numeric values are rejected."""
    # Negative rainfall
    bad_rain = {
        "month": "2025-01",
        "exports_mkg": 20.0,
        "price_lkr_kg": 1000.0,
        "usd_lkr": 300.0,
        "rain_mm": -10.0,
        "oni": 0.0,
        "bdi": 2.0,
    }
    with pytest.raises(ValueError, match="outside the plausible physical range"):
        validate_live_entry(bad_rain, existing_months=[])

    # Impossible exchange rate (e.g. negative or 5000)
    bad_fx = {
        "month": "2025-01",
        "exports_mkg": 20.0,
        "price_lkr_kg": 1000.0,
        "usd_lkr": 5000.0,
        "rain_mm": 100.0,
        "oni": 0.0,
        "bdi": 2.0,
    }
    with pytest.raises(ValueError, match="outside the plausible physical range"):
        validate_live_entry(bad_fx, existing_months=[])


def test_provenance_and_warnings():
    """Verify warnings are emitted for assumed BDI and extrapolation."""
    entry = {
        "month": "2025-01",
        "exports_mkg": 20.0,
        "price_lkr_kg": 1000.0,
        "usd_lkr": 300.0,
        "rain_mm": 150.0,
        "oni": 0.2,
        "bdi": 2.5,
        "bdi_assumed": True,
        "source": "",
    }
    warnings = validate_live_entry(entry, existing_months=[])
    assert any("assumed" in w.lower() for w in warnings)
    assert any("source" in w.lower() for w in warnings)


def test_template_roundtrip(tmp_path):
    """Verify template generation produces valid CSV structure."""
    tpl_path = tmp_path / "test_template.csv"
    res_path = generate_template_csv(through_month="2025-03", output_path=tpl_path)
    assert res_path.exists()
    df = pd.read_csv(res_path)
    assert list(df["month"]) == ["2025-01", "2025-02", "2025-03"]
    assert "bdi_assumed" in df.columns
    assert "source" in df.columns
