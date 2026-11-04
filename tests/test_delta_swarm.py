import unittest
import numpy as np
import pandas as pd
from src.risk_engine import FloodRiskEngine
from src.hydrological_evaluation import compute_forecast_metrics
from src.swarm_activation import SwarmActivationEngine
from src.swarm_simulator import AStarPlanner, SwarmCoordinator, run_coordination_comparison
from src.predict import RiverDischargePredictor

class TestDeltaSwarm(unittest.TestCase):
    def test_risk_engine_thresholds(self):
        engine = FloodRiskEngine()
        normal_res = engine.classify_discharge("01570500", 500.0)
        self.assertEqual(normal_res["risk_level"], "NORMAL")
        
        crit_res = engine.classify_discharge("01570500", 200000.0)
        self.assertEqual(crit_res["risk_level"], "CRITICAL")
        self.assertIn("CRITICAL threshold", crit_res["explanation"])

    def test_basinshift_evaluator(self):
        y_t = np.array([100.0, 200.0, 500.0, 1000.0, 2000.0])
        y_p = np.array([110.0, 190.0, 480.0, 950.0, 1900.0])
        fm = compute_forecast_metrics(y_t, y_p)
        self.assertGreater(fm["nse"], 0.9)
        self.assertIn("mae", fm)
        self.assertIn("rmse", fm)

    def test_swarm_activation_engine(self):
        activation = SwarmActivationEngine()
        assessments = [
            {"station_id": "S1", "risk_level": "CRITICAL", "data_quality_status": "VALID_OBSERVATION"},
            {"station_id": "S2", "risk_level": "WARNING", "data_quality_status": "VALID_OBSERVATION"}
        ]
        res = activation.evaluate_activation(assessments)
        self.assertEqual(res["current_state"], "CRITICAL")
        self.assertGreater(res["active_missions_generated"], 0)

    def test_astar_pathfinding_and_rerouting(self):
        planner = AStarPlanner(grid_size=(10, 10), obstacles=[(2, 1), (2, 2), (2, 3)])
        path = planner.find_path((1, 2), (3, 2))
        self.assertIsNotNone(path)
        self.assertNotIn((2, 2), path)

        planner.add_obstacle((3, 2))
        blocked_path = planner.find_path((1, 2), (3, 2))
        self.assertIsNone(blocked_path)

    def test_swarm_coordinator_allocation_and_leases(self):
        coordinator = SwarmCoordinator()
        self.assertEqual(len(coordinator.agents), 6)

        mission = {
            "mission_id": "MSN-TEST-1",
            "priority": 1,
            "target_position": (5, 5),
            "required_capabilities": ["AERIAL_OBSERVATION", "VERIFICATION"]
        }
        coordinator.add_mission(mission)
        allocations = coordinator.allocate_missions(strategy="adaptive")
        self.assertEqual(len(allocations), 1)
        self.assertEqual(allocations[0]["agent_id"], "DRONE_AERIAL_1")

        coordinator.simulate_agent_disconnect("DRONE_AERIAL_1")
        reassigned = coordinator.check_heartbeats_and_leases(timeout_sec=0)
        self.assertIn("MSN-TEST-1", reassigned)

    def test_coordinator_outage_buffering_and_sync(self):
        coordinator = SwarmCoordinator()
        coordinator.simulate_coordinator_failure()
        self.assertFalse(coordinator.coordinator_active)

        coordinator.agents["USV_RIVER_1"].record_event("SURFACE_VELOCITY_CHECK", {"velocity": 1.9})
        self.assertEqual(len(coordinator.agents["USV_RIVER_1"].event_buffer), 1)

        coordinator.simulate_coordinator_recovery()
        self.assertTrue(coordinator.coordinator_active)
        self.assertEqual(coordinator.get_swarm_snapshot()["synchronized_events_count"], 1)

    def test_static_vs_adaptive_coordination_comparison(self):
        missions = [
            {
                "mission_id": f"M-{i}",
                "priority": (i % 3) + 1,
                "target_position": (i * 2 + 1, i * 2 + 1),
                "required_capabilities": ["AERIAL_OBSERVATION"] if i % 2 == 0 else ["RIVER_MONITORING"]
            }
            for i in range(4)
        ]
        comparison = run_coordination_comparison(missions)
        self.assertIn("static_strategy", comparison)
        self.assertIn("adaptive_strategy", comparison)
        self.assertTrue(comparison["adaptive_strategy"]["coordinator_fault_tolerant"])

    def test_six_agents_initialization_and_capabilities(self):
        coordinator = SwarmCoordinator()
        expected_agents = {
            "DRONE_AERIAL_1": "UAV",
            "DRONE_AERIAL_2": "UAV",
            "USV_RIVER_1": "USV",
            "USV_RIVER_2": "USV",
            "RELAY_NODE_1": "RELAY",
            "GROUND_SCOUT_1": "UGV"
        }
        self.assertEqual(len(coordinator.agents), 6)
        for aid, atype in expected_agents.items():
            self.assertIn(aid, coordinator.agents)
            agent = coordinator.agents[aid]
            self.assertEqual(agent.agent_type, atype)
            self.assertEqual(agent.connectivity, "CONNECTED")
            self.assertEqual(agent.status, "AVAILABLE")
            self.assertGreater(len(agent.capabilities), 0)

    def test_invalid_and_provisional_data_safeguards(self):
        activation = SwarmActivationEngine()
        invalid_assessments = [
            {"station_id": "ST_INV", "risk_level": "CRITICAL", "data_quality_status": "INVALID_OR_MISSING"}
        ]
        res_inv = activation.evaluate_activation(invalid_assessments)
        self.assertEqual(res_inv["current_state"], "NORMAL")
        self.assertEqual(res_inv["critical_stations"], 0)
        self.assertEqual(len(res_inv["missions"]), 0)

        provisional_assessments = [
            {"station_id": "ST_PROV", "risk_level": "CRITICAL", "data_quality_status": "VALID_OBSERVATION", "is_provisional": True}
        ]
        res_prov = activation.evaluate_activation(provisional_assessments)
        self.assertEqual(res_prov["current_state"], "WATCH")
        self.assertEqual(res_prov["critical_stations"], 0)
        self.assertEqual(res_prov["watch_stations"], 1)
        self.assertEqual(len(res_prov["missions"]), 1)
        self.assertEqual(res_prov["missions"][0]["priority"], 3)
        self.assertEqual(res_prov["missions"][0]["mission_type"], "PREVENTIVE_RECONNAISSANCE")

    def test_mission_lifecycle_progression(self):
        coordinator = SwarmCoordinator()
        mission = {
            "mission_id": "MSN-LC-1",
            "priority": 1,
            "target_position": (3, 3),
            "required_capabilities": ["AERIAL_OBSERVATION", "VERIFICATION"]
        }
        coordinator.add_mission(mission)
        self.assertEqual(coordinator.missions["MSN-LC-1"]["status"], "PENDING")

        allocs = coordinator.allocate_missions(strategy="adaptive")
        self.assertEqual(len(allocs), 1)
        self.assertEqual(coordinator.missions["MSN-LC-1"]["status"], "IN_PROGRESS")

        coordinator.simulate_agent_disconnect(allocs[0]["agent_id"])
        reassigned = coordinator.check_heartbeats_and_leases(timeout_sec=0)
        self.assertIn("MSN-LC-1", reassigned)
        self.assertEqual(coordinator.missions["MSN-LC-1"]["status"], "REASSIGNED")

        coordinator.missions["MSN-LC-1"]["status"] = "COMPLETED"
        snapshot = coordinator.get_swarm_snapshot()
        self.assertEqual(snapshot["completed_missions_count"], 1)

if __name__ == "__main__":
    unittest.main()
