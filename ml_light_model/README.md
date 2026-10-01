# XAI Decision Support: Light Model (M1-lite)

Component M3 (Explainable AI & Decision Support, IT23293076) of project J26-IT-423.
M1's real hybrid forecaster is not finished, so this folder provides **M1-lite**: a
clearly labelled, lightweight stand-in, trained on M1's own dataset, behind the
fixed interface that M3's explanation, rationale, rules, simulator and UI are built
against. When the real M1 is ready, only an adapter changes; M3's code and tests
stay the same.

**Light model:** 100 shallow XGBoost trees + a linear temporal branch. Full train
and evaluation about 13 s, model file 147 KB, one forecast or scenario about 10 ms.

## What is here

| Path | Purpose |
|---|---|
| `tea_m3/config.py` | Paths, splits, features, scenario drivers, driver groups |
| `tea_m3/data_prep.py` | Cleans `M1_combined_monthly_raw.csv`; writes a cleaning log |
| `tea_m3/features.py` | Lag-safe features for a one-month-ahead forecast; scenario overrides |
| `tea_m3/forecasting/interface.py` | **The contract M3 depends on** |
| `tea_m3/forecasting/m1lite.py` | M1-lite: light XGBoost + linear temporal branch, fixed blend |
| `scripts/train_m1lite.py` | Clean, walk-forward evaluate, save model and reports |
| `notebooks/M1_lite_training.ipynb` | Same training step by step, with charts (for the report and viva) |
| `tests/` | 35 tests: data, leakage, contract, scenarios, SHAP additivity |
| `reports/` | Dataset QA report and evaluation results |
| `data/processed/`, `models/` | Filled when you run the training script |

The raw data is stored in `data/raw/M1_combined_monthly_raw.csv`.

## Setup and run

```bash
pip install -r requirements.txt
python scripts/train_m1lite.py      # ~13 s: writes data/processed, models/, reports/
python -m pytest                    # 35 tests, ~2 s
```

**Windows Controlled Folder Access.** On this laptop, Defender's ransomware
protection blocks `python.exe` from writing under `Documents`. Either allow
Python through it (Windows Security > Virus & threat protection > Ransomware
protection > Allow an app through Controlled folder access > add
`C:\Python314\python.exe`), or send outputs elsewhere:

```bash
set M3_OUT_DIR=C:\m3_out            # PowerShell: $env:M3_OUT_DIR = "C:\m3_out"
python scripts/train_m1lite.py
```

## How M3 uses it

```python
from tea_m3.forecasting import load_forecaster, ScenarioError

m = load_forecaster()                      # M1-lite now; real M1 adapter later
m.available_origins()                      # months for the selector
r = m.forecast("2024-03")                  # forecasts 2024-04
r["forecast_value"], r["interval_lower"], r["interval_upper"], r["actual_value"]
m.driver_ranges("2024-03")                 # slider current/min/p5/median/p95/max
s = m.forecast("2024-03", {"usd_lkr": 320, "rain_mm": 200})   # what-if
```

Rules the contract enforces: unknown drivers, non-numbers and values outside the
supported range raise `ScenarioError` (API should return 422); values outside the
5th-95th percentile are allowed with a warning; dependent features (changes,
anomalies, USD price) are always recomputed; scenarios never change the baseline.

**SHAP.** `shap.TreeExplainer(m.get_xgb_model())` on
`r["features_used"]` (in `m.feature_names()` order) reconciles exactly:

```
forecast = (1 - w) * base + sum((1 - w) * phi_i) + w * temporal_pred
```

This holds because M1-lite's blend weight `w` is fixed. The temporal branch is
shown as one separate term. Use `config.DRIVER_GROUPS` to group the 17 features
into 7 business drivers.

## Target, data and splits

- Target: total Sri Lankan tea exports, million kg, month t+1 from data up to t.
- Data: M1's `M1_combined_monthly_raw.csv`, 2000-01 to 2024-12 (300 months after cleaning).
- Splits by target month: train 2000-2018, validate 2019-2021, test 2022-2024 (M1's plan).
- Deployed demo model is fitted on targets up to 2021-12, so every 2022-2024 month is held out.

Main cleaning fixes (full log in `reports/dataset_qa.md`): 2 duplicate months dropped;
export units unified (million kg to 2005, kg after); 4 totals with a x10 error replaced
by the product sum; 3 missing months interpolated for lags only and never used as
targets; 12 auction values inconsistent with the other elevations replaced; rainfall
`-999` sentinels and 2 impossible values removed; ONI shifted so no future season leaks.

## Results (walk-forward, held-out test 2022-2024)

| Model | MAE (mn kg) | MAPE | Theil's U vs persistence |
|---|---|---|---|
| M1-lite blend (w = 0.7) | 1.83 | 9.7% | 1.005 |
| XGBoost branch alone | 1.75 | 9.3% | 0.956 |
| Seasonal naive | 2.60 | 13.9% | 1.470 |
| Persistence | 1.81 | 9.8% | 1.000 |

The 80% interval covered 74% of test months. M1-lite clearly beats the seasonal-naive
baseline but only matches persistence on 2022-2024, a period with the economic
crisis. This is enough for building and demonstrating M3; it is not M1's result.

## Known limitations

- **Weak driver sensitivity.** Moving one driver across its usual range shifts the
  forecast by only 0.07-0.3 million kg; exports are dominated by momentum and season.
  Small slider moves can show no change (tree steps). The simulator must say so honestly.
- FX for 2000-2013 is labelled `synthetic` in M1's file; origin unconfirmed.
- No domestic production series, so no "domestic supply" driver (7 groups, not 8).
- Buyer-demand index is a constructed proxy (lagged GDP growth x Comtrade shares).
- No regime classifier: `regime` is always `None`, never invented.

## Questions for the M1 owner

1. Is the target total exports one month ahead? Same units?
2. How was the 2000-2013 `synthetic` FX series produced?
3. How are LSTM and XGBoost blended, and does the weight depend on the regime?
4. Can M3 access the trained XGBoost branch and the exact feature list and order?
5. Which of rainfall, LKR/USD, auction price, buyer demand and ENSO are real M1 inputs?
