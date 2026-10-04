# M1-lite evaluation

M1-lite is a lightweight stand-in for M3 development, not the final M1 model.
Target: total tea exports (million kg), one month ahead. All forecasts are
walk-forward: the model is refitted on all earlier months before each forecast.

## Blend weight (chosen on validation only)
forecast = (1 - w) * XGBoost + w * temporal. Chosen **w = 0.7**.
Validation MAE by w: w=0.0: 1.795; w=0.1: 1.783; w=0.2: 1.771; w=0.3: 1.759; w=0.4: 1.751; w=0.5: 1.743; w=0.6: 1.736; w=0.7: 1.729; w=0.8: 1.733; w=0.9: 1.745; w=1.0: 1.757;

## Validation (targets 2019-01 to 2021-12, 36 months)
| Model | MAE | RMSE | MAPE_% | Bias | Theil_U_vs_persistence |
|---|---|---|---|---|---|
| M1-lite blend | 1.729 | 2.195 | 7.767 | -0.024 | 0.755 |
| XGBoost branch | 1.795 | 2.261 | 7.984 | 0.038 | 0.778 |
| Temporal branch | 1.757 | 2.224 | 7.932 | -0.051 | 0.765 |
| Seasonal naive (same month last year) | 2.076 | 2.647 | 9.396 | -0.117 | 0.911 |
| Persistence (last month) | 2.236 | 2.905 | 10.017 | -0.028 | 1.000 |

## Test (targets 2022-01 to 2024-12, 35 months, held out)
| Model | MAE | RMSE | MAPE_% | Bias | Theil_U_vs_persistence |
|---|---|---|---|---|---|
| M1-lite blend | 1.828 | 2.300 | 9.698 | 0.656 | 1.005 |
| XGBoost branch | 1.754 | 2.187 | 9.302 | 0.779 | 0.956 |
| Temporal branch | 1.932 | 2.467 | 10.240 | 0.604 | 1.078 |
| Seasonal naive (same month last year) | 2.603 | 3.365 | 13.867 | 1.208 | 1.470 |
| Persistence (last month) | 1.813 | 2.289 | 9.772 | 0.136 | 1.000 |

## 80% interval
Empirical validation residual quantiles: [-2.405, 2.732] million kg added to the forecast.
Coverage on the test months: **74%** (target 80%).

Theil's U < 1 means lower RMSE than the persistence baseline. MAPE is safe here
because exports never approach zero. Results are from about 25 years of monthly
data; treat them as prototype evidence for M3, not as M1's final results.
