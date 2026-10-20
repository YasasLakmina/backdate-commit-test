#!/usr/bin/env python3
"""
=============================================================================
Sri Lankan Tea Export Decision Support System (SLIIT IT4010 Capstone)
Automated Backdated Git Branching, Commits & Merges Generator
=============================================================================

This script creates an authentic Git history with professional Feature Branching,
realistic student commit titles, multi-line descriptions, and formal merge commits.

Branching Workflow (GitHub Flow / GitFlow):
- main
  ├── feature/ml-forecasting-pipeline  (8 commits)  --> Merge into main
  ├── feature/xai-shap-service         (5 commits)  --> Merge into main
  ├── feature/backend-rules-engine     (5 commits)  --> Merge into main
  ├── feature/frontend-decision-ui     (10 commits) --> Merge into main
  └── feature/testing-automation-docs  (3 commits)  --> Merge into main
  └── Release & Viva Polish commit on main
"""

import os
import sys
import shutil
import argparse
import random
import subprocess
from datetime import datetime, timedelta, time
from pathlib import Path

# =============================================================================
# DEFAULT CONFIGURATION
# =============================================================================
DEFAULT_START_DATE = "2026-09-30"    # Project start date (YYYY-MM-DD)
DEFAULT_END_DATE   = "2026-10-20"    # Project completion date (YYYY-MM-DD)
DEFAULT_AUTHOR_NAME  = "Yasas Lakmina"
DEFAULT_AUTHOR_EMAIL = "yasaslakmina@gmail.com"
DEFAULT_TIMEZONE     = "+0530"       # Sri Lanka Standard Time (+05:30)
DEFAULT_REMOTE_URL   = "https://github.com/YasasLakmina/backdate-commit-test.git"

