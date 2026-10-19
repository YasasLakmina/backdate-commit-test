"""Analysis of TAM and decision support study results.

Supports both:
  1. Between-subjects design: Group A (static SHAP) vs Group B (SHAP + rationale + simulator)
     - Independent t-test / Mann-Whitney U with Cohen's d
  2. Within-subject counterbalanced design:
     - Paired t-test / Wilcoxon signed-rank test with Cohen's d_z and bootstrap CI
  3. Scale reliability:
     - Cronbach's alpha per construct

NOTE: This script operates on real database dumps or synthetic test fixtures.
Never fabricate participant data or claim experimental outcomes without real ethics approval.
"""
from __future__ import annotations

import argparse
import sys
import numpy as np
import scipy.stats as stats


def cohen_d(x: np.ndarray, y: np.ndarray) -> float:
    """Cohen's d for independent samples."""
    nx, ny = len(x), len(y)
    dof = nx + ny - 2
    if dof <= 0:
        return 0.0
    pooled_std = np.sqrt(((nx - 1) * np.var(x, ddof=1) + (ny - 1) * np.var(y, ddof=1)) / dof)
    if pooled_std == 0:
        return 0.0
    return float((np.mean(x) - np.mean(y)) / pooled_std)


def cohen_dz(diff: np.ndarray) -> float:
    """Cohen's d_z for paired samples."""
    std_diff = np.std(diff, ddof=1)
    if std_diff == 0:
        return 0.0
    return float(np.mean(diff) / std_diff)


def cronbach_alpha(item_scores: np.ndarray) -> float:
    """Calculate Cronbach's alpha for internal consistency of a scale."""
    n_items = item_scores.shape[1]
    if n_items < 2:
        return 1.0
    item_variances = item_scores.var(axis=0, ddof=1)
    total_score = item_scores.sum(axis=1)
    total_variance = total_score.var(ddof=1)
    if total_variance == 0:
        return 0.0
    alpha = (n_items / (n_items - 1)) * (1 - (item_variances.sum() / total_variance))
    return float(alpha)


def analyse_between_subjects(group_a: np.ndarray, group_b: np.ndarray) -> dict:
    """Independent comparison between Group A (static) and Group B (interactive)."""
    t_stat, p_param = stats.ttest_ind(group_b, group_a, equal_var=False)
    mwu_stat, p_nonparam = stats.mannwhitneyu(group_b, group_a, alternative="two-sided")
    d = cohen_d(group_b, group_a)

    return {
        "design": "between_subjects",
        "group_a": {"n": len(group_a), "mean": float(np.mean(group_a)), "sd": float(np.std(group_a, ddof=1))},
        "group_b": {"n": len(group_b), "mean": float(np.mean(group_b)), "sd": float(np.std(group_b, ddof=1))},
        "mean_difference": float(np.mean(group_b) - np.mean(group_a)),
        "t_test": {"statistic": float(t_stat), "p_value": float(p_param)},
        "mann_whitney_u": {"statistic": float(mwu_stat), "p_value": float(p_nonparam)},
        "cohen_d": d,
    }


def analyse_within_subjects(static: np.ndarray, interactive: np.ndarray, n_boot: int = 1000) -> dict:
    """Paired comparison within participants across conditions."""
    diff = interactive - static
    t_stat, p_param = stats.ttest_rel(interactive, static)
    try:
        wilc_stat, p_nonparam = stats.wilcoxon(interactive, static)
    except Exception:
        wilc_stat, p_nonparam = None, None
    dz = cohen_dz(diff)

    # Bootstrap 95% CI on mean difference
    rng = np.random.default_rng(42)
    boot_means = [rng.choice(diff, size=len(diff), replace=True).mean() for _ in range(n_boot)]
    ci_lower = float(np.percentile(boot_means, 2.5))
    ci_upper = float(np.percentile(boot_means, 97.5))

    return {
        "design": "within_subject_counterbalanced",
        "n": len(static),
        "mean_static": float(np.mean(static)),
        "mean_interactive": float(np.mean(interactive)),
        "mean_difference": float(np.mean(diff)),
        "difference_95_ci": [ci_lower, ci_upper],
        "paired_t_test": {"statistic": float(t_stat), "p_value": float(p_param)},
        "wilcoxon": {"statistic": float(wilc_stat) if wilc_stat else None, "p_value": float(p_nonparam) if p_nonparam else None},
        "cohen_dz": dz,
    }


def run_fixture_demo():
    print("=== Running Evaluation Analysis on Labelled Synthetic Fixture ===")
    rng = np.random.default_rng(42)

    # Synthetic between-subjects fixture (N=20 per group, TAM score 1-7)
    a = rng.normal(loc=4.2, scale=0.8, size=20).clip(1, 7)
    b = rng.normal(loc=5.1, scale=0.7, size=20).clip(1, 7)

    res_between = analyse_between_subjects(a, b)
    print("\n[Between-Subjects Comparison (Group A Static vs Group B Interactive)]")
    print(f"Group A (N={res_between['group_a']['n']}): Mean={res_between['group_a']['mean']:.2f} (SD={res_between['group_a']['sd']:.2f})")
    print(f"Group B (N={res_between['group_b']['n']}): Mean={res_between['group_b']['mean']:.2f} (SD={res_between['group_b']['sd']:.2f})")
    print(f"Mean Difference: {res_between['mean_difference']:+.2f}")
    print(f"t-test: t={res_between['t_test']['statistic']:.3f}, p={res_between['t_test']['p_value']:.4f}")
    print(f"Mann-Whitney U: U={res_between['mann_whitney_u']['statistic']:.1f}, p={res_between['mann_whitney_u']['p_value']:.4f}")
    print(f"Cohen's d: {res_between['cohen_d']:.3f}")

    # Scale reliability fixture (4 items per construct)
    items = np.column_stack([
        b + rng.normal(0, 0.3, size=20),
        b + rng.normal(0, 0.4, size=20),
        b + rng.normal(0, 0.35, size=20),
        b + rng.normal(0, 0.4, size=20),
    ]).clip(1, 7)
    alpha = cronbach_alpha(items)
    print(f"\nCronbach's alpha (4-item perceived usefulness scale): {alpha:.3f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TAM Study Analysis")
    parser.add_argument("--fixture", action="store_true", help="Run on synthetic fixture to verify statistical pipeline")
    args = parser.parse_args()

    if args.fixture or len(sys.argv) == 1:
        run_fixture_demo()
