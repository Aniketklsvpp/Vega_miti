# VEGA-MITI — AI-Powered Flood Intelligence with Adaptive Swarm Coordination

VEGA-MITI is a unified flood intelligence platform combining machine learning discharge forecasting, empirical risk classification, autonomous heterogeneous swarm simulation, and historical flood event replay.

## Architecture

- `src/backend/app.py`: Unified FastAPI application entry point hosting 25 REST endpoints on port 8000.
- `src/predict.py` & `src/prediction_service.py`: Dual-configuration river discharge prediction engine (`discharge_cfs`) evaluated under unseen-station generalization.
- `src/risk_engine.py`: Empirical flood risk classification engine computing station percentiles (P90 WATCH, P95 WARNING, P99 CRITICAL).
- `src/hydrological_evaluation.py`: Leakage-safe model evaluation benchmarking ML models against 1-day lag persistence and historical mean baselines.
- `src/swarm_simulator.py`: Swarm coordinator managing 6 heterogeneous agents across a discrete 20x20 topological grid with A* pathfinding, battery tracking, and autonomous lease revocation.
- `src/swarm_activation.py`: Dynamic swarm mobilization engine mapping hydrological risk levels to priority monitoring missions.
- `src/historical_replay.py`: Historical flood event replay engine for Yamuna River (Delhi, July 2023, 12 steps) and Susquehanna River (PA, December 2023, 13 steps).
- `run_pipeline.py`: Hydrology ML pipeline execution script.
- `run_delta_swarm.py`: Swarm simulation and static JSON artifact generator.

## Verified Dataset Inventory

| Dataset | Source | Records | Purpose | Integration Status |
|---|---|---:|---|---|
| **USGS NWIS Streamflow** | USGS National Water Information System | 16,060 rows (22 stations x 730 days) | ML training/validation and empirical percentile calculation | Integrated & Verified |
| **NASA POWER Surface Meteorology** | NASA Langley Research Center POWER API | 16,060 station-days | Weather forcings (precipitation, temperature, soil moisture) | Integrated & Verified |
| **Yamuna July 2023 Extreme Flood** | CWC Delhi Bulletin, Hathnikund Barrage Log, IMD Safdarjung | 12 daily steps (2023-07-07 to 2023-07-18) | Historical flood replay and Delhi emergency mobilization | Integrated & Verified |
| **Susquehanna Dec 2023 High-Flow** | USGS NWIS Station 01570500 & NASA POWER | 13 daily steps (2023-12-14 to 2023-12-26) | US high-flow benchmark replay | Integrated & Verified |
| **Swarm Operational Artifacts** | Swarm Simulation Engine | 9 structured JSON files | Offline/demo frontend fallback and API cache | Integrated & Verified |
| **2018 Kerala Floods** | CWC / KSDMA / IMD | ~14 reservoir spill logs | Investigated candidate; omitted due to fragmented gauge coverage | Not Integrated |
| **Caravan Hydrology** | Kratzert et al. (Zenodo) | 7,100+ global catchments | Cataloged in source registry for future multi-basin research | Not Integrated (Cataloged Only) |

## Execution

### 1. Launch Unified Backend
```powershell
python -m uvicorn src.backend.app:app --host 127.0.0.1 --port 8000
```
Swagger UI documentation is available at `http://127.0.0.1:8000/docs`.

### 2. Run Hydrological ML Pipeline
```powershell
python run_pipeline.py
```

### 3. Run Delta-Swarm Simulation Generator
```powershell
python run_delta_swarm.py
```

## Testing

Run the full automated test suite (84 unit and integration tests):
```powershell
python -m unittest discover tests
```
