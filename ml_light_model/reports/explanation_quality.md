# Explanation Quality & Faithfulness Report

**Evaluation Period:** 2022-01 to 2024-12 (36 held-out test months)  
**Model:** M1-lite prototype stand-in (blend weight w = 0.7)

---

## 1. Additivity & Reconciliation (Faithfulness)
- **Max Reconciliation Error:** 3.91e-06 mkg
- **Mean Reconciliation Error:** 1.51e-06 mkg
- **Status:** [PASS] Exact decomposition holds

## 2. Explanation Stability (Robustness)
- **20x Determinism:** Exact match (0 variance)
- **Input Perturbation (±0.5% noise):**
  - Top Driver Consistency: 100.0%
  - Full Sign Profile Consistency: 100.0%

## 3. Domain Sanity & Driver Dominance
- **Internal Driver Dominance (Momentum / Seasonality):** 97.2% of months
- **External Driver Dominance:** 1 month(s) where external factors dominated:
  - Month `2022-02`: Rainfall (+0.18 mkg)

## 4. Empirical 80% Interval Coverage
- **Target Confidence:** 80%
- **Observed Coverage:** 68.6% (24 of 35 test months covered)
- **Note:** Disclosed honestly in limitations panel without artificial widening.
