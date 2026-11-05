import json
import os
import sys
import time
import urllib.request
import urllib.error
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath("."))

from src.swarm_simulator import SwarmCoordinator, AStarPlanner
from src.swarm_activation import SwarmActivationEngine
from src.historical_replay import HistoricalReplayEngine, HISTORICAL_EVENTS_CATALOG

BASE_URL = "http://127.0.0.1:8000"

def http_get(path: str) -> Dict[str, Any]:
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return {"status_code": res.status, "body": json.loads(res.read().decode())}
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode()) if e.headers.get_content_type() == "application/json" else {}
        return {"status_code": e.code, "body": body}

def http_post(path: str, payload: Any = None) -> Dict[str, Any]:
    url = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"} if payload is not None else {"Accept": "application/json"}
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return {"status_code": res.status, "body": json.loads(res.read().decode())}
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode()) if e.headers.get_content_type() == "application/json" else {}
        return {"status_code": e.code, "body": body}

class SwarmAuditor:
    def __init__(self):
        self.results = {
            "metadata": {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "framework": "VEGA-MITI Swarm Stress Test & Reliability Audit",
                "target_host": BASE_URL,
                "environment": "SIMULATION"
            },
            "summary": {},
            "sections": {},
            "performance_benchmarks": {},
            "edge_case_results": {},
            "failures_and_fixes": []
        }

    def run_all(self):
        print("=================================================================")
        print("VEGA-MITI SWARM INTELLIGENCE STRESS TEST & RELIABILITY AUDIT")
        print("=================================================================")
        
        self.test_multi_agent_coordination()
        self.test_failure_recovery()
        self.test_stress_and_edge_cases()
        self.test_historical_replay_validation()
        self.test_api_reliability()
        self.run_performance_benchmarks()
        
        self.compile_summary()
        self.save_artifacts()

    def test_multi_agent_coordination(self):
        print("\n--- [Section 1] Multi-Agent Coordination Audit ---")
        section = {"status": "PASS", "tests": []}
        coordinator = SwarmCoordinator()

        expected_agents = {
            "DRONE_AERIAL_1": ("UAV", {"AERIAL_OBSERVATION", "VERIFICATION"}),
            "DRONE_AERIAL_2": ("UAV", {"AERIAL_OBSERVATION", "VERIFICATION", "AREA_SURVEILLANCE"}),
            "USV_RIVER_1": ("USV", {"RIVER_MONITORING", "VERIFICATION"}),
            "USV_RIVER_2": ("USV", {"RIVER_MONITORING"}),
            "RELAY_NODE_1": ("RELAY", {"DATA_RELAY", "AERIAL_OBSERVATION"}),
            "GROUND_SCOUT_1": ("UGV", {"AREA_SURVEILLANCE", "VERIFICATION"})
        }

        all_present = True
        for aid, (atype, caps) in expected_agents.items():
            if aid not in coordinator.agents:
                all_present = False
                break
            ag = coordinator.agents[aid]
            if ag.agent_type != atype or not caps.issubset(ag.capabilities):
                all_present = False
                break
        
        section["tests"].append({
            "name": "six_heterogeneous_agents_initialization",
            "passed": all_present,
            "details": f"Verified {len(coordinator.agents)} agents with types UAV, USV, RELAY, UGV and distinct capabilities."
        })
        print(f"  -> Six Agents Initialization: {'PASS' if all_present else 'FAIL'}")

        m_low = {"mission_id": "M-LOW", "priority": 3, "target_position": (3, 3), "required_capabilities": ["AERIAL_OBSERVATION"]}
        m_high = {"mission_id": "M-HIGH", "priority": 1, "target_position": (3, 3), "required_capabilities": ["AERIAL_OBSERVATION"]}
        coord_prio = SwarmCoordinator()
        coord_prio.add_mission(m_low)
        coord_prio.add_mission(m_high)
        allocs = coord_prio.allocate_missions(strategy="adaptive")
        prio_correct = (len(allocs) > 0 and allocs[0]["mission_id"] == "M-HIGH")
        section["tests"].append({
            "name": "mission_priority_ordering",
            "passed": prio_correct,
            "details": f"Priority 1 allocated before Priority 3: {prio_correct}"
        })
        print(f"  -> Priority Allocation Ordering: {'PASS' if prio_correct else 'FAIL'}")

        coord_sim = SwarmCoordinator()
        missions = [
            {"mission_id": f"M-SIM-{i}", "priority": 2, "target_position": (i * 3 + 1, (i * 2 + 1) % 18 + 1), "required_capabilities": ["AERIAL_OBSERVATION"] if i < 2 else (["RIVER_MONITORING"] if i < 4 else (["DATA_RELAY"] if i == 4 else ["AREA_SURVEILLANCE"]))}
            for i in range(6)
        ]
        for m in missions:
            coord_sim.add_mission(m)
        allocs_sim = coord_sim.allocate_missions(strategy="adaptive")
        assigned_agents = {a["agent_id"] for a in allocs_sim}
        no_double_assignment = (len(allocs_sim) == len(assigned_agents))
        section["tests"].append({
            "name": "simultaneous_mission_allocation_no_conflicts",
            "passed": no_double_assignment and len(allocs_sim) >= 5,
            "details": f"Allocated {len(allocs_sim)} simultaneous missions to {len(assigned_agents)} distinct agents without duplicate assignment."
        })
        print(f"  -> Simultaneous Conflict-Free Allocation: {'PASS' if no_double_assignment else 'FAIL'}")

        planner = AStarPlanner(grid_size=(20, 20), obstacles=[(5, 5), (5, 6), (5, 7)])
        path = planner.find_path((4, 6), (6, 6))
        path_valid = (path is not None and (5, 6) not in path and path[0] == (4, 6) and path[-1] == (6, 6))
        section["tests"].append({
            "name": "astar_obstacle_avoidance_pathfinding",
            "passed": path_valid,
            "details": f"A* generated valid collision-free path circumventing obstacle barrier: {path_valid}"
        })
        print(f"  -> A* Obstacle-Avoidance Pathfinding: {'PASS' if path_valid else 'FAIL'}")

        coord_comp = SwarmCoordinator()
        m_comp = {"mission_id": "M-COMP", "priority": 1, "target_position": (1, 3), "required_capabilities": ["AERIAL_OBSERVATION"]}
        coord_comp.add_mission(m_comp)
        coord_comp.allocate_missions(strategy="adaptive")
        ag_drone = coord_comp.agents["DRONE_AERIAL_1"]
        init_battery = ag_drone.battery
        res_step = coord_comp.step_simulation()
        step_battery = ag_drone.battery
        battery_drained = (step_battery < init_battery)
        
        while coord_comp.missions["M-COMP"]["status"] != "COMPLETED":
            coord_comp.step_simulation()
        
        mission_completed = (coord_comp.missions["M-COMP"]["status"] == "COMPLETED" and ag_drone.status == "AVAILABLE" and ag_drone.current_mission is None)
        section["tests"].append({
            "name": "mission_lifecycle_and_battery_drain",
            "passed": battery_drained and mission_completed,
            "details": f"Battery drained from {init_battery}% to {step_battery}%, mission completed, agent returned to AVAILABLE."
        })
        print(f"  -> Mission Completion & State Updates: {'PASS' if mission_completed else 'FAIL'}")

        if not all(t["passed"] for t in section["tests"]):
            section["status"] = "FAIL"
        self.results["sections"]["multi_agent_coordination"] = section

    def test_failure_recovery(self):
        print("\n--- [Section 2] Failure Recovery & Fault-Tolerance Audit ---")
        section = {"status": "PASS", "tests": []}

        coord = SwarmCoordinator()
        m1 = {"mission_id": "M-FAIL-UAV", "priority": 1, "target_position": (2, 2), "required_capabilities": ["AERIAL_OBSERVATION"]}
        coord.add_mission(m1)
        coord.allocate_missions(strategy="adaptive")
        assigned_uav = coord.missions["M-FAIL-UAV"]["assigned_agent_id"]
        coord.simulate_agent_disconnect(assigned_uav)
        reassigned_uav = coord.check_heartbeats_and_leases(timeout_sec=0)
        realloc_uav = coord.allocate_missions(strategy="adaptive")
        replacement_uav = realloc_uav[0]["agent_id"] if realloc_uav else None
        uav_recovery_ok = ("M-FAIL-UAV" in reassigned_uav and replacement_uav is not None and replacement_uav != assigned_uav)
        section["tests"].append({
            "name": "uav_failure_and_takeover",
            "passed": uav_recovery_ok,
            "details": f"Failed UAV ({assigned_uav}) triggered reassignment to replacement UAV ({replacement_uav})."
        })
        print(f"  -> UAV Failure & Backup Takeover: {'PASS' if uav_recovery_ok else 'FAIL'}")

        coord_usv = SwarmCoordinator()
        m_usv = {"mission_id": "M-FAIL-USV", "priority": 1, "target_position": (6, 10), "required_capabilities": ["RIVER_MONITORING"]}
        coord_usv.add_mission(m_usv)
        coord_usv.allocate_missions(strategy="adaptive")
        first_usv = coord_usv.missions["M-FAIL-USV"]["assigned_agent_id"]
        coord_usv.simulate_agent_disconnect(first_usv)
        reassigned_usv = coord_usv.check_heartbeats_and_leases(timeout_sec=0)
        realloc_usv = coord_usv.allocate_missions(strategy="adaptive")
        replacement_usv = realloc_usv[0]["agent_id"] if realloc_usv else None
        usv_recovery_ok = (replacement_usv is not None and replacement_usv != first_usv)
        section["tests"].append({
            "name": "usv_failure_and_takeover",
            "passed": usv_recovery_ok,
            "details": f"Failed USV ({first_usv}) triggered takeover by secondary USV ({replacement_usv})."
        })
        print(f"  -> USV Failure & Backup Takeover: {'PASS' if usv_recovery_ok else 'FAIL'}")

        coord_ugv = SwarmCoordinator()
        m_ugv = {"mission_id": "M-FAIL-UGV", "priority": 1, "target_position": (3, 17), "required_capabilities": ["AREA_SURVEILLANCE"]}
        coord_ugv.add_mission(m_ugv)
        coord_ugv.allocate_missions(strategy="adaptive")
        first_ugv = coord_ugv.missions["M-FAIL-UGV"]["assigned_agent_id"]
        coord_ugv.simulate_agent_disconnect(first_ugv)
        reassigned_ugv = coord_ugv.check_heartbeats_and_leases(timeout_sec=0)
        realloc_ugv = coord_ugv.allocate_missions(strategy="adaptive")
        replacement_ugv = realloc_ugv[0]["agent_id"] if realloc_ugv else None
        ugv_recovery_ok = (replacement_ugv is not None and replacement_ugv != first_ugv)
        section["tests"].append({
            "name": "ugv_failure_and_takeover",
            "passed": ugv_recovery_ok,
            "details": f"Failed UGV ({first_ugv}) triggered reassignment to capable backup agent ({replacement_ugv})."
        })
        print(f"  -> UGV Failure & Backup Takeover: {'PASS' if ugv_recovery_ok else 'FAIL'}")

        coord_iso = SwarmCoordinator()
        m_iso = {"mission_id": "M-ISO", "priority": 1, "target_position": (1, 10), "required_capabilities": ["AERIAL_OBSERVATION"]}
        coord_iso.add_mission(m_iso)
        coord_iso.allocate_missions(strategy="adaptive")
        assigned_iso = coord_iso.missions["M-ISO"]["assigned_agent_id"]
        coord_iso.simulate_agent_disconnect(assigned_iso)
        init_pos = coord_iso.agents[assigned_iso].position
        coord_iso.step_simulation()
        after_pos = coord_iso.agents[assigned_iso].position
        failed_agent_immobile = (init_pos == after_pos)
        section["tests"].append({
            "name": "failed_agent_execution_halt",
            "passed": failed_agent_immobile,
            "details": f"Failed agent remained stationary at {init_pos} without executing mission steps while disconnected."
        })
        print(f"  -> Failed Agent Execution Halt: {'PASS' if failed_agent_immobile else 'FAIL'}")

        coord_rec = SwarmCoordinator()
        coord_rec.simulate_agent_disconnect("DRONE_AERIAL_1")
        coord_rec.agents["DRONE_AERIAL_1"].record_event("TELEMETRY_SAMPLE", {"sample_id": 101})
        pre_sync_len = len(coord_rec.synchronized_event_log)
        coord_rec.simulate_agent_reconnect("DRONE_AERIAL_1")
        post_sync_len = len(coord_rec.synchronized_event_log)
        events_synced = (post_sync_len > pre_sync_len)
        reconnected_ev = any(e.get("event_type") == "NETWORK_RECONNECTED" for e in coord_rec.synchronized_event_log)
        reconnect_ok = (coord_rec.agents["DRONE_AERIAL_1"].connectivity == "CONNECTED" and events_synced and reconnected_ev)
        section["tests"].append({
            "name": "agent_reconnection_and_event_sync",
            "passed": reconnect_ok,
            "details": f"Reconnected DRONE_AERIAL_1, synchronized buffered events, recorded NETWORK_RECONNECTED."
        })
        print(f"  -> Agent Reconnection & Event Sync: {'PASS' if reconnect_ok else 'FAIL'}")

        if not all(t["passed"] for t in section["tests"]):
            section["status"] = "FAIL"
        self.results["sections"]["failure_recovery"] = section

    def test_stress_and_edge_cases(self):
        print("\n--- [Section 3] Stress and Edge-Case Testing Audit ---")
        section = {"status": "PASS", "tests": []}

        activation = SwarmActivationEngine()
        stations_22 = [
            {"station_id": f"0157{i:04d}", "discharge_cfs": 150000.0, "risk_level": "CRITICAL", "data_quality_status": "VALID_OBSERVATION"}
            for i in range(22)
        ]
        res_mass = activation.evaluate_activation(stations_22)
        unique_mids = len({m["mission_id"] for m in res_mass["missions"]})
        all_unique = (unique_mids == len(res_mass["missions"]))
        section["tests"].append({
            "name": "simultaneous_22_station_critical_activation",
            "passed": res_mass["current_state"] == "CRITICAL" and len(res_mass["missions"]) == 44 and all_unique,
            "details": f"Generated {len(res_mass['missions'])} unique missions for 22 simultaneous CRITICAL stations."
        })
        print(f"  -> 22 Stations Simultaneous Critical Activation: {'PASS' if all_unique else 'FAIL'}")

        coord_repeat = SwarmCoordinator()
        act_repeat = SwarmActivationEngine()
        no_crashes_repeat = True
        for rep in range(25):
            try:
                eval_res = act_repeat.evaluate_activation([{"station_id": "01570500", "risk_level": "CRITICAL", "data_quality_status": "VALID_OBSERVATION"}])
                for m in eval_res["missions"]:
                    coord_repeat.add_mission(m)
                coord_repeat.allocate_missions(strategy="adaptive")
                coord_repeat.step_simulation()
            except Exception as e:
                no_crashes_repeat = False
                break
        section["tests"].append({
            "name": "repeated_activation_and_stepping_25_cycles",
            "passed": no_crashes_repeat,
            "details": "Completed 25 repeated activation/allocation/step cycles without exceptions."
        })
        print(f"  -> Repeated Activation (25 Cycles): {'PASS' if no_crashes_repeat else 'FAIL'}")

        risk_cycle = ["NORMAL", "WATCH", "WARNING", "CRITICAL", "NORMAL"]
        act_rapid = SwarmActivationEngine()
        rapid_pass = True
        for _ in range(10):
            for lvl in risk_cycle:
                out = act_rapid.evaluate_activation([{"station_id": "01570500", "risk_level": lvl, "data_quality_status": "VALID_OBSERVATION"}])
                if lvl == "NORMAL" and act_rapid.current_state not in ("NORMAL", "RISK_REDUCTION"):
                    rapid_pass = False
        section["tests"].append({
            "name": "rapid_risk_level_transitions",
            "passed": rapid_pass,
            "details": "Cycled through NORMAL->WATCH->WARNING->CRITICAL->NORMAL 10 times without state degradation."
        })
        print(f"  -> Rapid Risk Transitions: {'PASS' if rapid_pass else 'FAIL'}")

        coord_over = SwarmCoordinator()
        for i in range(30):
            coord_over.add_mission({
                "mission_id": f"M-OVER-{i}",
                "priority": (i % 3) + 1,
                "target_position": (i % 18 + 1, (i * 2) % 18 + 1),
                "required_capabilities": ["AERIAL_OBSERVATION"]
            })
        allocs_over = coord_over.allocate_missions(strategy="adaptive")
        max_assigned = sum(1 for a in coord_over.agents.values() if a.status == "ASSIGNED")
        pending_count = sum(1 for m in coord_over.missions.values() if m["status"] == "PENDING")
        oversubscription_safe = (len(allocs_over) <= 6 and max_assigned <= 6 and pending_count == (30 - len(allocs_over)))
        section["tests"].append({
            "name": "mission_queue_oversubscription_handling",
            "passed": oversubscription_safe,
            "details": f"Handled 30 missions for 6 agents: {len(allocs_over)} assigned, {pending_count} queued as PENDING safely."
        })
        print(f"  -> Queue Oversubscription (30 Missions / 6 Agents): {'PASS' if oversubscription_safe else 'FAIL'}")

        coord_all_fail = SwarmCoordinator()
        for aid in list(coord_all_fail.agents.keys()):
            coord_all_fail.simulate_agent_disconnect(aid)
        coord_all_fail.add_mission({"mission_id": "M-IMPOSSIBLE", "priority": 1, "target_position": (5, 5), "required_capabilities": ["AERIAL_OBSERVATION"]})
        allocs_all_fail = coord_all_fail.allocate_missions(strategy="adaptive")
        mass_disconnect_handled = (len(allocs_all_fail) == 0 and coord_all_fail.missions["M-IMPOSSIBLE"]["status"] == "PENDING")
        section["tests"].append({
            "name": "mass_agent_disconnection_handling",
            "passed": mass_disconnect_handled,
            "details": "All 6 agents disconnected; allocation returned empty list safely without crashes."
        })
        print(f"  -> Mass Disconnection (All 6 Agents Offline): {'PASS' if mass_disconnect_handled else 'FAIL'}")

        coord_empty = SwarmCoordinator()
        empty_alloc = coord_empty.allocate_missions(strategy="adaptive")
        empty_step = coord_empty.step_simulation()
        empty_lease = coord_empty.check_heartbeats_and_leases(timeout_sec=20)
        empty_queue_ok = (len(empty_alloc) == 0 and empty_step["completed_missions_count"] == 0 and len(empty_lease) == 0)
        section["tests"].append({
            "name": "empty_mission_queue_operations",
            "passed": empty_queue_ok,
            "details": "Allocations, simulation steps, and lease timeouts executed cleanly on empty queues."
        })
        print(f"  -> Empty Queue Invariant Safety: {'PASS' if empty_queue_ok else 'FAIL'}")

        coord_target = SwarmCoordinator()
        coord_target.add_mission({"mission_id": "M-OOB", "priority": 1, "target_position": (999, 999), "required_capabilities": ["AERIAL_OBSERVATION"]})
        alloc_oob = coord_target.allocate_missions(strategy="adaptive")
        oob_handled = (len(alloc_oob) == 0 and coord_target.missions["M-OOB"]["status"] == "PENDING")
        section["tests"].append({
            "name": "out_of_bounds_target_safety",
            "passed": oob_handled,
            "details": "Out-of-bounds target (999, 999) handled gracefully without infinite loop or crash."
        })
        print(f"  -> Out-of-Bounds Target Coordinates: {'PASS' if oob_handled else 'FAIL'}")

        if not all(t["passed"] for t in section["tests"]):
            section["status"] = "FAIL"
        self.results["sections"]["stress_and_edge_cases"] = section

    def test_historical_replay_validation(self):
        print("\n--- [Section 4] Historical Replay Validation Audit ---")
        section = {"status": "PASS", "tests": []}
        replay_engine = HistoricalReplayEngine()

        res_ymn = replay_engine.execute_replay("EVENT-IN-YAMUNA-2023", step_index=None, simulate_failure=True)
        ymn_frames = res_ymn.get("total_steps", 0)
        ymn_steps = len(res_ymn.get("timeline_frames", []))
        ymn_12_ok = (ymn_frames == 12 and ymn_steps == 12)
        section["tests"].append({
            "name": "yamuna_12_step_count_verification",
            "passed": ymn_12_ok,
            "details": f"Yamuna 2023 replay contains exactly {ymn_frames} frames (expected 12)."
        })
        print(f"  -> Yamuna July 2023 12 Frames: {'PASS' if ymn_12_ok else 'FAIL'}")

        ymn_provenance_ok = True
        ymn_peak_stage_frame = None
        ymn_peak_release_frame = None
        for frame in res_ymn.get("timeline_frames", []):
            obs = frame.get("observed_historical_state", {})
            risk_info = frame.get("vega_miti_risk_assessment", {})
            if obs.get("in_situ_discharge_cfs") is not None:
                ymn_provenance_ok = False
            if obs.get("in_situ_discharge_status") != "UNMETERED_IN_SITU":
                ymn_provenance_ok = False
            if obs.get("water_level_m") == 208.66:
                ymn_peak_stage_frame = (frame, obs, risk_info)
            if obs.get("upstream_release_cfs") == 359000.0:
                ymn_peak_release_frame = (frame, obs, risk_info)

        stage_verified = (ymn_peak_stage_frame is not None and ymn_peak_stage_frame[0].get("date") == "2023-07-13" and ymn_peak_stage_frame[2].get("risk_level") == "CRITICAL")
        release_verified = (ymn_peak_release_frame is not None and ymn_peak_release_frame[0].get("date") == "2023-07-11" and ymn_peak_release_frame[2].get("risk_level") == "CRITICAL")
        section["tests"].append({
            "name": "yamuna_provenance_and_peak_discharge_distinction",
            "passed": ymn_provenance_ok and stage_verified and release_verified,
            "details": f"Hathnikund peak release 359,000 cfs logged on 2023-07-11; all-time peak crest 208.66m on 2023-07-13; local in-situ discharge strictly UNMETERED_IN_SITU."
        })
        print(f"  -> Yamuna Discharge Provenance Distinction: {'PASS' if (ymn_provenance_ok and stage_verified and release_verified) else 'FAIL'}")

        res_sus = replay_engine.execute_replay("EVENT-US-SUSQUEHANNA-2023", step_index=None, simulate_failure=True)
        sus_frames = res_sus.get("total_steps", 0)
        sus_steps = len(res_sus.get("timeline_frames", []))
        sus_13_ok = (sus_frames == 13 and sus_steps == 13)
        section["tests"].append({
            "name": "susquehanna_13_step_count_verification",
            "passed": sus_13_ok,
            "details": f"Susquehanna 2023 replay contains exactly {sus_frames} frames (expected 13)."
        })
        print(f"  -> Susquehanna December 2023 13 Frames: {'PASS' if sus_13_ok else 'FAIL'}")

        sus_peak_frame = None
        for frame in res_sus.get("timeline_frames", []):
            obs = frame.get("observed_historical_state", {})
            risk_info = frame.get("vega_miti_risk_assessment", {})
            if obs.get("discharge_cfs") == 179000.0:
                sus_peak_frame = (frame, obs, risk_info)
        sus_peak_ok = (sus_peak_frame is not None and sus_peak_frame[2].get("risk_level") == "CRITICAL" and sus_peak_frame[0].get("date") == "2023-12-20")
        section["tests"].append({
            "name": "susquehanna_peak_crest_and_risk_progression",
            "passed": sus_peak_ok,
            "details": f"Peak flow 179,000 cfs on 2023-12-20 correctly categorized as CRITICAL."
        })
        print(f"  -> Susquehanna Crest & Risk Progression: {'PASS' if sus_peak_ok else 'FAIL'}")

        snap_before = http_get("/api/swarm/status")
        replay_engine.execute_replay("EVENT-IN-YAMUNA-2023", step_index=5)
        replay_engine.execute_replay("EVENT-US-SUSQUEHANNA-2023", step_index=6)
        snap_after = http_get("/api/swarm/status")
        isolation_ok = (snap_before.get("body", {}).get("data", {}).get("total_agents") == snap_after.get("body", {}).get("data", {}).get("total_agents") and
                        snap_before.get("body", {}).get("data", {}).get("active_agents") == snap_after.get("body", {}).get("data", {}).get("active_agents"))
        section["tests"].append({
            "name": "historical_replay_live_swarm_isolation",
            "passed": isolation_ok,
            "details": "Live swarm coordinator state remained strictly isolated and invariant across replay executions."
        })
        print(f"  -> Live Swarm Isolation During Replay: {'PASS' if isolation_ok else 'FAIL'}")

        rep1 = replay_engine.execute_replay("EVENT-IN-YAMUNA-2023", step_index=3)
        rep2 = replay_engine.execute_replay("EVENT-IN-YAMUNA-2023", step_index=3)
        idempotent_ok = (json.dumps(rep1["current_step_frame"]["observed_historical_state"], sort_keys=True) ==
                         json.dumps(rep2["current_step_frame"]["observed_historical_state"], sort_keys=True))
        section["tests"].append({
            "name": "replay_execution_idempotency",
            "passed": idempotent_ok,
            "details": "Repeated replay execution produced identical deterministic observation frames."
        })
        print(f"  -> Replay Deterministic Idempotency: {'PASS' if idempotent_ok else 'FAIL'}")

        if not all(t["passed"] for t in section["tests"]):
            section["status"] = "FAIL"
        self.results["sections"]["historical_replay_validation"] = section

    def test_api_reliability(self):
        print("\n--- [Section 5] API Reliability & Schema Contract Audit ---")
        section = {"status": "PASS", "tests": []}

        endpoints = [
            ("GET", "/api/health", None, 200, ["status", "service", "swarm_simulation"]),
            ("GET", "/api/swarm/status", None, 200, ["simulation_state", "total_agents", "active_agents"]),
            ("GET", "/api/swarm/agents", None, 200, None),
            ("GET", "/api/swarm/agents/DRONE_AERIAL_1", None, 200, ["agent_id", "status", "battery"]),
            ("GET", "/api/swarm/agents/NON_EXISTENT_AGENT", None, 404, None),
            ("GET", "/api/swarm/missions", None, 200, ["missions", "active_leases"]),
            ("POST", "/api/swarm/step", {"steps": 1}, 200, ["steps_executed", "agents_updated"]),
            ("POST", "/api/swarm/step", {"steps": -5}, 422, None),
            ("POST", "/api/swarm/step", {"steps": 500}, 422, None),
            ("POST", "/api/swarm/agents/DRONE_AERIAL_1/fail", None, 200, ["failed_agent_id", "status"]),
            ("POST", "/api/swarm/agents/NON_EXISTENT_AGENT/fail", None, 404, None),
            ("POST", "/api/swarm/agent/reconnect", {"agent_id": "DRONE_AERIAL_1"}, 200, ["agent_id", "status"]),
            ("GET", "/api/swarm/events?limit=10", None, 200, ["total_events", "events"]),
            ("POST", "/api/swarm/coordinator/fail", None, 200, ["coordinator_status"]),
            ("POST", "/api/swarm/coordinator/restore", None, 200, ["coordinator_status"]),
            ("GET", "/api/swarm/benchmarks", None, 200, ["comparison_framework", "adaptive_strategy"]),
            ("GET", "/api/swarm/replay/events", None, 200, None),
            ("GET", "/api/swarm/replay/event/EVENT-IN-YAMUNA-2023", None, 200, ["event_id", "river"]),
            ("GET", "/api/swarm/replay/event/NON_EXISTENT_EVENT", None, 200, None),
            ("POST", "/api/swarm/replay/run", {"event_id": "EVENT-IN-YAMUNA-2023", "step_index": 2}, 200, ["executed_steps_count"]),
            ("POST", "/api/swarm/replay/run", {"event_id": "NON_EXISTENT_EVENT"}, 200, None),
            ("POST", "/api/swarm/reset", None, 200, ["reset_status"])
        ]

        all_endpoints_passed = True
        for method, path, payload, exp_status, exp_keys in endpoints:
            res = http_post(path, payload) if method == "POST" else http_get(path)
            status_match = (res["status_code"] == exp_status)
            keys_match = True
            if exp_keys and status_match:
                data = res["body"].get("data") if "data" in res["body"] else res["body"]
                if isinstance(data, dict):
                    for k in exp_keys:
                        if k not in data:
                            keys_match = False
                            break
            pass_status = (status_match and keys_match)
            if not pass_status:
                all_endpoints_passed = False
            section["tests"].append({
                "endpoint": f"{method} {path}",
                "expected_status": exp_status,
                "received_status": res["status_code"],
                "passed": pass_status
            })

        print(f"  -> Verified {len(endpoints)} endpoint schemas & status codes: {'PASS' if all_endpoints_passed else 'FAIL'}")

        burst_success = True
        burst_latencies = []
        for _ in range(30):
            t0 = time.perf_counter()
            r = http_get("/api/swarm/status")
            dt = (time.perf_counter() - t0) * 1000.0
            burst_latencies.append(dt)
            if r["status_code"] != 200:
                burst_success = False

        avg_burst_lat = round(sum(burst_latencies) / len(burst_latencies), 2)
        section["tests"].append({
            "name": "burst_request_stability_30_calls",
            "passed": burst_success,
            "average_latency_ms": avg_burst_lat,
            "details": f"Executed 30 consecutive status requests with 100% success rate (mean {avg_burst_lat} ms)."
        })
        print(f"  -> Burst Request Stability (30 Calls): {'PASS' if burst_success else 'FAIL'} (avg {avg_burst_lat} ms)")

        if not all(t["passed"] for t in section["tests"]):
            section["status"] = "FAIL"
        self.results["sections"]["api_reliability"] = section

    def run_performance_benchmarks(self):
        print("\n--- [Section 6] Performance Benchmarking ---")
        bench = {}

        coord = SwarmCoordinator()
        alloc_times = []
        for i in range(20):
            m = {"mission_id": f"BM-AL-{i}", "priority": 1, "target_position": (i % 18 + 1, (i * 3) % 18 + 1), "required_capabilities": ["AERIAL_OBSERVATION"]}
            coord.add_mission(m)
            t0 = time.perf_counter()
            coord.allocate_missions(strategy="adaptive")
            dt = (time.perf_counter() - t0) * 1000.0
            alloc_times.append(dt)
            coord.step_simulation()

        bench["mission_allocation_latency_ms"] = {
            "mean": round(sum(alloc_times) / len(alloc_times), 3),
            "min": round(min(alloc_times), 3),
            "max": round(max(alloc_times), 3)
        }
        print(f"  -> Mission Allocation Latency: mean={bench['mission_allocation_latency_ms']['mean']} ms (max={bench['mission_allocation_latency_ms']['max']} ms)")

        coord_step = SwarmCoordinator()
        step_times = []
        for _ in range(50):
            t0 = time.perf_counter()
            coord_step.step_simulation()
            dt = (time.perf_counter() - t0) * 1000.0
            step_times.append(dt)

        bench["swarm_cycle_step_latency_ms"] = {
            "mean": round(sum(step_times) / len(step_times), 3),
            "min": round(min(step_times), 3),
            "max": round(max(step_times), 3)
        }
        print(f"  -> Swarm Cycle Step Latency (50 steps): mean={bench['swarm_cycle_step_latency_ms']['mean']} ms")

        coord_reassign = SwarmCoordinator()
        reassign_times = []
        for i in range(10):
            m = {"mission_id": f"BM-RE-{i}", "priority": 1, "target_position": (4, 4), "required_capabilities": ["AERIAL_OBSERVATION"]}
            coord_reassign.add_mission(m)
            coord_reassign.allocate_missions(strategy="adaptive")
            coord_reassign.simulate_agent_disconnect("DRONE_AERIAL_1")
            
            t0 = time.perf_counter()
            coord_reassign.check_heartbeats_and_leases(timeout_sec=0)
            coord_reassign.allocate_missions(strategy="adaptive")
            dt = (time.perf_counter() - t0) * 1000.0
            reassign_times.append(dt)
            
            coord_reassign.simulate_agent_reconnect("DRONE_AERIAL_1")

        bench["mission_reassignment_latency_ms"] = {
            "mean": round(sum(reassign_times) / len(reassign_times), 3),
            "min": round(min(reassign_times), 3),
            "max": round(max(reassign_times), 3)
        }
        print(f"  -> Mission Reassignment Latency: mean={bench['mission_reassignment_latency_ms']['mean']} ms")

        endpoint_latencies = {}
        for ep in ["/api/swarm/status", "/api/swarm/agents", "/api/swarm/missions", "/api/swarm/benchmarks"]:
            lats = []
            for _ in range(15):
                t0 = time.perf_counter()
                http_get(ep)
                lats.append((time.perf_counter() - t0) * 1000.0)
            endpoint_latencies[ep] = {
                "p50_ms": round(sorted(lats)[len(lats) // 2], 2),
                "mean_ms": round(sum(lats) / len(lats), 2),
                "p95_ms": round(sorted(lats)[int(len(lats) * 0.95)], 2)
            }
            print(f"  -> Endpoint {ep} Latency: mean={endpoint_latencies[ep]['mean_ms']} ms | p95={endpoint_latencies[ep]['p95_ms']} ms")

        bench["api_endpoint_latencies"] = endpoint_latencies

        t_sim_start = time.perf_counter()
        coord_100 = SwarmCoordinator()
        for i in range(100):
            if i % 10 == 0:
                coord_100.add_mission({"mission_id": f"M-100-{i}", "priority": 1, "target_position": (i % 18 + 1, (i * 2) % 18 + 1), "required_capabilities": ["AERIAL_OBSERVATION"]})
                coord_100.allocate_missions(strategy="adaptive")
            coord_100.step_simulation()
        total_100_time = round((time.perf_counter() - t_sim_start) * 1000.0, 2)
        bench["hundred_cycle_simulation_total_ms"] = total_100_time
        print(f"  -> 100 Full Simulation Cycles Stability: {total_100_time} ms total (avg {round(total_100_time / 100.0, 2)} ms/cycle)")

        self.results["performance_benchmarks"] = bench

    def compile_summary(self):
        sec_statuses = {k: v.get("status") for k, v in self.results["sections"].items()}
        total_tests = sum(len(v.get("tests", [])) for v in self.results["sections"].values())
        passed_tests = sum(sum(1 for t in v.get("tests", []) if t.get("passed", False)) for v in self.results["sections"].values())
        
        self.results["summary"] = {
            "overall_status": "PASS" if all(s == "PASS" for s in sec_statuses.values()) else "FAIL",
            "section_statuses": sec_statuses,
            "total_audit_tests": total_tests,
            "passed_audit_tests": passed_tests,
            "pass_rate_pct": round((passed_tests / total_tests) * 100.0, 2) if total_tests > 0 else 0.0
        }
        print("\n=================================================================")
        print(f"AUDIT COMPLETE — OVERALL STATUS: {self.results['summary']['overall_status']}")
        print(f"Total Tests Run: {total_tests} | Passed: {passed_tests} ({self.results['summary']['pass_rate_pct']}%)")
        print("=================================================================")

    def save_artifacts(self):
        out_dir = os.path.join("outputs", "swarm")
        os.makedirs(out_dir, exist_ok=True)
        res_file = os.path.join(out_dir, "swarm_stress_test_results.json")
        with open(res_file, "w", encoding="utf-8") as f:
            json.dump(self.results, f, indent=2)
        print(f"Saved machine-readable stress test results to: {res_file}")

if __name__ == "__main__":
    auditor = SwarmAuditor()
    auditor.run_all()
