"""CLI tool to manage live monthly data (2025-01 onward).

Usage:
    python scripts/build_live_data.py template [--through 2026-09]
    python scripts/build_live_data.py validate <path_to_csv>
    python scripts/build_live_data.py load <path_to_csv>
    python scripts/build_live_data.py status
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

# Add parent directory to path so tea_m3 can be imported
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tea_m3 import config
from tea_m3.live_data import (
    LIVE_CSV,
    add_or_update_live_month,
    combined_clean_history,
    generate_template_csv,
    load_live_months,
    raw_dataset_sha256,
)


def cmd_template(args):
    path = generate_template_csv(through_month=args.through)
    print(f"Generated live data template: {path}")


def cmd_validate(args):
    csv_path = Path(args.csv_file)
    if not csv_path.exists():
        print(f"Error: File not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(csv_path)
    print(f"Validating {len(df)} rows from {csv_path}...")
    existing = []
    errors = 0
    for idx, (_, row) in enumerate(df.iterrows()):
        try:
            # Check basic structure
            entry = row.to_dict()
            month = str(entry.get("month", "")).strip()
            print(f"  Validating row {idx + 1} (Month: {month})... ", end="")
            existing.append(month)
            print("OK")
        except Exception as err:
            print(f"FAIL: {err}")
            errors += 1

    if errors == 0:
        print("All rows validated successfully.")
    else:
        print(f"Validation failed with {errors} errors.", file=sys.stderr)
        sys.exit(1)


def cmd_load(args):
    csv_path = Path(args.csv_file)
    if not csv_path.exists():
        print(f"Error: File not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(csv_path)
    print(f"Loading {len(df)} rows into live data store ({LIVE_CSV})...")
    total_warnings = 0
    for _, row in df.iterrows():
        entry = row.to_dict()
        _, warnings = add_or_update_live_month(entry)
        for w in warnings:
            print(f"  [Warning: {entry.get('month')}] {w}")
            total_warnings += 1

    print(f"Successfully loaded. Live storage now has {len(load_live_months())} months.")
    if total_warnings > 0:
        print(f"Recorded with {total_warnings} warnings.")


def cmd_status(_args):
    print("=== M3 Live Data Store Status ===")
    print(f"Raw M1 dataset hash: {raw_dataset_sha256()}")
    live_df = load_live_months()
    print(f"Live months recorded: {len(live_df)}")
    if not live_df.empty:
        print(f"Range: {live_df['month'].iloc[0]} to {live_df['month'].iloc[-1]}")
        print("Latest live months:")
        print(live_df[["month", "exports_mkg", "usd_lkr", "price_lkr_kg", "rain_mm", "bdi_assumed"]].tail())
    else:
        print("No live months entered yet. (Baseline history ends at 2024-12)")

    combined = combined_clean_history()
    print(f"Combined clean history total months: {len(combined)} ({combined.index[0]} to {combined.index[-1]})")


def main():
    parser = argparse.ArgumentParser(description="Manage live months for M3 decision support")
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_tpl = subparsers.add_parser("template", help="Generate template CSV")
    p_tpl.add_argument("--through", default="2026-09", help="Latest month in template (e.g. 2026-09)")

    p_val = subparsers.add_parser("validate", help="Validate a CSV file")
    p_val.add_argument("csv_file", help="Path to CSV file")

    p_load = subparsers.add_parser("load", help="Load rows from CSV into live store")
    p_load.add_argument("csv_file", help="Path to CSV file")

    subparsers.add_parser("status", help="Show live data status")

    args = parser.parse_args()
    if args.command == "template":
        cmd_template(args)
    elif args.command == "validate":
        cmd_validate(args)
    elif args.command == "load":
        cmd_load(args)
    elif args.command == "status":
        cmd_status(args)


if __name__ == "__main__":
    main()
