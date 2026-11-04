import unittest
import numpy as np
import pandas as pd
from src.risk_engine import HydrologicalRiskEngine
from src.hydrological_evaluation import BasinshiftEvaluator, calculate_nse
from src.swarm_activation import SwarmActivationEngine
from src.swarm_simulator import AStarPlanner, SwarmCoordinator, run_coordination_comparison
from src.predict import RiverDischargePredictor

class MockModel:
    def predict(self, X):
        return np.ones(len(X)) * 500.0

class TestDeltaSwarm(unittest.TestCase):
    def test_risk_engine_thresholds(self):
        engine = HydrologicalRiskEngine()
        normal_res = engine.assess_station_risk("01570500", 500.0)
        self.assertEqual(normal_res["risk_level"], "NORMAL")
        
        crit_res = engine.assess_station_risk("01570500", 200000.0)
        self.assertEqual(crit_res["risk_level"], "CRITICAL")
        self.assertEqual(crit_res["recommended_action"], "HIGH_PRIORITY_RESPONSE_MISSIONS")

    def test_basinshift_evaluator(self):
        y_t = np.array([100.0, 200.0, 500.0, 1000.0, 2000.0])
        y_p = np.array([110.0, 190.0, 480.0, 950.0, 1900.0])
        nse = calculate_nse(y_t, y_p)
        self.assertGreater(nse, 0.9)

        mock = MockModel()
        evaluator = BasinshiftEvaluator(mock, ["f1", "f2"])
        skill = evaluator.evaluate_forecast_skill(y_t, y_p)
        self.assertIn("nse", skill)
        self.assertIn("mae_cfs", skill)

        val_df = pd.DataFrame({
            "station_id": ["S1", "S1", "S2", "S2"],
            "actual_discharge_cfs": [100.0, 200.0, 300.0, 400.0],
            "predicted_discharge_cfs": [105.0, 195.0, 290.0, 410.0]
        })
        gen = evaluator.evaluate_generalization(val_df)
        self.assertEqual(gen["unseen_catchments_count"], 2)

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

if __name__ == "__main__":
    unittest.main()