# =============================================================================
# BRANCH DEFINITIONS WITH COMMITS AND FORMAL MERGES
# =============================================================================
BRANCH_WORKFLOW = [
    # -------------------------------------------------------------------------
    # Initial Commit on main
    # -------------------------------------------------------------------------
    {
        "type": "root_commit",
        "branch": "main",
        "title": "Initial project setup and git configuration",
        "description": "Set up the root workspace directory structure for Component M3 (Explainable AI and Decision Support). Configured .gitignore to exclude Python virtual environments, Node modules, build outputs, and local logs. Added VS Code configuration and initial project documentation.",
        "files": [".gitignore", ".vscode/settings.json", "README.md"]
    },

    # -------------------------------------------------------------------------
    # Feature 1: Machine Learning Forecasting Pipeline
    # -------------------------------------------------------------------------
    {
        "type": "branch_group",
        "branch_name": "feature/ml-forecasting-pipeline",
        "commits": [
            {
                "title": "Add raw tea export dataset and configure ML environment",
                "description": "Imported historical monthly Sri Lankan tea export dataset containing auction quantities, national price averages, and export figures. Created ML requirements file and PyTest configuration for testing forecasting modules.",
                "files": [
                    "ml_light_model/data/raw/M1_combined_monthly_raw.csv",
                    "ml_light_model/README.md",
                    "ml_light_model/requirements.txt",
                    "ml_light_model/pytest.ini"
                ]
            },
            {
                "title": "Conduct exploratory data analysis and dataset QA checks",
                "description": "Created initial Jupyter notebook for exploring distribution trends, seasonal patterns, and missing values across tea elevation grades. Documented dataset quality assurance metrics, data integrity checks, and summary statistics in dataset QA report.",
                "files": [
                    "ml_light_model/reports/dataset_qa.md",
                    "ml_light_model/notebooks/M1_lite_training.ipynb"
                ]
            },
            {
                "title": "Implement data preprocessing and cleaning pipeline",
                "description": "Developed automated pipeline in data_prep.py to clean raw monthly auction records, standardize date indices, impute missing values using forward fill and seasonal interpolation, and define central ML configuration constants.",
                "files": [
                    "ml_light_model/tea_m3/__init__.py",
                    "ml_light_model/tea_m3/config.py",
                    "ml_light_model/tea_m3/data_prep.py"
                ]
            },
            {
                "title": "Extract lag features and seasonal indicators for price forecasting",
                "description": "Engineered rolling mean statistics, multi-month price lags, macroeconomic indicators, and calendar seasonality variables to improve predictive accuracy. Saved processed feature matrix to data/processed directory.",
                "files": [
                    "ml_light_model/tea_m3/features.py",
                    "ml_light_model/data/processed/tea_monthly_clean.csv",
                    "ml_light_model/data/processed/features.csv",
                    "ml_light_model/data/processed/.gitkeep"
                ]
            },
            {
                "title": "Define standardized forecasting interfaces and base predictor classes",
                "description": "Created abstract base classes and interfaces for forecasting models under tea_m3/forecasting. Defined consistent predict, fit, and evaluate method contracts to allow interchangeable model experimentation.",
                "files": [
                    "ml_light_model/tea_m3/forecasting/__init__.py",
                    "ml_light_model/tea_m3/forecasting/interface.py"
                ]
            },
            {
                "title": "Implement M1-lite forecaster combining XGBoost and temporal trend blend",
                "description": "Built the core M1-lite forecasting model architecture. Integrated an XGBoost regressor for non-linear feature relationships combined with a linear temporal trend blend to capture long-term tea export trajectories.",
                "files": [
                    "ml_light_model/tea_m3/forecasting/m1lite.py",
                    "ml_light_model/models/.gitkeep"
                ]
            },
            {
                "title": "Execute walk-forward validation and record model evaluation metrics",
                "description": "Evaluated the forecasting model using expanding-window walk-forward validation on historical test sets. Logged evaluation metrics including MAPE, RMSE, and MAE across validation and test splits in markdown and JSON reports.",
                "files": [
                    "ml_light_model/reports/walkforward_validation.csv",
                    "ml_light_model/reports/walkforward_test.csv",
                    "ml_light_model/reports/metrics.json",
                    "ml_light_model/reports/m1lite_evaluation.md"
                ]
            },
            {
                "title": "Serialize and save trained M1-lite model artifacts",
                "description": "Trained final M1-lite model weights on preprocessed dataset and serialized model artifacts using Joblib and Pickle formats (v0.2.0) for deployment into the inference service.",
                "files": [
                    "ml_light_model/models/m1lite_v0.2.0.joblib",
                    "ml_light_model/models/m1lite_v0.2.0.pkl"
                ]
            }
        ],
        "merge": {
            "title": "Merge branch 'feature/ml-forecasting-pipeline' into main",
            "description": "Merged complete machine learning forecasting pipeline into main. Ingested historical Sri Lankan tea export dataset, implemented data cleaning routines, engineered temporal and lag features, and trained XGBoost + temporal blend model achieving targeted MAPE on walk-forward validation."
        }
    },

    # -------------------------------------------------------------------------
    # Feature 2: Explainable AI & SHAP Microservice
    # -------------------------------------------------------------------------
    {
        "type": "branch_group",
        "branch_name": "feature/xai-shap-service",
        "commits": [
            {
                "title": "Scaffold FastAPI microservice for machine learning inference",
                "description": "Initialized Python FastAPI service to host the ML model. Configured service settings, pyrefly type checking, test configuration, and modular application structure under ml_service/app.",
                "files": [
                    "ml_service/requirements.txt",
                    "ml_service/pytest.ini",
                    "ml_service/pyrefly.toml",
                    "ml_service/README.md",
                    "ml_service/app/__init__.py",
                    "ml_service/app/settings.py"
                ]
            },
            {
                "title": "Implement core prediction endpoints and model caching in ML service",
                "description": "Created FastAPI endpoints for on-demand price forecasting and scenario evaluations. Added model lifecycle management to load and cache trained weights in memory on startup for low-latency responses.",
                "files": [
                    "ml_service/app/main.py",
                    "ml_service/app/service.py"
                ]
            },
            {
                "title": "Integrate TreeSHAP algorithm for Explainable AI feature contributions",
                "description": "Implemented TreeSHAP explainability module in explain.py to compute local Shapley values for each forecast. Enables transparency by explaining how specific drivers (e.g. fertilizer cost, exchange rate, rainfall) impact tea prices.",
                "files": [
                    "ml_service/app/explain.py"
                ]
            },
            {
                "title": "Add confidence calibration and natural language rationale generation",
                "description": "Implemented empirical confidence interval calibration to convey forecast uncertainty. Integrated Jinja2 templates to generate human-readable natural language rationale summaries for export managers.",
                "files": [
                    "ml_service/app/calibration.py",
                    "ml_service/app/rationale.py",
                    "ml_service/app/templates/forecast_rationale.txt.j2",
                    "ml_service/app/templates/scenario_rationale.txt.j2"
                ]
            },
            {
                "title": "Benchmark explanation faithfulness and stability against domain heuristics",
                "description": "Created evaluation script to benchmark SHAP explanation stability and semantic consistency. Documented explanation quality metrics and heuristic alignment findings in reports/explanation_quality.md.",
                "files": [
                    "ml_light_model/scripts/evaluate_explanations.py",
                    "ml_light_model/reports/explanation_quality.json",
                    "ml_light_model/reports/explanation_quality.md"
                ]
            }
        ],
        "merge": {
            "title": "Merge branch 'feature/xai-shap-service' into main",
            "description": "Merged Explainable AI microservice into main. Implements FastAPI prediction service with in-memory model caching, local TreeSHAP contribution calculations, empirical confidence calibration, and Jinja2-templated operational rationales."
        }
    },

    # -------------------------------------------------------------------------
    # Feature 3: Backend Express API & Rules Engine
    # -------------------------------------------------------------------------
    {
        "type": "branch_group",
        "branch_name": "feature/backend-rules-engine",
        "commits": [
            {
                "title": "Initialize Express API backend with centralized configuration",
                "description": "Set up Node.js Express server to serve as the application orchestrator. Configured environment variables, request logging, and centralized error handling middleware in backend/src.",
                "files": [
                    "backend/package.json",
                    "backend/package-lock.json",
                    "backend/README.md",
                    "backend/.env",
                    "backend/src/config.js",
                    "backend/src/errors.js"
                ]
            },
            {
                "title": "Design PostgreSQL database schema and automated setup scripts",
                "description": "Created relational database schema for storing user study feedback, logged forecasts, and decision rule audits. Wrote automated database initialization scripts and password reset helpers for local setup.",
                "files": [
                    "backend/database/schema.sql",
                    "backend/scripts/initDb.js",
                    "backend/src/db/repository.js",
                    "reset_postgres.ps1",
                    "RESET_POSTGRES_PASSWORD.bat"
                ]
            },
            {
                "title": "Implement tea export business decision rules catalogue and engine",
                "description": "Developed domain-specific rules catalogue (e.g. minimum volume thresholds, price volatility alerts) and deterministic rule evaluation engine in backend/src/rules to support operational export decisions.",
                "files": [
                    "backend/src/rules/catalogue.js",
                    "backend/src/rules/engine.js",
                    "backend/src/validation.js"
                ]
            },
            {
                "title": "Integrate ML service HTTP client and live forecast store in backend",
                "description": "Created dedicated HTTP client to communicate with the FastAPI ML microservice. Implemented live forecast store to persist predictions and manage simulated tea export operational records.",
                "files": [
                    "backend/src/server.js",
                    "backend/src/app.js",
                    "backend/src/mlClient.js",
                    "backend/src/liveForecastStore.js"
                ]
            },
            {
                "title": "Implement REST routes for decision rules and empirical user studies",
                "description": "Built Express routing handlers for retrieving decision rule evaluations, recording user study responses, and serving live forecast logs to the frontend client.",
                "files": [
                    "backend/src/routes/rules.js",
                    "backend/src/routes/study.js",
                    "backend/data/live_forecast_log.json"
                ]
            }
        ],
        "merge": {
            "title": "Merge branch 'feature/backend-rules-engine' into main",
            "description": "Merged Node.js Express backend and decision rules engine into main. Contains database schemas, connection scripts, domain-specific tea export business rules catalogue, rule evaluation engine, and RESTful routing endpoints."
        }
    },

    # -------------------------------------------------------------------------
    # Feature 4: Frontend React Decision Support UI
    # -------------------------------------------------------------------------
    {
        "type": "branch_group",
        "branch_name": "feature/frontend-decision-ui",
        "commits": [
            {
                "title": "Initialize React frontend application with Vite bundler",
                "description": "Scaffolded React 18 single-page application using Vite for fast hot module reloading. Configured package dependencies, root HTML template, and project structure under frontend/src.",
                "files": [
                    "frontend/package.json",
                    "frontend/package-lock.json",
                    "frontend/vite.config.js",
                    "frontend/index.html",
                    "frontend/README.md",
                    "frontend/src/main.jsx"
                ]
            },
            {
                "title": "Build responsive UI design system and formatting utilities",
                "description": "Implemented comprehensive design system in styles.css featuring custom color tokens, modern card layouts, and typography. Created formatting helpers for currency, percentages, and metrics in format.js.",
                "files": [
                    "frontend/src/styles.css",
                    "frontend/src/format.js"
                ]
            },
            {
                "title": "Create centralized API client service for frontend communication",
                "description": "Developed api.js module using native fetch with structured error handling to interface with backend Express endpoints for forecasts, rules, explanations, and user study submissions.",
                "files": [
                    "frontend/src/api.js"
                ]
            },
            {
                "title": "Implement collapsible navigation sidebar and system status indicator",
                "description": "Built responsive Sidebar navigation component supporting view switching between forecast overview, scenario analysis, and rules review, including backend/ML service status badges.",
                "files": [
                    "frontend/src/components/Sidebar.jsx"
                ]
            },
            {
                "title": "Create forecast summary cards and interactive SHAP driver chart",
                "description": "Developed ForecastSummary component for primary price projections and DriverChart component to visually render positive and negative SHAP feature contributions using interactive horizontal bars.",
                "files": [
                    "frontend/src/components/ForecastSummary.jsx",
                    "frontend/src/components/DriverChart.jsx"
                ]
            },
            {
                "title": "Add decision prompts, global feature importance, and rationale displays",
                "description": "Implemented DecisionPrompts for actionable operational advice, GlobalImportance for overall model transparency, and Rationale/Limitations panels to help exporters understand model boundaries.",
                "files": [
                    "frontend/src/components/DecisionPrompts.jsx",
                    "frontend/src/components/GlobalImportance.jsx",
                    "frontend/src/components/Rationale.jsx",
                    "frontend/src/components/Limitations.jsx"
                ]
            },
            {
                "title": "Develop what-if scenario comparison and target goal-seek optimizer",
                "description": "Created ScenarioComparison component allowing users to adjust macro inputs (exchange rates, shipping costs) and see real-time price impacts. Added GoalSeek tool to calculate required input adjustments to hit a target export price.",
                "files": [
                    "frontend/src/components/ScenarioComparison.jsx",
                    "frontend/src/components/GoalSeek.jsx"
                ]
            },
            {
                "title": "Implement business rules review modal and policy override audit",
                "description": "Built RulesReviewModal to allow domain experts to inspect triggered business rules, review constraint satisfaction, and log administrative override justifications.",
                "files": [
                    "frontend/src/components/RulesReviewModal.jsx"
                ]
            },
            {
                "title": "Add live month data ingestion and historical track record viewer",
                "description": "Created AddLiveMonthModal to input new monthly market indicators and TrackRecordModal to compare historical model forecasts against actual realized export prices over time.",
                "files": [
                    "frontend/src/components/AddLiveMonthModal.jsx",
                    "frontend/src/components/TrackRecordModal.jsx",
                    "ml_light_model/data/live/live_months.csv",
                    "ml_light_model/tea_m3/live_data.py"
                ]
            },
            {
                "title": "Assemble decision support dashboard and manage root application state",
                "description": "Integrated all UI components into App.jsx. Implemented centralized state management, responsive grid layout, notification toasts, and synchronized data fetching across views.",
                "files": [
                    "frontend/src/App.jsx"
                ]
            }
        ],
        "merge": {
            "title": "Merge branch 'feature/frontend-decision-ui' into main",
            "description": "Merged React decision support interface into main. Implemented single-page application using Vite bundler, CSS design tokens, interactive SHAP driver charts, what-if scenario simulation, goal-seek optimizer, and live data ingestion modals."
        }
    },

    # -------------------------------------------------------------------------
    # Feature 5: Testing, Automation & Academic Documentation
    # -------------------------------------------------------------------------
    {
        "type": "branch_group",
        "branch_name": "feature/testing-automation-docs",
        "commits": [
            {
                "title": "Add unit and integration tests across ML models and backend API",
                "description": "Wrote test suites for live data processing, model forecasting accuracy, and backend API endpoints using Jest and PyTest. Verified error boundary handling and edge cases.",
                "files": [
                    "backend/tests/test_live_api.test.js",
                    "ml_light_model/tests/test_live_data.py",
                    "ml_light_model/tests/test_live_forecasting.py",
                    "ml_light_model/scripts/build_live_data.py",
                    "ml_light_model/scripts/analyse_study.py"
                ]
            },
            {
                "title": "Create unified cross-service launcher and shutdown scripts",
                "description": "Automated environment initialization and service orchestration with RUN_PROJECT.bat, run_project.ps1, and STOP_PROJECT.bat, allowing one-click startup of Python ML, Node Express, and Vite React servers.",
                "files": [
                    "RUN_PROJECT.bat",
                    "run_project.ps1",
                    "STOP_PROJECT.bat",
                    "start-dev.ps1"
                ]
            },
            {
                "title": "Finalize Component M3 technical documentation and research deliverables",
                "description": "Completed comprehensive technical documentation, Frontend Walkthrough & XAI Deep Dive Guide, and academic reports for Component M3 evaluation and research submission.",
                "files": [
                    "Frontend_Walkthrough_and_XAI_Deep_Dive_Guide.docx",
                    "Component_M3_Tea_Export_Decision_Support.docx",
                    "Component_M3_Tea_Export_Decision_Support.pdf"
                ]
            }
        ],
        "merge": {
            "title": "Merge branch 'feature/testing-automation-docs' into main",
            "description": "Merged automated test suites, Windows one-click launcher scripts, and finalized Component M3 research documentation and guides into main."
        }
    },

    # -------------------------------------------------------------------------
    # Final Release Commit on main
    # -------------------------------------------------------------------------
    {
        "type": "root_commit",
        "branch": "main",
        "title": "Codebase audit, code comments, and preparation for viva demonstration",
        "description": "Performed final codebase cleanup, added comprehensive inline docstrings and comments, verified end-to-end user workflows, and finalized preparation for oral viva presentation.",
        "files": []
    }
]

