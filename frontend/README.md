# M3 Decision Support Frontend (React + Vite)

Component M3 (Explainable AI & Decision Support) of Project J26-IT-423.
Interactive web dashboard designed for Sri Lankan tea export planners, brokers, and analysts.

## Features

- **Grouped Month Selector:**
  - Live out-of-sample months (2025-01 onward)
  - Held-out test period (2022-01 to 2024-12)
  - In-sample training period (2000-01 to 2021-12)
- **Live Month Ingestion Modal:**
  - Enter actuals across 6 series with units and source provenance
  - Explicit flagging for assumed inputs (e.g., BDI proxy)
  - Real-time physical bounds validation and forecast preview
- **Live Forecast Badges & Banners:**
  - Clear out-of-sample forward labeling
  - Data extrapolation and assumed input disclosures
- **Interactive What-If Simulation:**
  - Sliders for key drivers (Rainfall, USD/LKR, Auction Price, BDI, ONI) with 5th–95th percentile guide-rails
  - Instant scenario recalculation with delta comparisons
- **Goal-Seek ("What would it take?"):**
  - Target export volume planner searching feasible single-driver values
  - One-click apply to What-If simulator
- **Decision Prompts with Transparent Evidence:**
  - 15 domain decision prompts with expandable "Why this prompt?" evidence panels (trigger values, rule ID, limitations, and `DRAFT` status badge)
- **Decision Rules Review Modal:**
  - Review catalogue and submission interface for licensed Colombo tea auction brokers
- **Live Track-Record Modal:**
  - Running log of forward predictions versus actual out-of-sample outcomes

## Development & Build

```bash
npm install
npm run dev     # Runs Vite development server on port 5174
npm run build   # Production bundle verification
```
