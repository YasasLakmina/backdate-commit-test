import sys
import time
from pathlib import Path
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / "ml_service") not in sys.path:
    sys.path.insert(0, str(ROOT / "ml_service"))

from tea_m3.forecasting.m1lite import M1Lite
from tea_m3.live_data import add_or_update_live_month, delete_latest_live_month, load_live_months


@pytest.fixture(autouse=True)
def ensure_live_month_fixture():
    """Ensure at least one continuous live month (2025-01) is present for live tests, then clean up."""
    # Record starting count
    initial_live = load_live_months()
    if initial_live.empty or "2025-01" not in initial_live["month"].values:
        add_or_update_live_month({
            "month": "2025-01",
            "exports_mkg": 21.4,
            "price_lkr_kg": 1180.0,
            "usd_lkr": 308.0,
            "rain_mm": 240.0,
            "oni": -0.3,
            "bdi": 2.2,
            "source": "Synthetic test fixture",
            "entered_by_code": "TEST-FX",
            "bdi_assumed": True,
        })
    yield
    # Cleanup after test if needed
    current = load_live_months()
    if not current.empty and len(current) > len(initial_live):
        try:
            delete_latest_live_month()
        except Exception:
            pass


def test_live_origin_forecast_contract():
    model = M1Lite.load()
    origins = model.available_origins()
    live_origins = [o for o in origins if o >= "2025-01"]
    assert len(live_origins) > 0

    latest_live = live_origins[-1]
    res = model.forecast(latest_live)
    assert res["origin_period"] == latest_live
    assert res["origin_kind"] == "live"
    # Target of latest live origin has no entered actual value yet
    assert res["actual_value"] is None
    assert any("Live forecast" in w for w in res["warnings"])
    assert res["forecast_value"] > 0


def test_shap_reconciliation_live_origin():
    """Verify that exact blend decomposition holds on a live origin."""
    from app.explain import ForecastExplainer

    model = M1Lite.load()
    res = model.forecast("2025-01")
    explainer = ForecastExplainer(model)
    exp = explainer.explain(res)

    assert exp["reconciled"] is True
    assert exp["reconciliation_error"] < 1e-3, f"Error {exp['reconciliation_error']} exceeds tolerance"


def test_live_scenario_isolation_and_latency():
    """Verify what-if scenario does not mutate baseline and responds under 2 seconds."""
    model = M1Lite.load()
    t0 = time.perf_counter()
    base = model.forecast("2025-01")
    scen = model.forecast("2025-01", overrides={"rain_mm": 350.0})
    duration = time.perf_counter() - t0

    assert duration < 2.0, f"Scenario latency {duration:.2f}s exceeded 2.0s limit"
    assert scen["drivers"]["rain_mm"] == 350.0
    assert base["drivers"]["rain_mm"] != 350.0
    assert scen["forecast_value"] != base["forecast_value"]
    # Rerun base to ensure no mutation
    base_check = model.forecast("2025-01")
    assert base_check["drivers"]["rain_mm"] == base["drivers"]["rain_mm"]
    assert base_check["forecast_value"] == base["forecast_value"]