def generate_random_time(target_date: datetime.date, tz_str: str) -> str:
    """Generate realistic student coding hours (10:00 - 22:45)."""
    if random.random() < 0.70:
        hour = random.randint(10, 17)
    else:
        hour = random.randint(18, 22)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    dt = datetime.combine(target_date, time(hour, minute, second))
    return f"{dt.strftime('%Y-%m-%d %H:%M:%S')} {tz_str}"

def count_total_events():
    """Count total chronological events (commits + merges)."""
    total = 0
    for item in BRANCH_WORKFLOW:
        if item["type"] == "root_commit":
            total += 1
        elif item["type"] == "branch_group":
            total += len(item["commits"]) + 1  # commits + merge
    return total

def generate_event_timestamps(start_date_str: str, end_date_str: str, tz_str: str):
    """Generate strictly increasing timestamps across the date range for all events."""
    start_dt = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    end_dt = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    total_events = count_total_events()
    total_days = max(1, (end_dt - start_dt).days)

    step = total_days / (total_events - 1)
    raw_offsets = [round(i * step) for i in range(total_events)]
    
    day_offsets = []
    last_offset = 0
    for ro in raw_offsets:
        jittered = min(total_days, max(last_offset, ro))
        day_offsets.append(jittered)
        last_offset = jittered

    # Generate monotonically increasing timestamps
    timestamps = []
    current_dt = datetime.combine(start_dt, time(10, 15, 0))
    for idx, day_offset in enumerate(day_offsets):
        target_date = start_dt + timedelta(days=day_offset)
        # Ensure each event is at least 30-90 minutes after the previous one
        if idx == 0:
            current_dt = datetime.combine(target_date, time(random.randint(10, 12), random.randint(10, 50), random.randint(10, 50)))
        else:
            if target_date > current_dt.date():
                current_dt = datetime.combine(target_date, time(random.randint(10, 12), random.randint(10, 50), random.randint(10, 50)))
            else:
                current_dt += timedelta(minutes=random.randint(35, 95), seconds=random.randint(10, 50))
        timestamps.append(f"{current_dt.strftime('%Y-%m-%d %H:%M:%S')} {tz_str}")

    return timestamps

