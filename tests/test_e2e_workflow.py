import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    with urllib.request.urlopen(req, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))

def post(path, data=None):
    payload = json.dumps(data or {}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))

def run_e2e_workflow():
    print("=================================================================")
    print("VEGA-MITI COMPLETE END-TO-END WORKFLOW INTEGRATION TEST")
    print("=================================================================")

    # Step 1: Open VEGA-MITI dashboard & check health
    print("\n[Step 1] Opening Dashboard & Verifying System Health...")
    health = get("/api/health")
    assert health["status"] == "success", "Backend health failed"
    print(f"  -> System: {health['data']['service']} | Status: {health['data']['status']}")
    print(f"  -> Hydrology Calibrated Stations: {health['data']['hydrology_calibrated_stations']}")

    # Step 2: Retrieve hydrological information
    print("\n[Step 2] Retrieving Hydrological Gauging Network...")
    stations_res = get("/api/stations")
    assert stations_res["status"] == "success"
    stations = stations_res["data"]["stations"]
    assert len(stations) > 0
    print(f"  -> Retrieved {len(stations)} calibrated USGS monitoring stations.")

    # Step 3: Select a river monitoring station (01570500)
    target_station_id = "01570500"
    stn = next((s for s in stations if s["station_id"] == target_station_id), stations[0])
    print(f"\n[Step 3] Selected River Station: {stn['station_name']} ({stn['station_id']})")
    print(f"  -> Coordinates: {stn['latitude']}N, {stn['longitude']}W")
    print(f"  -> Watch (P90): {stn['thresholds']['watch_p90_cfs']} cfs | Critical (P99): {stn['thresholds']['critical_p99_cfs']} cfs")

    # Step 4: Run prediction and risk assessment
    print("\n[Step 4] Running Flood Risk Assessment & Discharge Prediction...")
    risk_res = get(f"/api/risk/{target_station_id}")
    assert risk_res["status"] == "success"
    risk_data = risk_res["data"]
    print(f"  -> Evaluated Discharge: {risk_data['flow_value_evaluated_cfs']} cfs")
    print(f"  -> Risk Classification: {risk_data['risk_level']} (Observed: {risk_data['observed_risk_level']}, Predicted: {risk_data['predicted_risk_level']})")
    print(f"  -> Discrepancy Status: {risk_data['risk_basis_discrepancy']} ({risk_data['discrepancy_note']})")

    history_res = get(f"/api/stations/{target_station_id}/history")
    assert history_res["status"] == "success"
    print(f"  -> Retrieved {history_res['data']['record_count']} historical sensor readings for station.")

    # Step 5: Activate the swarm using a valid risk scenario
    print("\n[Step 5] Triggering Autonomous Swarm Activation...")
    activation_payload = {
        "assessments": [
            {
                "station_id": target_station_id,
                "discharge_cfs": 179000.0,
                "risk_level": "CRITICAL",
                "data_quality_status": "VALID_OBSERVATION"
            },
            {
                "station_id": "01638500",
                "discharge_cfs": 45000.0,
                "risk_level": "WARNING",
                "data_quality_status": "VALID_OBSERVATION"
            }
        ]
    }
    act_res = post("/api/swarm/activate", activation_payload)
    assert act_res["status"] == "success"
    print(f"  -> Activation State: {act_res['data']['activation_state']}")
    print(f"  -> Active Missions Generated: {act_res['data']['missions_generated']}")
    print(f"  -> Allocations Made: {len(act_res['data']['allocations_made'])}")

    # Step 6: Display all six agents
    print("\n[Step 6] Retrieving All Six Swarm Agents...")
    agents_res = get("/api/swarm/agents")
    assert agents_res["status"] == "success"
    agents = agents_res["data"]
    assert len(agents) == 6, f"Expected 6 agents, found {len(agents)}"
    for a in agents:
        print(f"  -> [{a['agent_id']}] Type: {a['agent_type']} | Status: {a['status']} | Pos: {a['position']} | Battery: {a['battery']}%")

    # Step 7: Allocate and execute missions
    print("\n[Step 7] Advancing Swarm Simulation Steps...")
    step_res = post("/api/swarm/step", {"steps": 2})
    assert step_res["status"] == "success"
    print(f"  -> Step execution successful. Agents updated: {step_res['data']['agents_updated']}")

    missions_res = get("/api/swarm/missions")
    assert missions_res["status"] == "success"
    print(f"  -> Active Missions In Queue: {missions_res['data']['total_missions']} (In Progress: {missions_res['data']['in_progress']})")

    # Step 8: Simulate agent failure
    failed_agent_id = "DRONE_AERIAL_1"
    print(f"\n[Step 8] Injecting Communication Fault / Agent Disconnect on {failed_agent_id}...")
    fail_res = post(f"/api/swarm/agents/{failed_agent_id}/fail")
    assert fail_res["status"] == "success"
    print(f"  -> Agent {failed_agent_id} Status: {fail_res['data']['status']}")
    print(f"  -> Reassigned Missions Count: {len(fail_res['data']['reassigned_missions'])}")
    print(f"  -> Replacement Allocations: {fail_res['data']['replacement_agents']}")

    # Step 9: Verify mission reassignment and recovery
    print("\n[Step 9] Reconnecting Agent and Verifying Lease Recovery...")
    rec_res = post("/api/swarm/agent/reconnect", {"agent_id": failed_agent_id})
    assert rec_res["status"] == "success"
    print(f"  -> Reconnected {failed_agent_id}. Status: {rec_res['data']['status']}")

    events_res = get("/api/swarm/events?limit=5")
    assert events_res["status"] == "success"
    print(f"  -> Synchronized Event Audit Log contains {events_res['data']['total_events']} events.")

    # Step 10: Run historical flood replay
    print("\n[Step 10] Executing Historical Replay Scenarios...")
    replay_cat = get("/api/swarm/replay/events")
    assert replay_cat["status"] == "success"
    print(f"  -> Available Catalog Events: {[e['event_id'] for e in replay_cat['data']]}")

    yamuna_run = post("/api/swarm/replay/run", {"event_id": "EVENT-IN-YAMUNA-2023"})
    assert yamuna_run["status"] == "success"
    print(f"  -> Yamuna 2023 Replay: {yamuna_run['data']['title']} ({len(yamuna_run['data']['timeline_frames'])} frames)")

    susquehanna_run = post("/api/swarm/replay/run", {"event_id": "EVENT-US-SUSQUEHANNA-2023"})
    assert susquehanna_run["status"] == "success"
    print(f"  -> Susquehanna 2023 Replay: {susquehanna_run['data']['title']} ({len(susquehanna_run['data']['timeline_frames'])} frames)")

    # Step 11: Display evaluation and benchmark results
    print("\n[Step 11] Retrieving Hydrological & Swarm Coordination Benchmarks...")
    hydro_eval = get("/api/evaluation/hydrology?config=A")
    assert hydro_eval["status"] == "success"
    skill = hydro_eval["data"]["forecast_skill_pooled"]
    print(f"  -> Hydrology Skill: MAE={skill['mae']:.1f} cfs | RMSE={skill['rmse']:.1f} cfs | NSE={skill['nse']:.3f}")

    swarm_bench = post("/api/swarm/evaluate/compare")
    assert swarm_bench["status"] == "success"
    stat = swarm_bench["data"]["static_strategy"]
    adapt = swarm_bench["data"]["adaptive_strategy"]
    diff = swarm_bench["data"]["performance_differential"]
    print(f"  -> Swarm Static Coverage: {stat['effective_coverage_rate_pct']}% | Adaptive Coverage: {adapt['effective_coverage_rate_pct']}%")
    print(f"  -> Fault Recovery Gain: +{diff['coverage_improvement_pct']}% coverage retention under failure")

    # Cleanup reset
    post("/api/swarm/reset")
    print("\n=================================================================")
    print("ALL 11 END-TO-END WORKFLOW STEPS VALIDATED SUCCESSFULLY!")
    print("=================================================================")

if __name__ == "__main__":
    run_e2e_workflow()

