# VEGA-MITI — Technical Q&A & Defense Guide for Judges

**Hackathon Evaluation Focus:** Technical Integrity, Scientific Honesty, Swarm Architecture, and System Engineering.

---

### Q1: Why does the persistence baseline outperform your ML models on the held-out stations?
**Answer:**  
In gauged river basins with continuous telemetry, river discharge possesses immense hydraulic momentum — tomorrow's discharge is strongly correlated with today's discharge (\(Q_{t} \approx Q_{t-1}\)). On our strictly leak-free evaluation (trained on 16 US catchments, evaluated on 6 unseen held-out stations), the persistence baseline achieved a lower MAE than the initial ML models.  
Rather than concealing this or overfitting on test stations, VEGA-MITI explicitly reports this in `src/hydrological_evaluation.py`. The genuine value of machine learning lies in **ungauged or sparsely-gauged catchments** where historical lag features do not exist, and downstream forecasts must be synthesized purely from rainfall and upstream watershed physiography.

---

### Q2: Why did you train on USGS US data rather than Indian river data?
**Answer:**  
The USGS NWIS repository provides decades of high-frequency, publicly accessible, scientifically calibrated discharge and rating-curve records across hundreds of stations. In contrast, Indian river data (such as CWC station bulletins) often reports stage (water level in meters) rather than direct in-situ streamflow discharge velocity, and historical daily records are frequently fragmented or published with provisional disclaimers.  
We used USGS data to train and rigorously cross-validate the core hydrological ML pipeline, while using authentic CWC and IMD data for our **Yamuna 2023 historical replay scenario**.

---

### Q3: How does the system handle missing or corrupt discharge data?
**Answer:**  
In conventional systems, missing or NaN telemetry often defaults to 0.0, which can catastrophically trigger a false "NORMAL" state and suppress emergency evacuations.  
In VEGA-MITI, `FloodRiskEngine` strictly enforces:
- Any `NaN`, `None`, negative, or corrupted sensor reading produces `risk_level: "UNKNOWN"`, `risk_state: "INSUFFICIENT_DATA"`, and `confidence_score: 0.0`.
- Missing data cannot trigger false NORMAL states or activate automated emergency missions. Instead, it triggers a sensor telemetry verification request (`REQUEST_IMMEDIATE_SENSOR_TELEMETRY`).

---

### Q4: How does the autonomous swarm activate, and what prevents runaway activations?
**Answer:**  
Swarm activation is governed by `SwarmActivationEngine` (`src/swarm_activation.py`). It requires a verified multi-station risk transition (`WATCH`, `WARNING`, or `CRITICAL`) supported by `VALID` or `HIGH` data quality status.  
Provisional data demotes `CRITICAL` activations to `WATCH`, and `UNKNOWN` or `INSUFFICIENT_DATA` assessments are strictly filtered out. This prevents false alarms from triggering physical or simulated agent activations.

---

### Q5: How are missions assigned among the 6 swarm agents?
**Answer:**  
Missions are allocated dynamically using an **adaptive bidding protocol combined with A* pathfinding** on a 20x20 Cartesian grid with obstacle avoidance:
$$\text{Bid} = (4 - \text{Priority}) \times 100 - \text{Distance} \times 3.0 + \text{Battery} \times 0.4$$
Agents must possess the exact required capabilities (e.g. `AERIAL_OBSERVATION` for UAVs, `RIVER_MONITORING` for USVs, `TERRAIN_RECON` for UGVs, `DATA_RELAY` for Relay Nodes). The highest bidder with an unobstructed A* path is granted a time-bound lease (45–60 seconds).

---

### Q6: What happens when an agent fails or loses communication?
**Answer:**  
The central coordinator maintains a heartbeat monitor (`check_heartbeats_and_leases`). If an agent fails to send a heartbeat within the lease window:
1. The agent is marked `DISCONNECTED`.
2. Its task lease is revoked immediately.
3. The mission status resets to `REASSIGNED`.
4. The coordinator triggers an immediate re-allocation pass, transferring the mission to the highest-scoring available backup agent with matching capabilities (e.g. `DRONE_AERIAL_2` taking over from `DRONE_AERIAL_1`).
5. When the disconnected agent reconnects, its buffered local event log is synchronized without race conditions or duplicated tasks.

---

### Q7: Are these physical drones, and are the coordinates real GPS?
**Answer:**  
No. VEGA-MITI is an **AI research prototype and tactical simulation system**. The swarm operates on a discrete 20x20 Cartesian simulation grid with simulated battery depletion and obstacle navigation. While the frontend projects these onto 3D Cesium globe and MapLibre relief visualizations for operational clarity, we clearly label all swarm actions as simulated research models to avoid misleading emergency management authorities.

---

### Q8: In the Yamuna replay, why is discharge separate from upstream release?
**Answer:**  
At the Old Railway Bridge (ORB) gauge in Delhi, the Central Water Commission primarily monitors river stage (water level in meters MSL); local streamflow velocity is unmetered during high flood stages.  
The 359,000 cfs peak reported during the July 2023 disaster occurred at the **Hathnikund Barrage**, located approximately 228 km upstream in Haryana. It is hydrologically inaccurate to report Hathnikund outflow as local Delhi in-situ discharge. VEGA-MITI documents `in_situ_discharge_cfs: null` and keeps `upstream_release_cfs: 359,000` distinctly segregated with explicit hydraulic transit-time annotations.

---

### Q9: What would be required to deploy VEGA-MITI operationally in India?
**Answer:**  
Four essential milestones would be required:
1. Direct integration with CWC telemetry APIs for automated stage-discharge rating curves.
2. Integration with IMD gridded Doppler radar precipitation nowcasts (replacing point rain gauge data).
3. Physical hardware integration with PX4 / MAVLink-enabled autonomous UAVs and ROS 2-based river surface vessels.
4. Formal statutory compliance and integration with the National Disaster Management Authority (NDMA) Unified Disaster Management Information System.

