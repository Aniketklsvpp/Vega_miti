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
        self.assertEqual(data["river"], "Yamuna River (Upper Yamuna Basin, Ganges Sub-basin)")
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
        self.assertIsNotNone(frame4["simulated_swarm_response"]["failure_event"])

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

if __name__ == "__main__":
    unittest.main()

