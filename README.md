# AI-Based Decision Support System for Sri Lankan Tea Export Operations

Project J26-IT-423 (SLIIT IT4010, 2026). This folder holds component **M3: Explainable AI &
Decision Support** (D S T W Dassanayake, IT23293076) and the **M1-lite** stand-in forecaster it uses.

| Folder / File | Contents |
|---|---|
| `frontend/` | React (Vite) decision support web interface (port 5174) |
| `backend/` | Node.js Express API (port 4000), decision rules catalogue, database schemas (`database/`), and project docs (`docs/`) |
| `ml_service/` | Python FastAPI ML service (port 8001: SHAP values, explanations, scenario simulation) |
| `ml_light_model/` | Standalone M1-lite model: data cleaning, features, XGBoost + temporal blend, training notebook, dataset (`data/raw/`), reports |
| `RUN_PROJECT.bat` | **Windows: double-click to set up and run everything** (uses `run_project.ps1`) |
| `STOP_PROJECT.bat` | **Windows: double-click to stop the running project** |

## Run on a new Windows computer

1. Install **Python 3.11+** (tick *Add python.exe to PATH*), **Node.js 22+ LTS** and,
   optionally, **PostgreSQL 13+**.
2. Copy this whole folder to the computer (note: `.venv`, `node_modules`, `logs/`, `.env` and `.setup_done` are machine-specific and are ignored in git; if transferring manually between computers, do not copy `.venv` or `node_modules`).
3. **Double-click `RUN_PROJECT.bat`.**

The first run sets everything up (Python environment, packages, model training if needed,
Node packages, database) and then opens **http://localhost:5174** in the browser. If copied from another computer with a different Python path, the launcher automatically detects this and cleanly rebuilds the environment. Later runs skip setup and start straight away.

To stop the app, press **Enter** in the black window, or **double-click `STOP_PROJECT.bat`**.
The stop file only stops this project's own services (ports 8001, 4000, 5174) and never other
programs. If the window was closed by mistake, either the stop file or the next run cleans up.

If PostgreSQL uses a password other than `postgres`, the launcher asks for it. Just press Enter
to run without a database: the app still works, and the page footer says "no database".

Other commands (from a command prompt in this folder):

```bat
RUN_PROJECT.bat setup     :: (re)install everything
RUN_PROJECT.bat start     :: start only
RUN_PROJECT.bat test      :: run all 101 tests + frontend build check
RUN_PROJECT.bat retrain   :: retrain the M1-lite model
```

**If the launcher says Windows is blocking writes:** Windows Security's *Controlled folder access*
is on and the project is in a protected folder such as `Documents`. Allow `python.exe` and
`node.exe` (Windows Security > Virus & threat protection > Ransomware protection > Allow an app
through Controlled folder access), or move the project to another folder, e.g. `C:\Projects`.

Ports used: 8001 (ML service), 4000 (backend), 5174 (frontend).
More detail: `backend/README.md`, `frontend/README.md`, `ml_service/README.md`, and `ml_light_model/README.md`.
Full documentation and research deliverables: `docs/` (`REQUIREMENTS_TRACEABILITY.md`, `MODEL_CARD.md`, `M1_INTEGRATION.md`, `VIVA_DEMO_SCRIPT.md`, `REMAINING_WORK.md`).
