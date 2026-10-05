# Dataset QA report: tea_monthly_clean.csv

Source: `M1_combined_monthly_raw.csv` (302 raw rows, 2000-01 to 2024-12).
Clean table: 300 months, 2000-01 to 2024-12.

## Series

| Column | Missing | Min | Median | Max |
|---|---|---|---|---|
| exports_mkg | 0 | 14.38 | 24.20 | 30.41 |
| price_lkr_kg | 0 | 164.50 | 525.88 | 1971.77 |
| usd_lkr | 0 | 76.68 | 125.87 | 363.39 |
| rain_mm | 0 | 54.32 | 200.27 | 587.77 |
| oni | 2 | -1.53 | 0.00 | 2.49 |
| bdi | 15 | 1.02 | 3.40 | 4.66 |

## Flags

- Export months imputed (excluded as targets): 3
- Auction months carried forward: 1
- Months with synthetic FX (FX_origin = synthetic): 168 (2000-01 to 2013-12)
- Months with fewer than 3 rain stations reporting: 43

## Known limitations

- FX before 2014 is labelled synthetic in M1's raw file; its origin must be confirmed with the M1 owner.
- Buyer-demand index is a constructed proxy from annual GDP growth and Comtrade shares.
- No domestic production series is present, so the domestic-supply driver is not modelled.
- Auction price is the mean of the three elevation averages, not an official national average.

## Cleaning log (36 entries)

| Date | Field | Action |
|---|---|---|
| 2007-02 | row | dropped exact duplicate month |
| 2009-10 | row | dropped exact duplicate month |
| 2009-08 | exports_mkg | total 2.846 disagreed with product sum 28.463; used product sum |
| 2012-12 | exports_mkg | total missing; used product sum 26.262 |
| 2013-11 | exports_mkg | total 268.777 disagreed with product sum 26.878; used product sum |
| 2020-06 | exports_mkg | total missing; used product sum 20.473 |
| 2020-09 | exports_mkg | total 243.761 disagreed with product sum 24.376; used product sum |
| 2022-09 | exports_mkg | total missing; used product sum 18.553 |
| 2023-10 | exports_mkg | total 240.649 disagreed with product sum 24.065; used product sum |
| 2003-12 | exports_mkg | missing; linearly interpolated for lag features only, excluded as a target |
| 2017-01 | exports_mkg | missing; linearly interpolated for lag features only, excluded as a target |
| 2022-11 | exports_mkg | missing; linearly interpolated for lag features only, excluded as a target |
| 2004-04 | AUC_Medium_price_mean | value 129.8 inconsistent with other elevations; replaced by 196.5 |
| 2004-09 | AUC_Medium_price_mean | value 147.1 inconsistent with other elevations; replaced by 198.5 |
| 2004-12 | AUC_Low_price_mean | value 296.4 inconsistent with other elevations; replaced by 220.8 |
| 2006-02 | AUC_Medium_price_mean | value 176.8 inconsistent with other elevations; replaced by 237.5 |
| 2008-04 | AUC_High_price_mean | value 1336.7 inconsistent with other elevations; replaced by 431.9 |
| 2011-12 | AUC_Medium_price_mean | value 288.8 inconsistent with other elevations; replaced by 412.8 |
| 2013-09 | AUC_Medium_price_mean | value 349.7 inconsistent with other elevations; replaced by 467.1 |
| 2015-03 | AUC_High_price_mean | value 1605.9 inconsistent with other elevations; replaced by 625.2 |
| 2017-04 | AUC_Medium_price_mean | value 2504.6 inconsistent with other elevations; replaced by 665.7 |
| 2018-08 | AUC_Medium_price_mean | value 1893.3 inconsistent with other elevations; replaced by 629.5 |
| 2019-02 | AUC_Medium_price_mean | value 2202.9 inconsistent with other elevations; replaced by 718.8 |
| 2020-03 | AUC_Medium_price_mean | value 433.2 inconsistent with other elevations; replaced by 623.4 |
| 2020-04 | price_lkr_kg | no auction price; carried forward last known price |
| 2002-03 | RAIN_Badulla | -999 sentinel set to missing |
| 2007-05 | RAIN_Badulla | -999 sentinel set to missing |
| 2007-11 | RAIN_Badulla | -999 sentinel set to missing |
| 2010-04 | RAIN_Badulla | -999 sentinel set to missing |
| 2023-05 | RAIN_Badulla | -999 sentinel set to missing |
| 2010-04 | RAIN_Nuwara_Eliya | -999 sentinel set to missing |
| 2017-11 | RAIN_Nuwara_Eliya | implausible 3247 mm set to missing |
| 2021-05 | RAIN_Nuwara_Eliya | implausible 2816 mm set to missing |
| 2008-07 | RAIN_Ratnapura | -999 sentinel set to missing |
| 2011-01 | RAIN_Ratnapura | -999 sentinel set to missing |
| 2017-05 | RAIN_Ratnapura | -999 sentinel set to missing |
