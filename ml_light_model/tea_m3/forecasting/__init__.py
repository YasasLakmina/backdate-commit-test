from tea_m3.forecasting.interface import DriverRange, Forecaster, ForecastResult, ScenarioError

__all__ = ["DriverRange", "Forecaster", "ForecastResult", "ScenarioError", "load_forecaster"]


def load_forecaster(path=None) -> Forecaster:
    """Load the current forecaster behind the M3 contract (M1-lite until the real M1 arrives)."""
    from tea_m3.forecasting.m1lite import M1Lite

    return M1Lite.load(path)