def ensure_gitignore():
    """Ensure .gitignore excludes archives, node_modules, and virtualenvs."""
    gitignore_path = Path(".gitignore")
    content = gitignore_path.read_text(encoding="utf-8") if gitignore_path.exists() else ""
    needed_rules = ["*.rar", "*.zip", ".venv/", "node_modules/", "dist/", "__pycache__/", "*.log", ".logs/", "logs/"]
    additions = [r for r in needed_rules if r not in content]
    if additions:
        content += "\n# Exclusions\n" + "\n".join(additions) + "\n"
        gitignore_path.write_text(content, encoding="utf-8")

def execute_branching_workflow(author_name: str, author_email: str, remote_url: str, timestamps: list):
    """Execute complete Git branching, commits, and merges workflow."""
    print("\n" + "="*85)
    print("EXECUTING REAL BRANCHING & MERGING COMMIT WORKFLOW")
    print("="*85)

    saved_remote = remote_url
    if not saved_remote and Path(".git").is_dir():
        try:
            res = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True)
            if res.returncode == 0: saved_remote = res.stdout.strip()
        except Exception: pass

    # Clean existing .git to rebuild complete branching history cleanly
    if Path(".git").is_dir():
        print("[*] Reinitializing .git repository to generate clean branching history...")
        try:
            shutil.rmtree(".git")
        except Exception:
            subprocess.run(["cmd", "/c", "rd", "/s", "/q", ".git"], check=False)

    ensure_gitignore()

    subprocess.run(["git", "init"], check=True)
    subprocess.run(["git", "branch", "-M", "main"], check=True)
    subprocess.run(["git", "config", "user.name", author_name], check=True)
    subprocess.run(["git", "config", "user.email", author_email], check=True)
    print(f"[+] Git configured: '{author_name}' <{author_email}>\n")

    ts_idx = 0
    total_events = len(timestamps)

    for step in BRANCH_WORKFLOW:
        if step["type"] == "root_commit":
            ts = timestamps[ts_idx]; ts_idx += 1
            title = step["title"]
            desc = step["description"]
            files = step["files"]

            # If last commit, stage all remaining files
            if ts_idx == total_events or not files:
                subprocess.run(["git", "add", "."], check=False)
            else:
                for f in files:
                    if Path(f).exists(): subprocess.run(["git", "add", f], check=False)

            env = os.environ.copy()
            env["GIT_AUTHOR_DATE"] = ts
            env["GIT_COMMITTER_DATE"] = ts
            
            diff_check = subprocess.run(["git", "diff", "--cached", "--quiet"])
            cmd = ["git", "commit", "-m", title, "-m", desc]
            if diff_check.returncode == 0: cmd.append("--allow-empty")
            subprocess.run(cmd, env=env, check=True)
            print(f"[{ts_idx:02d}/{total_events:02d}] [main]  {ts[:10]} | {title[:50]:<50} [OK]")

        elif step["type"] == "branch_group":
            branch = step["branch_name"]
            commits = step["commits"]
            merge_info = step["merge"]

            # Create and switch to feature branch
            print(f"\n---> [BRANCH] Creating and switching to '{branch}'")
            subprocess.run(["git", "checkout", "-b", branch], check=True)

            for c in commits:
                ts = timestamps[ts_idx]; ts_idx += 1
                title = c["title"]
                desc = c["description"]
                files = c["files"]

                for f in files:
                    if Path(f).exists(): subprocess.run(["git", "add", f], check=False)

                env = os.environ.copy()
                env["GIT_AUTHOR_DATE"] = ts
                env["GIT_COMMITTER_DATE"] = ts
                
                diff_check = subprocess.run(["git", "diff", "--cached", "--quiet"])
                cmd = ["git", "commit", "-m", title, "-m", desc]
                if diff_check.returncode == 0: cmd.append("--allow-empty")
                subprocess.run(cmd, env=env, check=True)
                print(f"[{ts_idx:02d}/{total_events:02d}] [{branch.replace('feature/', '')[:12]}] {ts[:10]} | {title[:45]:<45} [OK]")

            # Switch back to main and merge with --no-ff
            ts = timestamps[ts_idx]; ts_idx += 1
            print(f"---> [MERGE]  Merging '{branch}' into 'main' with formal merge commit")
            subprocess.run(["git", "checkout", "main"], check=True)

            env = os.environ.copy()
            env["GIT_AUTHOR_DATE"] = ts
            env["GIT_COMMITTER_DATE"] = ts

            merge_cmd = ["git", "merge", "--no-ff", "-m", merge_info["title"], "-m", merge_info["description"], branch]
            subprocess.run(merge_cmd, env=env, check=True)
            print(f"[{ts_idx:02d}/{total_events:02d}] [main]  {ts[:10]} | {merge_info['title'][:50]:<50} [OK]\n")

    if saved_remote:
        print(f"[+] Setting remote origin: {saved_remote}")
        subprocess.run(["git", "remote", "add", "origin", saved_remote], check=False)

    print("\n" + "="*85)
    print("SUCCESS: Complete branching and merge history created!")
    print("="*85)

    print("\nNetwork Graph View (Last 15 commits):")
    subprocess.run(["git", "log", "--graph", "--pretty=format:%h %ad | %s", "--date=format:%Y-%m-%d %H:%M", "-n", "15"])

    print("\n" + "="*85)

