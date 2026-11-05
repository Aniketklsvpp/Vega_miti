import unittest
import copy
from starlette.testclient import TestClient

from src.backend.app import app
from src.historical_replay import HistoricalReplayEngine, HISTORICAL_EVENTS_CATALOG
from src.swarm_api import coordinator as live_coordinator

class TestHistoricalReplay(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.engine = HistoricalReplayEngine()

    def test_historical_event_catalogue(self):
        resp = self.client.get("/api/swarm/replay/events")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "success")
        events = body["data"]
        self.assertGreaterEqual(len(events), 2)
        event_ids = [e["event_id"] for e in events]
        self.assertIn("EVENT-IN-YAMUNA-2023", event_ids)
        self.assertIn("EVENT-US-SUSQUEHANNA-2023", event_ids)

    def test_event_metadata_retrieval(self):
        resp = self.client.get("/api/swarm/replay/event/EVENT-IN-YAMUNA-2023")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "success")
        data = body["data"]
        self.assertEqual(data["country"], "India")
        self.assertEqual(data["river"], "Yamuna River (Upper Yamuna Basin)")
        self.assertEqual(data["primary_gauge_station"]["station_id"], "YMN-DEL-ORB-01")
        self.assertEqual(data["primary_gauge_station"]["latitude"], 28.663)
        self.assertEqual(data["primary_gauge_station"]["longitude"], 77.234)
        self.assertEqual(data["total_timeline_steps"], 12)

    def test_valid_replay_start_and_step(self):
        resp_step0 = self.client.post("/api/swarm/replay/run", json={
            "event_id": "EVENT-IN-YAMUNA-2023",
            "step_index": 0,
            "simulate_failure": False
        })
        self.assertEqual(resp_step0.status_code, 200)
        data0 = resp_step0.json()["data"]
        self.assertEqual(data0["executed_steps_count"], 1)
        frame0 = data0["current_step_frame"]
        self.assertEqual(frame0["date"], "2023-07-07")
        self.assertEqual(frame0["timeline_phase"], "BEFORE_FLOOD")
        self.assertEqual(frame0["vega_miti_risk_assessment"]["risk_level"], "NORMAL")

        resp_step4 = self.client.post("/api/swarm/replay/run", json={
            "event_id": "EVENT-IN-YAMUNA-2023",
            "step_index": 4,
            "simulate_failure": True
        })
        self.assertEqual(resp_step4.status_code, 200)
        data4 = resp_step4.json()["data"]
        self.assertEqual(data4["executed_steps_count"], 5)
        frame4 = data4["current_step_frame"]
        self.assertEqual(frame4["date"], "2023-07-11")
        self.assertEqual(frame4["timeline_phase"], "HIGH_RISK_PEAK")
        self.assertEqual(frame4["vega_miti_risk_assessment"]["risk_level"], "CRITICAL")
        fe = frame4["simulated_swarm_response"]["failure_event"]
        self.assertIsNotNone(fe)
        self.assertGreater(len(fe["reassigned_missions"]), 0)
        self.assertGreater(len(fe["reallocations"]), 0)
        self.assertNotEqual(fe["disconnected_agent"], fe["reallocations"][0]["agent_id"])

    def test_invalid_event_id(self):
        resp = self.client.post("/api/swarm/replay/run", json={"event_id": "NON_EXISTENT_EVENT"})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "error")
        self.assertIn("not found in catalog", body["error"])

    def test_invalid_step_index(self):
        resp_neg = self.client.post("/api/swarm/replay/run", json={"event_id": "EVENT-IN-YAMUNA-2023", "step_index": -5})
        self.assertEqual(resp_neg.status_code, 200)
        body_neg = resp_neg.json()
        self.assertEqual(body_neg["status"], "error")
        self.assertIn("Invalid step_index", body_neg["error"])

        resp_oob = self.client.post("/api/swarm/replay/run", json={"event_id": "EVENT-IN-YAMUNA-2023", "step_index": 999})
        self.assertEqual(resp_oob.status_code, 200)
        body_oob = resp_oob.json()
        self.assertEqual(body_oob["status"], "error")
        self.assertIn("Invalid step_index", body_oob["error"])

    def test_replay_reset(self):
        resp = self.client.post("/api/swarm/replay/run", json={"event_id": "EVENT-IN-YAMUNA-2023", "action": "reset"})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["data"]["reset_status"], "COMPLETED")

    def test_deterministic_replay(self):
        run1 = self.engine.execute_replay("EVENT-IN-YAMUNA-2023", step_index=3, simulate_failure=False)
        run2 = self.engine.execute_replay("EVENT-IN-YAMUNA-2023", step_index=3, simulate_failure=False)
        self.assertEqual(run1["executed_steps_count"], run2["executed_steps_count"])
        f1 = run1["current_step_frame"]
        f2 = run2["current_step_frame"]
        self.assertEqual(f1["date"], f2["date"])
        self.assertEqual(f1["vega_miti_risk_assessment"]["risk_level"], f2["vega_miti_risk_assessment"]["risk_level"])

    def test_missing_historical_observations(self):
        row_missing = {
            "date": "2023-07-09",
            "water_level_m": None,
            "upstream_release_cfs": None,
            "rainfall_mm": 50.0
        }
        assess = self.engine.assess_event_observation("EVENT-IN-YAMUNA-2023", row_missing)
        self.assertEqual(assess["data_quality_status"], "INVALID_OR_MISSING")
        self.assertEqual(assess["evidence_quality"], "DEGRADED")
        self.assertEqual(assess["risk_level"], "UNKNOWN")
        self.assertEqual(assess["risk_state"], "INSUFFICIENT_DATA")
        self.assertEqual(assess["confidence_score"], 0.0)
        self.assertIsNone(assess["in_situ_discharge_cfs"])
        self.assertIsNone(assess["discharge_cfs"])
        self.assertTrue(assess["is_provisional"])

    def test_statutory_vs_custom_rules_separation(self):
        meta = self.engine.get_event_metadata("EVENT-IN-YAMUNA-2023")
        st_marks = meta["primary_gauge_station"]["statutory_reference_marks"]
        self.assertEqual(st_marks["warning_level_m"], 204.50)
        self.assertEqual(st_marks["danger_level_m"], 205.33)
        self.assertIn("Central Water Commission", st_marks["authority"])

        op_rules = meta["primary_gauge_station"]["vega_miti_operational_rules"]
        self.assertEqual(op_rules["critical_water_level_trigger_m"], 206.50)
        self.assertEqual(op_rules["rule_type"], "VEGA_MITI_DEMONSTRATION_OPERATIONAL_THRESHOLD")

    def test_critical_temporal_integrity(self):
        eval_before = self.engine.execute_replay("EVENT-IN-YAMUNA-2023", step_index=1, simulate_failure=False)
        frame1_before = eval_before["current_step_frame"]
        risk_before = frame1_before["vega_miti_risk_assessment"]["risk_level"]
        phase_before = frame1_before["timeline_phase"]

        original_timeline = copy.deepcopy(HISTORICAL_EVENTS_CATALOG["EVENT-IN-YAMUNA-2023"]["timeline_data"])
        try:
            HISTORICAL_EVENTS_CATALOG["EVENT-IN-YAMUNA-2023"]["timeline_data"][6]["water_level_m"] = 250.0
            HISTORICAL_EVENTS_CATALOG["EVENT-IN-YAMUNA-2023"]["timeline_data"].append({
                "date": "2023-07-30",
                "phase": "HIGH_RISK_PEAK",
                "rainfall_mm": 500.0,
                "water_level_m": 220.0,
                "upstream_release_cfs": 999999.0,
                "key_observation": "Synthetic future injection test"
            })

            eval_after = self.engine.execute_replay("EVENT-IN-YAMUNA-2023", step_index=1, simulate_failure=False)
            frame1_after = eval_after["current_step_frame"]
            risk_after = frame1_after["vega_miti_risk_assessment"]["risk_level"]
            phase_after = frame1_after["timeline_phase"]

            self.assertEqual(risk_before, risk_after)
            self.assertEqual(phase_before, phase_after)
            self.assertEqual(frame1_before["date"], frame1_after["date"])
        finally:
            HISTORICAL_EVENTS_CATALOG["EVENT-IN-YAMUNA-2023"]["timeline_data"] = original_timeline

    def test_critical_isolation(self):
        agents_before_resp = self.client.get("/api/swarm/agents")
        self.assertEqual(agents_before_resp.status_code, 200)
        agents_before = agents_before_resp.json()["data"]

        missions_before_resp = self.client.get("/api/swarm/missions")
        self.assertEqual(missions_before_resp.status_code, 200)
        missions_before_count = missions_before_resp.json()["data"]["total_missions"]

        replay_resp = self.client.post("/api/swarm/replay/run", json={
            "event_id": "EVENT-IN-YAMUNA-2023",
            "step_index": 4,
            "simulate_failure": True
        })
        self.assertEqual(replay_resp.status_code, 200)

        reset_resp = self.client.post("/api/swarm/replay/run", json={
            "event_id": "EVENT-IN-YAMUNA-2023",
            "action": "reset"
        })
        self.assertEqual(reset_resp.status_code, 200)

        agents_after_resp = self.client.get("/api/swarm/agents")
        self.assertEqual(agents_after_resp.status_code, 200)
        agents_after = agents_after_resp.json()["data"]

        missions_after_resp = self.client.get("/api/swarm/missions")
        self.assertEqual(missions_after_resp.status_code, 200)
        missions_after_count = missions_after_resp.json()["data"]["total_missions"]

        self.assertEqual(len(agents_before), len(agents_after))
        self.assertEqual(missions_before_count, missions_after_count)
        for b, a in zip(agents_before, agents_after):
            self.assertEqual(b["agent_id"], a["agent_id"])
            self.assertEqual(b["status"], a["status"])
            self.assertEqual(b["connectivity"], a["connectivity"])

    def test_us_susquehanna_benchmark_replay(self):
        resp = self.client.post("/api/swarm/replay/run", json={
            "event_id": "EVENT-US-SUSQUEHANNA-2023",
            "step_index": 6
        })
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "success")
        data = body["data"]
        self.assertEqual(data["country"], "United States")
        self.assertEqual(data["river"], "Susquehanna River")
        self.assertGreater(data["executed_steps_count"], 0)
        frame = data["current_step_frame"]
        self.assertEqual(frame["date"], "2023-12-20")
        self.assertEqual(frame["timeline_phase"], "HIGH_RISK_PEAK")
        self.assertEqual(frame["vega_miti_risk_assessment"]["risk_level"], "CRITICAL")

    def test_yamuna_provenance_and_partial_record_audit(self):
        resp = self.client.get("/api/swarm/replay/event/EVENT-IN-YAMUNA-2023")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "success")
        data = body["data"]
        self.assertTrue(data["is_partial_record"])
        self.assertEqual(data["completeness_status"], "PARTIAL_RECORD_STAGE_AND_UPSTREAM_BARRAGE_DISCHARGE")
        self.assertIn("in_situ_continuous_discharge_cfs", data["missing_measurements"])
        self.assertIn("data_provenance", data)
        self.assertIn("water_levels", data["data_provenance"])
        self.assertIn("barrage_outflow", data["data_provenance"])
        self.assertIn("rainfall", data["data_provenance"])

        timeline = data["timeline_data"]
        self.assertEqual(len(timeline), 12)
        for step in timeline:
            self.assertIn("observation_timestamp", step)
            self.assertIn("publication_timestamp", step)
            self.assertIn("water_level_m", step)
            self.assertIn("upstream_release_cfs", step)
            self.assertIsNone(step["in_situ_discharge_cfs"])
            self.assertEqual(step["in_situ_discharge_status"], "UNMETERED_IN_SITU")
            self.assertIn("rainfall_mm", step)

    def test_coordinate_frame_disclaimer_in_replay(self):
        resp = self.client.post("/api/swarm/replay/run", json={
            "event_id": "EVENT-IN-YAMUNA-2023",
            "step_index": 0
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]
        frame = data["current_step_frame"]
        sim_resp = frame["simulated_swarm_response"]
        self.assertEqual(sim_resp["coordinate_frame"], "SIMULATED_20X20_GRID")
        self.assertIn("simulated 20x20", sim_resp["coordinate_disclaimer"].lower())

    def test_unambiguous_discharge_fields_regression(self):
        resp = self.client.post("/api/swarm/replay/run", json={
            "event_id": "EVENT-IN-YAMUNA-2023",
            "step_index": 4,
            "simulate_failure": False
        })
        self.assertEqual(resp.status_code, 200)
        frame = resp.json()["data"]["current_step_frame"]
        hist_state = frame["observed_historical_state"]
        self.assertEqual(hist_state["upstream_release_cfs"], 359000.0)
        self.assertIsNone(hist_state["in_situ_discharge_cfs"])
        self.assertEqual(hist_state["in_situ_discharge_status"], "UNMETERED_IN_SITU")
        self.assertIsNone(hist_state["discharge_cfs"])
        self.assertEqual(hist_state["legacy_deprecated_discharge_cfs"], 359000.0)
        self.assertIn("discharge_semantics_clarification", hist_state)

        assess = frame["vega_miti_risk_assessment"]
        self.assertEqual(assess["upstream_release_cfs"], 359000.0)
        self.assertIsNone(assess["in_situ_discharge_cfs"])
        self.assertIsNone(assess["discharge_cfs"])
        self.assertEqual(assess["legacy_deprecated_discharge_cfs"], 359000.0)

    def test_replay_timestamp_consistency_regression(self):
        resp = self.client.post("/api/swarm/replay/run", json={
            "event_id": "EVENT-IN-YAMUNA-2023",
            "step_index": 4,
            "simulate_failure": False
        })
        self.assertEqual(resp.status_code, 200)
        frame = resp.json()["data"]["current_step_frame"]
        clock = frame["simulated_swarm_response"]["simulation_clock"]
        self.assertEqual(clock["event_step_date"], "2023-07-11")
        self.assertIn("2023-07-11", clock["historical_observation_timestamp"])
        self.assertIn("historical_event_epoch_sec", clock)
        self.assertIn("runtime_simulation_wall_clock_sec", clock)
        self.assertNotEqual(clock["historical_event_epoch_sec"], clock["runtime_simulation_wall_clock_sec"])

        allocs = frame["simulated_swarm_response"]["allocations_in_step"]
        if allocs:
            for alloc in allocs:
                import datetime
                dt_obj = datetime.datetime.fromtimestamp(alloc["assigned_at"], tz=datetime.timezone.utc)
                self.assertIn(dt_obj.strftime("%Y-%m-%d"), ("2023-07-10", "2023-07-11"))
                self.assertEqual(alloc["timestamp_domain"], "HISTORICAL_EVENT_TIME")
                self.assertIn("runtime_simulation_wall_clock_sec", alloc)

    def test_evidence_quality_distinction_regression(self):
        resp = self.client.post("/api/swarm/replay/run", json={
            "event_id": "EVENT-IN-YAMUNA-2023",
            "step_index": 4
        })
        self.assertEqual(resp.status_code, 200)
        assess = resp.json()["data"]["current_step_frame"]["vega_miti_risk_assessment"]
        self.assertEqual(assess["evidence_quality"], "HIGH")
        self.assertIn("evidence_quality_breakdown", assess)
        breakdown = assess["evidence_quality_breakdown"]
        self.assertEqual(breakdown["individual_observation_confidence"], "HIGH")
        self.assertEqual(breakdown["record_completeness"], "PARTIAL")
        self.assertEqual(breakdown["in_situ_discharge_availability"], "UNMETERED_IN_SITU")
        self.assertIn("POINT_OBSERVATION", breakdown["spatial_rainfall_coverage"])

    def test_hydraulic_transit_time_context_regression(self):
        resp = self.client.get("/api/swarm/replay/event/EVENT-IN-YAMUNA-2023")
        self.assertEqual(resp.status_code, 200)
        barrage = resp.json()["data"]["upstream_barrage"]
        self.assertIn("hydraulic_transit_time_context", barrage)
        ctx = barrage["hydraulic_transit_time_context"]
        self.assertEqual(ctx["classification"], "APPROXIMATE_CONTEXTUAL_ASSUMPTION")
        self.assertIn("48 to 72 hours", ctx["empirical_estimate_hours"])
        self.assertIn("causal_disclaimer", ctx)

    def test_deterministic_swarm_recovery_and_obstacle_avoidance_regression(self):
        from src.swarm_activation import SwarmActivationEngine
        act_engine = SwarmActivationEngine()
        obstacles = {(7, 8), (7, 9), (7, 10), (14, 12), (14, 13), (14, 14)}

        # 1. Deterministic grid mapping & obstacle avoidance
        for st_id in ["YMN-DEL-ORB-01", "01570500", "01576000", "TEST-STATION-99"]:
            pos1 = act_engine._station_to_grid(st_id)
            pos2 = act_engine._station_to_grid(st_id)
            self.assertEqual(pos1, pos2, f"Station mapping must be deterministic for {st_id}")
            self.assertNotIn(pos1, obstacles, f"Position {pos1} collides with obstacle")
            self.assertNotIn((pos1[0] + 1, pos1[1] + 1), obstacles, "Offset position collides with obstacle")

        # 2. Replay failure recovery determinism across multiple executions
        for _ in range(5):
            res = self.engine.execute_replay("EVENT-IN-YAMUNA-2023", step_index=4, simulate_failure=True)
            self.assertEqual(res.get("status", "success"), "success")
            frame4 = res["timeline_frames"][-1]
            fe = frame4["simulated_swarm_response"]["failure_event"]
            self.assertIsNotNone(fe)
            self.assertGreater(len(fe["reassigned_missions"]), 0)
            self.assertGreater(len(fe["reallocations"]), 0)
            self.assertNotEqual(fe["disconnected_agent"], fe["reallocations"][0]["agent_id"])

if __name__ == "__main__":
    unittest.main()

