import unittest
from starlette.testclient import TestClient
from src.backend.app import app

class TestUnifiedEndToEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_complete_e2e_pipeline(self):
        health_resp = self.client.get("/api/health")
        self.assertEqual(health_resp.status_code, 200)
        health_data = health_resp.json()["data"]
        self.assertEqual(health_data["status"], "HEALTHY")
        self.assertEqual(health_data["swarm_simulation"], "ACTIVE")

        stations_resp = self.client.get("/api/stations")
        self.assertEqual(stations_resp.status_code, 200)
        stations = stations_resp.json()["data"]["stations"]
        self.assertGreater(len(stations), 0)
        test_station_id = stations[0]["station_id"]

        pred_resp = self.client.post("/api/predict", json={
            "station_id": test_station_id,
            "start_date": "2023-01-01",
            "end_date": "2023-01-05",
            "config": "A"
        })
        self.assertEqual(pred_resp.status_code, 200)
        predictions = pred_resp.json()["data"]["predictions"]
        self.assertEqual(len(predictions), 5)
        self.assertIn("predicted_discharge_cfs", predictions[0])
        self.assertIn("risk_level", predictions[0])

        assessments_payload = [
            {
                "station_id": p["station_id"],
                "date": p["date"],
                "discharge_cfs": p["predicted_discharge_cfs"],
                "risk_level": "CRITICAL" if i == 0 else p["risk_level"],
                "evidence_quality": "HIGH"
            }
            for i, p in enumerate(predictions)
        ]

        activate_resp = self.client.post("/api/swarm/activate", json={"assessments": assessments_payload})
        self.assertEqual(activate_resp.status_code, 200)
        act_data = activate_resp.json()["data"]
        self.assertEqual(act_data["activation_state"], "CRITICAL")
        self.assertGreater(act_data["missions_generated"], 0)
        self.assertGreater(len(act_data["allocations_made"]), 0)

        assigned_agent = act_data["allocations_made"][0]["agent_id"]

        agents_resp = self.client.get("/api/swarm/agents")
        self.assertEqual(agents_resp.status_code, 200)
        agents = agents_resp.json()["data"]
        self.assertEqual(len(agents), 6)

        missions_resp = self.client.get("/api/swarm/missions")
        self.assertEqual(missions_resp.status_code, 200)
        missions_data = missions_resp.json()["data"]
        self.assertGreater(missions_data["total_missions"], 0)

        disc_resp = self.client.post("/api/swarm/agent/disconnect", json={"agent_id": assigned_agent})
        self.assertEqual(disc_resp.status_code, 200)
        disc_data = disc_resp.json()["data"]
        self.assertEqual(disc_data["status"], "DISCONNECTED")

        rec_resp = self.client.post("/api/swarm/agent/reconnect", json={"agent_id": assigned_agent})
        self.assertEqual(rec_resp.status_code, 200)
        self.assertEqual(rec_resp.json()["data"]["status"], "CONNECTED")

        fail_resp = self.client.post("/api/swarm/coordinator/fail")
        self.assertEqual(fail_resp.status_code, 200)
        self.assertEqual(fail_resp.json()["data"]["coordinator_status"], "OFFLINE")

        restore_resp = self.client.post("/api/swarm/coordinator/restore")
        self.assertEqual(restore_resp.status_code, 200)
        self.assertEqual(restore_resp.json()["data"]["coordinator_status"], "ONLINE")

        bench_resp = self.client.post("/api/swarm/evaluate/compare")
        self.assertEqual(bench_resp.status_code, 200)
        bench_data = bench_resp.json()["data"]
        self.assertIn("static_strategy", bench_data)
        self.assertIn("adaptive_strategy", bench_data)
        self.assertTrue(bench_data["adaptive_strategy"]["coordinator_fault_tolerant"])
        self.assertFalse(bench_data["static_strategy"]["coordinator_fault_tolerant"])
        self.assertGreaterEqual(
            bench_data["adaptive_strategy"]["effective_coverage_rate_pct"],
            bench_data["static_strategy"]["effective_coverage_rate_pct"]
        )

        replay_run_resp = self.client.post("/api/swarm/replay/run", json={"event_id": "EVENT-US-SUSQUEHANNA-2023"})
        self.assertEqual(replay_run_resp.status_code, 200)
        replay_run_data = replay_run_resp.json()["data"]
        self.assertEqual(replay_run_data["country"], "United States")
        self.assertGreater(replay_run_data["executed_steps_count"], 0)

if __name__ == "__main__":
    unittest.main()