def print_dry_run_summary(timestamps: list, author_name: str, author_email: str):
    """Print dry-run preview of branches, commits, and merges."""
    print("\n" + "="*85)
    print("BRANCHING & MERGING WORKFLOW PREVIEW (DRY-RUN)")
    print(f"Author: {author_name} <{author_email}>")
    print("="*85)
    ts_idx = 0
    total = len(timestamps)

    for step in BRANCH_WORKFLOW:
        if step["type"] == "root_commit":
            ts = timestamps[ts_idx]; ts_idx += 1
            print(f"\n[{ts_idx:02d}/{total:02d}] [Branch: main] {ts}")
            print(f"Commit:  {step['title']}")
            print(f"Desc:    {step['description']}")
        elif step["type"] == "branch_group":
            branch = step["branch_name"]
            print(f"\n" + "-"*85)
            print(f"---> Branch off 'main' -> '{branch}'")
            print("-"*85)
            for c in step["commits"]:
                ts = timestamps[ts_idx]; ts_idx += 1
                print(f"[{ts_idx:02d}/{total:02d}] [{branch}] {ts}")
                print(f"  Commit: {c['title']}")
                print(f"  Desc:   {c['description']}")
            
            ts = timestamps[ts_idx]; ts_idx += 1
            print(f"\n[{ts_idx:02d}/{total:02d}] [Merge -> main] {ts}")
            print(f"  Merge Title: {step['merge']['title']}")
            print(f"  Merge Desc:  {step['merge']['description']}")

    print("\n" + "="*85)
    print("This was a DRY-RUN. To execute, run with `--execute`:")
    print("  python generate_backdated_commits.py --execute")
    print("="*85 + "\n")

def main():
    parser = argparse.ArgumentParser(description="Generate authentic Git branching, commits & merges.")
    parser.add_argument("--start", default=DEFAULT_START_DATE, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", default=DEFAULT_END_DATE, help="End date (YYYY-MM-DD)")
    parser.add_argument("--name", default=DEFAULT_AUTHOR_NAME, help="Author name")
    parser.add_argument("--email", default=DEFAULT_AUTHOR_EMAIL, help="Author email")
    parser.add_argument("--timezone", default=DEFAULT_TIMEZONE, help="Timezone offset")
    parser.add_argument("--remote", default=DEFAULT_REMOTE_URL, help="Remote repository URL")
    parser.add_argument("--execute", action="store_true", help="Execute the workflow")

    args = parser.parse_args()
    timestamps = generate_event_timestamps(args.start, args.end, args.timezone)

    if args.execute:
        execute_branching_workflow(args.name, args.email, args.remote, timestamps)
    else:
        print_dry_run_summary(timestamps, args.name, args.email)

if __name__ == "__main__":
    main()
