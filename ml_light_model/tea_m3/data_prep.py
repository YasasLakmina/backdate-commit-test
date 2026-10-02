"""Clean M1's raw monthly table into the small set of series M1-lite and M3 need.

Every correction is recorded in a cleaning log so the dataset QA report can show
exactly what was changed and why. Nothing is invented: values that cannot be
recovered are left missing (or forward-filled with an explicit flag).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from tea_m3 import config

PRODUCT_COLS = ["TB_Bulk_Tea", "TB_Packets", "TB_Tea_Bags", "TB_Instant_Tea", "TB_Green_Tea"]
ELEVATIONS = ["High", "Medium", "Low"]

EXPORT_MISMATCH_TOL = 0.05   # relative gap between total and product sum treated as an error
PRICE_RATIO_BAND = (0.75, 1.33)  # allowed deviation from an elevation's typical cross-elevation ratio
RAIN_MAX_PLAUSIBLE_MM = 1500.0   # above any legitimate monthly value in the training data


def load_raw(path=config.RAW_CSV) -> pd.DataFrame:
    raw = pd.read_csv(path)
    raw["Date"] = raw["Date"].astype(str)
    return raw


def clean(raw: pd.DataFrame) -> tuple[pd.DataFrame, list[dict]]:
    """Return (clean monthly table indexed by month, cleaning log)."""
    log: list[dict] = []

    dup = raw["Date"].duplicated(keep="first")
    for date in raw.loc[dup, "Date"]:
        log.append({"date": date, "field": "row", "action": "dropped exact duplicate month"})
    raw = raw.loc[~dup].reset_index(drop=True)

    months = pd.period_range(raw["Date"].iloc[0], raw["Date"].iloc[-1], freq="M")
    raw = raw.set_index(pd.PeriodIndex(raw["Date"], freq="M")).reindex(months)
    for p in raw.index[raw["Date"].isna()]:
        log.append({"date": str(p), "field": "row", "action": "month missing from raw file"})

    out = pd.DataFrame(index=raw.index)
    out.index.name = "date"
    out["exports_mkg"], out["exports_imputed"] = _clean_exports(raw, log)
    out["price_lkr_kg"], out["price_filled"] = _clean_price(raw, log)
    out["usd_lkr"] = raw["FX_USD_LKR"].astype(float)
    out["fx_synthetic"] = raw["FX_origin"].eq("synthetic")
    out["rain_mm"], out["rain_n_obs"] = _clean_rain(raw, log)
    out["oni"] = _lag_safe_oni(raw)
    out["bdi"] = _buyer_demand_index(raw)
    return out, log


def _clean_exports(raw: pd.DataFrame, log: list[dict]) -> tuple[pd.Series, pd.Series]:
    # Units switch from million kg (to 2005-12) to kg (from 2006-01).
    scale = np.where(raw["TB_Quantity_Unit"].eq("kg"), 1e-6, 1.0)
    total = raw["TB_Total_Exports"] * scale
    product_sum = raw[PRODUCT_COLS].mul(scale, axis=0).sum(axis=1, min_count=len(PRODUCT_COLS))

    exports = total.copy()
    for p in raw.index:
        t, s = total[p], product_sum[p]
        if pd.notna(t) and pd.notna(s) and abs(t - s) / s > EXPORT_MISMATCH_TOL:
            exports[p] = s
            log.append({"date": str(p), "field": "exports_mkg",
                        "action": f"total {t:.3f} disagreed with product sum {s:.3f}; used product sum"})
        elif pd.isna(t) and pd.notna(s):
            exports[p] = s
            log.append({"date": str(p), "field": "exports_mkg",
                        "action": f"total missing; used product sum {s:.3f}"})

    imputed = exports.isna()
    for p in exports.index[imputed]:
        log.append({"date": str(p), "field": "exports_mkg",
                    "action": "missing; linearly interpolated for lag features only, excluded as a target"})
    exports = exports.interpolate(limit_area="inside")
    return exports, imputed


def _clean_price(raw: pd.DataFrame, log: list[dict]) -> tuple[pd.Series, pd.Series]:
    prices = pd.DataFrame({e: raw[f"AUC_{e}_price_mean"].astype(float) for e in ELEVATIONS})
    med3 = prices.median(axis=1)
    ratios = prices.div(med3, axis=0)
    # Typical cross-elevation ratio, estimated on the training period only.
    typical = ratios.loc[: config.TRAIN_END].median()

    lo, hi = PRICE_RATIO_BAND
    rel = ratios / typical
    bad = (rel < lo) | (rel > hi)
    cleaned = prices.mask(bad, med3.to_numpy()[:, None] * typical.to_numpy()[None, :])
    for p, e in zip(*np.nonzero(bad.to_numpy())):
        period, elev = prices.index[p], ELEVATIONS[e]
        log.append({"date": str(period), "field": f"AUC_{elev}_price_mean",
                    "action": f"value {prices.iat[p, e]:.1f} inconsistent with other elevations; "
                              f"replaced by {cleaned.iat[p, e]:.1f}"})

    price = cleaned.mean(axis=1)
    filled = price.isna()
    for p in price.index[filled]:
        log.append({"date": str(p), "field": "price_lkr_kg",
                    "action": "no auction price; carried forward last known price"})
    return price.ffill(), filled


def _clean_rain(raw: pd.DataFrame, log: list[dict]) -> tuple[pd.Series, pd.Series]:
    stations = {}
    for s in config.RAIN_STATIONS:
        col = raw[f"RAIN_{s}"].astype(float)
        for p in col.index[col.eq(-999)]:
            log.append({"date": str(p), "field": f"RAIN_{s}", "action": "-999 sentinel set to missing"})
        for p in col.index[col > RAIN_MAX_PLAUSIBLE_MM]:
            log.append({"date": str(p), "field": f"RAIN_{s}",
                        "action": f"implausible {col[p]:.0f} mm set to missing"})
        stations[s] = col.mask(col.eq(-999) | (col > RAIN_MAX_PLAUSIBLE_MM))
    rain = pd.DataFrame(stations)
    n_obs = rain.notna().sum(axis=1)

    # Fill a missing station with its training-period calendar-month median so the
    # three-station mean is not biased towards whichever stations reported.
    train = rain.loc[: config.TRAIN_END]
    clim = train.groupby(train.index.month).median()
    filled = rain.copy()
    for s in config.RAIN_STATIONS:
        filled[s] = rain[s].fillna(pd.Series(rain.index.month, index=rain.index).map(clim[s]))
    return filled.mean(axis=1), n_obs


def _lag_safe_oni(raw: pd.DataFrame) -> pd.Series:
    """Map each 3-month ONI season to the month after the season ends.

    The raw row for month m holds the season centred on m (e.g. Jan = DJF), which
    ends in m+1. It is only known from m+2 onwards, so shift by two months.
    """
    return raw["ONI_anom"].astype(float).shift(2)


def _buyer_demand_index(raw: pd.DataFrame) -> pd.Series:
    """Constructed proxy: buyer-country GDP growth weighted by recent import shares.

    Weights use the trailing 12 months of Comtrade volumes ending two months before
    the origin (publication delay). GDP growth for year Y is treated as available
    from April of Y+1. This is a proxy, not observed demand.
    """
    vols = pd.DataFrame({c: raw[f"CT_kg_{c}"].astype(float) for c in config.BUYER_COUNTRIES})
    weights = vols.shift(2).rolling(12, min_periods=6).sum()

    gdp_by_year = {c: raw[f"GDP_{c}"].astype(float).groupby(raw.index.year).first()
                   for c in config.BUYER_COUNTRIES}
    years = np.where(raw.index.month >= 4, raw.index.year - 1, raw.index.year - 2)
    gdp = pd.DataFrame({c: gdp_by_year[c].reindex(years).to_numpy() for c in config.BUYER_COUNTRIES},
                       index=raw.index)

    usable = weights.notna() & gdp.notna()
    w = weights.where(usable)
    return (w * gdp).sum(axis=1, min_count=1) / w.sum(axis=1, min_count=1)


def qa_report(clean_df: pd.DataFrame, log: list[dict], raw: pd.DataFrame) -> str:
    lines = ["# Dataset QA report: tea_monthly_clean.csv", "",
             f"Source: `{config.RAW_CSV.name}` ({len(raw)} raw rows, "
             f"{raw['Date'].iloc[0]} to {raw['Date'].iloc[-1]}).",
             f"Clean table: {len(clean_df)} months, {clean_df.index[0]} to {clean_df.index[-1]}.", "",
             "## Series", "", "| Column | Missing | Min | Median | Max |", "|---|---|---|---|---|"]
    for c in ["exports_mkg", "price_lkr_kg", "usd_lkr", "rain_mm", "oni", "bdi"]:
        s = clean_df[c]
        lines.append(f"| {c} | {s.isna().sum()} | {s.min():.2f} | {s.median():.2f} | {s.max():.2f} |")
    lines += ["", "## Flags", "",
              f"- Export months imputed (excluded as targets): {int(clean_df['exports_imputed'].sum())}",
              f"- Auction months carried forward: {int(clean_df['price_filled'].sum())}",
              f"- Months with synthetic FX (FX_origin = synthetic): {int(clean_df['fx_synthetic'].sum())} "
              f"({clean_df.index[clean_df['fx_synthetic']].min()} to {clean_df.index[clean_df['fx_synthetic']].max()})",
              f"- Months with fewer than 3 rain stations reporting: {int((clean_df['rain_n_obs'] < 3).sum())}",
              "", "## Known limitations", "",
              "- FX before 2014 is labelled synthetic in M1's raw file; its origin must be confirmed with the M1 owner.",
              "- Buyer-demand index is a constructed proxy from annual GDP growth and Comtrade shares.",
              "- No domestic production series is present, so the domestic-supply driver is not modelled.",
              "- Auction price is the mean of the three elevation averages, not an official national average.",
              "", f"## Cleaning log ({len(log)} entries)", "", "| Date | Field | Action |", "|---|---|---|"]
    lines += [f"| {e['date']} | {e['field']} | {e['action']} |" for e in log]
    return "\n".join(lines) + "\n"
