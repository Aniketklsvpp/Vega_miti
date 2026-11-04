import unittest
from starlette.testclient import TestClient
from src.swarm_api import app

class TestSwarmAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_get_agents(self):
        resp = self.client.get("/api/swarm/agents")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "success")
        self.assertIsNone(body["error"])
        self.assertEqual(len(body["data"]), 6)
        first = body["data"][0]
        self.assertIn("agent_id", first)
        self.assertIn("capabilities", first)
        self.assertIn("battery", first)
        self.assertIn("connectivity", first)
        self.assertIn("status", first)

    def test_get_missions(self):
        resp = self.client.get("/api/swarm/missions")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "success")
        self.assertIn("missions", body["data"])
        self.assertIn("active_leases", body["data"])

    def test_activate_swarm(self):
        payload = {
            "assessments": [
                {"station_id": "01570500", "risk_level": "CRITICAL", "data_quality_status": "VALID_OBSERVATION"}
            ]
        }
        resp = self.client.post("/api/swarm/activate", json=payload)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["data"]["activation_state"], "CRITICAL")
        self.assertGreater(body["data"]["missions_generated"], 0)

    def test_agent_disconnect_and_reconnect(self):
        disc_resp = self.client.post("/api/swarm/agent/disconnect", json={"agent_id": "DRONE_AERIAL_1"})
        self.assertEqual(disc_resp.status_code, 200)
        disc_body = disc_resp.json()
        self.assertEqual(disc_body["status"], "success")
        self.assertEqual(disc_body["data"]["status"], "DISCONNECTED")

        rec_resp = self.client.post("/api/swarm/agent/reconnect", json={"agent_id": "DRONE_AERIAL_1"})
        self.assertEqual(rec_resp.status_code, 200)
        rec_body = rec_resp.json()
        self.assertEqual(rec_body["status"], "success")
        self.assertEqual(rec_body["data"]["status"], "CONNECTED")

    def test_coordinator_fail_and_restore(self):
        fail_resp = self.client.post("/api/swarm/coordinator/fail")
        self.assertEqual(fail_resp.status_code, 200)
        fail_body = fail_resp.json()
        self.assertEqual(fail_body["data"]["coordinator_status"], "OFFLINE")

        restore_resp = self.client.post("/api/swarm/coordinator/restore")
        self.assertEqual(restore_resp.status_code, 200)
        restore_body = restore_resp.json()
        self.assertEqual(restore_body["data"]["coordinator_status"], "ONLINE")

    def test_evaluation_endpoints(self):
        stat_resp = self.client.get("/api/swarm/evaluation/static")
        self.assertEqual(stat_resp.status_code, 200)
        self.assertEqual(stat_resp.json()["status"], "success")

        adapt_resp = self.client.get("/api/swarm/evaluation/adaptive")
        self.assertEqual(adapt_resp.status_code, 200)
        self.assertEqual(adapt_resp.json()["status"], "success")

        comp_resp = self.client.post("/api/swarm/evaluate/compare")
        self.assertEqual(comp_resp.status_code, 200)
        comp_body = comp_resp.json()
        self.assertEqual(comp_body["status"], "success")
        self.assertIn("performance_differential", comp_body["data"])

    def test_reset_simulation(self):
        resp = self.client.post("/api/swarm/reset")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["reset_status"], "COMPLETED")

if __name__ == "__main__":
    unittest.main()
