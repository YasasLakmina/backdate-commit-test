"""Deterministic plain-language rationale rendered with Jinja2 templates.

Templates only receive values taken from the forecast and explanation; nothing
is invented. Output is a list of paragraphs for the frontend.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
from jinja2 import Environment, FileSystemLoader, StrictUndefined

from app import settings  # also puts tea_m3 on sys.path
from tea_m3 import config

MAX_LISTED_DRIVERS = 3
EXTERNAL_DRIVERS = ["Auction prices", "Exchange rate", "Rainfall", "ENSO", "Buyer demand"]

_env = Environment(loader=FileSystemLoader(Path(__file__).parent / "templates"),
                   undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True, autoescape=False)
_env.filters["join_list"] = lambda items: (
    "" if not items else items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1])


def render_rationale(result: dict, explanation: dict) -> list[str]:
    f = result["features_used"]
    target = pd.Period(result["target_period"], freq="M")
    value = result["forecast_value"]

    recent = _compare(value, f.get("exp_roll3"), "above", "below")
    last_year = _compare(value, f.get("exp_lag12"), "above", "below")
    if last_year:
        last_year["month"] = (target - 12).strftime("%B %Y")

    up = [_driver_text(d) for d in explanation["drivers"] if d["direction"] == "up"][:MAX_LISTED_DRIVERS]
    down = [_driver_text(d) for d in explanation["drivers"] if d["direction"] == "down"][:MAX_LISTED_DRIVERS]
    external = {d["driver"]: d for d in explanation["drivers"] if d["driver"] in EXTERNAL_DRIVERS}
    weak = [in_sentence(g) for g, d in external.items() if d["direction"] == "neutral"]

    text = _env.get_template("forecast_rationale.txt.j2").render(
        model_name=result["model_id"].replace("m1-lite-v", "M1-lite v"),
        value=f"{value:.1f}",
        target_month=target.strftime("%B %Y"),
        interval=None if result["interval_lower"] is None else
        {"lower": f"{result['interval_lower']:.1f}", "upper": f"{result['interval_upper']:.1f}"},
        recent=recent, last_year=last_year,
        temporal=f"{explanation['temporal_term']:.1f}",
        up=up, down=down, weak=weak,
        cautions=_cautions(result, explanation),
    )
    return _paragraphs(text)


def render_scenario_rationale(baseline: dict, scenario: dict, comparison: dict) -> list[str]:
    changes = []
    for name, new in scenario["overrides"].items():
        meta = config.SCENARIO_DRIVERS[name]
        old = baseline["drivers"][name]
        changes.append(f"{meta['label'].lower()} {_fmt(new)} instead of {_fmt(old)} {meta['unit']}")

    material = [c for c in comparison["driver_changes"] if abs(c["change"]) >= settings.NEUTRAL_CONTRIBUTION_MKG]
    top = [f"{in_sentence(c['driver'])} ({c['change']:+.2f})" for c in material[:MAX_LISTED_DRIVERS]]
    if abs(comparison["temporal_change"]) >= settings.NEUTRAL_CONTRIBUTION_MKG:
        top.append(f"the temporal component ({comparison['temporal_change']:+.2f})")

    text = _env.get_template("scenario_rationale.txt.j2").render(
        changes=changes,
        target_month=pd.Period(scenario["target_period"], freq="M").strftime("%B %Y"),
        scenario=f"{scenario['forecast_value']:.2f}", baseline=f"{baseline['forecast_value']:.2f}",
        delta=f"{comparison['absolute']:+.2f}", pct=f"{comparison['relative_percent']:+.1f}%",
        negligible=comparison["negligible"], top_changes=top,
        cautions=comparison["warnings"],
    )
    return _paragraphs(text)


def _compare(value: float, reference, above: str, below: str) -> dict | None:
    if reference is None or reference == 0:
        return None
    diff = value - reference
    return {"abs": f"{abs(diff):.1f}", "pct": f"{abs(diff) / reference:.0%}",
            "direction": above if diff >= 0 else below, "value": f"{reference:.1f}"}


def in_sentence(name: str) -> str:
    """Lower-case a driver name for use mid-sentence, keeping acronyms such as ENSO."""
    return " ".join(w if w.isupper() else w.lower() for w in name.split())


def _driver_text(d: dict) -> str:
    return f"{in_sentence(d['driver'])} ({d['contribution']:+.2f})"


def _cautions(result: dict, explanation: dict) -> list[str]:
    cautions = [w for w in result["warnings"] if "stand-in" not in w]
    if not explanation["reconciled"]:
        cautions.append("The explanation does not fully reconcile with the forecast.")
    return cautions


def _fmt(v: float) -> str:
    return f"{v:,.0f}" if abs(v) >= 100 else f"{v:.2f}"


def _paragraphs(text: str) -> list[str]:
    return [" ".join(p.split()) for p in text.strip().split("\n\n") if p.strip()]
