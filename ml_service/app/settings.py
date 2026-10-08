"""Locate the M1-lite package and model.

M1LITE_ROOT   folder containing tea_m3/ (default: ../../XAI_Decision_Support_Light_Model)
M1LITE_MODEL  path to the trained .pkl (or .joblib) (default: the path tea_m3 itself uses, which
              honours M3_OUT_DIR)
"""
import os
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
_env_root = os.environ.get("M1LITE_ROOT")
_candidates = [
    Path(_env_root) if _env_root else None,
    SERVICE_ROOT.parent / "ml_light_model",
    SERVICE_ROOT.parents[1] / "XAI_Decision_Support_Light_Model",
]
M1LITE_ROOT = next((p.resolve() for p in _candidates if p and (p / "tea_m3").is_dir()), (SERVICE_ROOT.parent / "ml_light_model").resolve())

if not (M1LITE_ROOT / "tea_m3").is_dir():
    raise RuntimeError(f"tea_m3 package not found under {M1LITE_ROOT}; set M1LITE_ROOT.")
if str(M1LITE_ROOT) not in sys.path:
    sys.path.insert(0, str(M1LITE_ROOT))

MODEL_PATH = os.environ.get("M1LITE_MODEL") or None

# Contributions smaller than this (million kg) are described as negligible.
# Provisional presentation threshold, not a statistical test.
NEUTRAL_CONTRIBUTION_MKG = 0.02
