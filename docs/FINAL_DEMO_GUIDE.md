# VEGA-MITI — Final Hackathon Demonstration Guide

**Project:** VEGA-MITI (AI-Powered Hydrological Intelligence & Adaptive Swarm Coordination)  
**Event:** FLOODCAST Challenge — Hackathon Demonstration  
**Target Duration:** 5–7 Minutes  

---

## 1. System Startup Instructions

### Terminal 1 — Start FastAPI Backend
```powershell
cd "C:\Users\Asus\Documents\moves F\hackoven\Vega_miti"
python -m uvicorn src.backend.app:app --host 127.0.0.1 --port 8000 --reload
```
*Verify:* Open `http://127.0.0.1:8000/api/health` in your browser. You should see `"status": "HEALTHY"`.

### Terminal 2 — Start Frontend Dashboard
```powershell
cd "C:\Users\Asus\Documents\moves F\hackoven\Vega_miti\frontend"
npm run dev
```
*Verify:* Open `http://localhost:5173` in your browser. The VEGA-MITI Command Dashboard will load.

---

## 2. Live Demonstration Script (Step-by-Step)

### Step 1: System Overview & Live Backend Health (0:00 - 0:45)
1. Point out the header status badge showing **LIVE BACKEND CONNECTED** (`http://127.0.0.1:8000`).
2. Highlight that VEGA-MITI bridges two critical domains:
   - **Hydrological Intelligence:** Real-time streamflow forecasting, empirical flood risk categorization, and data-integrity discrepancy detection.
   - **Adaptive Swarm Coordination:** A 6-agent heterogeneous autonomous swarm with dynamic task leasing, A* obstacle avoidance, and automatic failover.
3. Show the global/regional toggle (USGS Catchments vs. Indian Basin Replays).

### Step 2: Hydrological Gauging Network & Risk Assessment (0:45 - 2:00)
1. Navigate to the **Catchment Map** or **Station Detail** view.
2. Select USGS Station **01570500** (Susquehanna River at Harrisburg, PA).
3. Walk the judges through the multi-tiered metrics:
   - Historical observations (730 daily records).
   - Observed Discharge vs. Predicted Discharge (Config A / Config B).
   - **Observed Risk Level vs. Predicted Risk Level:** Explain the **Discrepancy Engine** (`ALIGNED`, `MISMATCH`, or `INSUFFICIENT_DATA`).
4. **Scientific Honesty Point:** Explain to judges that risk tiers (WATCH P90, WARNING P95, CRITICAL P99) are **empirical demonstration thresholds**, not official NWS stages, preserving scientific rigor.

### Step 3: Autonomous Swarm Activation & Mission Allocation (2:00 - 3:30)
1. Switch to **Swarm Command** view.
2. Observe the 6 Canonical Swarm Agents on the 20x20 Tactical Relief Grid:
   - `DRONE_AERIAL_1` (UAV, [1, 1]) — Aerial Observation & Crest Verification
   - `DRONE_AERIAL_2` (UAV, [18, 1]) — Aerial Observation & Area Surveillance
   - `USV_RIVER_1` (USV, [5, 10]) — River Velocity & Depth Telemetry
   - `USV_RIVER_2` (USV, [12, 10]) — River Flow Monitoring
   - `RELAY_NODE_1` (RELAY, [10, 5]) — Data Mesh Relay & Communication Bridge
   - `GROUND_SCOUT_1` (UGV, [10, 18]) — Terrain Recon & Ground Verification
3. Click **"Trigger Autonomous Activation"** based on elevated flood risk.
4. Show how missions are bid on and allocated via A* pathfinding around terrain obstacles.
5. Click **"Step Simulation"**: Watch agents traverse their planned paths, complete waypoints, and consume battery realistically.

### Step 4: Communication Failure & Dynamic Task Reallocation (3:30 - 4:45)
1. Switch to **Network Resilience** view.
2. In the Agent List, find `DRONE_AERIAL_1` (which is executing the critical crest verification mission).
3. Click **"Inject Communication Fault"**.
4. Point out what happens automatically in real time:
   - `DRONE_AERIAL_1` transitions to `DISCONNECTED`.
   - Its task lease is revoked after heartbeat timeout.
   - The mission is marked `REASSIGNED`.
   - **Adaptive Failover in Action:** `DRONE_AERIAL_2` (the secondary aerial UAV) dynamically bids on and takes over the mission!
5. Click **"Reconnect Agent"**: Show the agent reconnecting, buffering local logs, and synchronizing with the central coordinator without task collisions.

### Step 5: Historical Replay — Yamuna River 2023 Mega-Flood (4:45 - 6:00)
1. Navigate to **Historical Replay** view.
2. Select **"July 2023 Yamuna River Mega-Flood (Delhi NCR, India)"**.
3. Scrub through the 12-day timeline (July 7 to July 18, 2023):
   - **July 9:** Safdarjung records 153 mm rainfall; Yamuna breaches CWC Warning Level (204.50 m).
   - **July 11:** Peak Hathnikund Barrage release (359,000 cfs) surges upstream. VEGA-MITI triggers CRITICAL risk.
   - **July 13:** Historic crest of 208.66 m at Old Railway Bridge (breaching 1978 record of 207.49 m).
4. **Data Integrity Point:** Show that local Delhi streamflow is accurately documented as unmetered (`in_situ_discharge_cfs: null`), while upstream Hathnikund discharge is kept strictly separate (`upstream_release_cfs`).

### Step 6: Quantitative Benchmarks & Summary (6:00 - 6:45)
1. Navigate to **Model Trust & Benchmarks** view.
2. Show the **Hydrological Evaluation Benchmark**:
   - 16 training stations vs. 6 held-out stations.
   - Explain honestly why the persistence baseline outperforms current ML models on gauged basins, and where ML provides value for ungauged catchments.
3. Show the **Swarm Coordination Benchmark**:
   - Static allocation: 80% coverage under failure.
   - Adaptive coordination: 100% coverage (+20% fault recovery gain).

---

## 3. Fallback Procedure (If Network/Port Issues Occur)

If the local backend port 8000 is occupied or cannot be reached:
1. The frontend automatically displays a clear amber badge: **OFFLINE SIMULATION / DEMO MODE**.
2. All 6 agents, 3D relief visualizer, A* pathfinding, and historical replay timelines remain 100% functional via bundled deterministic offline fixtures.
3. To kill any orphan background Python processes on port 8000:
   ```powershell
   Get-Process python | Stop-Process -Force
   ```
   Then restart Uvicorn cleanly.

