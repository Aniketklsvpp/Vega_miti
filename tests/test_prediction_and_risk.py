import unittest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from src.predict import RiverDischargePredictor
from src.prediction_service import PredictionService
from src.risk_engine import FloodRiskEngine
from src.hydrological_evaluation import (
    compute_forecast_metrics,
    compute_high_flow_detection_metrics,
    HydrologicalEvaluator
)
from src.backend.app import app

class TestPredictionAndRisk(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.predictor = RiverDischargePredictor()
        cls.risk_engine = FloodRiskEngine()
        cls.pred_service = PredictionService(predictor=cls.predictor)

    def test_predictor_config_a_and_b(self):
        idents = pd.DataFrame({
            "station_id": ["01570500", "01638500"],
            "date": ["2023-05-01", "2023-05-02"]
        })
        X_24 = np.random.uniform(10, 50, size=(2, 24))
        
        preds_a = self.predictor.predict(X_24, idents, config="A")
        self.assertEqual(len(preds_a), 2)
        self.assertListEqual(list(preds_a.columns), ["station_id", "date", "discharge_cfs"])
        self.assertTrue(np.all(preds_a["discharge_cfs"] >= 0.0))
        self.assertTrue(np.all(np.isfinite(preds_a["discharge_cfs"])))
        self.assertEqual(preds_a["station_id"].iloc[0], "01570500")

        preds_b = self.predictor.predict(X_24, idents, config="B")
        self.assertEqual(len(preds_b), 2)
        self.assertTrue(np.all(preds_b["discharge_cfs"] >= 0.0))

    def test_prediction_service_existing_station(self):
        res = self.pred_service.predict_station("01570500", start_date="2023-01-01", end_date="2023-01-10", config="A")
        self.assertEqual(res["status"], "success")
        self.assertIsNone(res["error"])
        self.assertEqual(res["data"]["station_id"], "01570500")
        self.assertEqual(res["data"]["total_predictions"], 10)
        self.assertIn("actual_discharge_cfs", res["data"]["predictions"][0])
        self.assertIn("residual_error_cfs", res["data"]["predictions"][0])

    def test_prediction_service_invalid_station(self):
        res = self.pred_service.predict_station("INVALID_9999")
        self.assertEqual(res["status"], "error")
        self.assertIn("not found", res["error"])

    def test_risk_classification_tiers(self):
        st = "01570500"
        thresh = self.risk_engine.get_thresholds_for_station(st)
        
        c_normal = self.risk_engine.classify_discharge(st, thresh["watch"] - 100.0)
        self.assertEqual(c_normal["risk_level"], "NORMAL")

        c_watch = self.risk_engine.classify_discharge(st, thresh["watch"] + 10.0)
        self.assertEqual(c_watch["risk_level"], "WATCH")

        c_warning = self.risk_engine.classify_discharge(st, thresh["warning"] + 10.0)
        self.assertEqual(c_warning["risk_level"], "WARNING")

        c_critical = self.risk_engine.classify_discharge(st, thresh["critical"] + 10.0)
        self.assertEqual(c_critical["risk_level"], "CRITICAL")
        self.assertFalse(c_critical["is_provisional"])

    def test_risk_transition_logic(self):
        t1 = self.risk_engine.detect_risk_transition("NORMAL", "WATCH")
        self.assertEqual(t1["transition"], "ESCALATION")
        self.assertEqual(t1["severity_delta"], 1)

        t2 = self.risk_engine.detect_risk_transition("WARNING", "WATCH")
        self.assertEqual(t2["transition"], "REDUCTION")
        self.assertEqual(t2["severity_delta"], -1)

        t3 = self.risk_engine.detect_risk_transition("CRITICAL", "CRITICAL")
        self.assertEqual(t3["transition"], "STEADY")

    def test_forecast_and_high_flow_metrics(self):
        y_true = np.array([100.0, 200.0, 300.0, 1000.0, 5000.0])
        y_pred = np.array([110.0, 190.0, 320.0, 950.0, 4800.0])
        
        fm = compute_forecast_metrics(y_true, y_pred)
        self.assertIn("mae", fm)
        self.assertIn("rmse", fm)
        self.assertIn("nse", fm)
        self.assertGreater(fm["nse"], 0.9)

        hfm = compute_high_flow_detection_metrics(y_true, y_pred, threshold_percentile=0.80)
        self.assertIn("precision", hfm)
        self.assertIn("recall", hfm)
        self.assertIn("f1_score", hfm)
        self.assertEqual(hfm["actual_event_count"], 1)

    def test_api_health(self):
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["data"]["status"], "HEALTHY")

    def test_api_stations(self):
        r = self.client.get("/api/stations")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["data"]["total_stations"], 22)
        st0 = body["data"]["stations"][0]
        self.assertIn("river_name", st0)
        self.assertIn("thresholds", st0)

    def test_api_predict_station(self):
        payload = {
            "station_id": "01570500",
            "start_date": "2023-01-01",
            "end_date": "2023-01-05",
            "config": "A"
        }
        r = self.client.post("/api/predict", json=payload)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["status"], "success")
        preds = body["data"]["predictions"]
        self.assertEqual(len(preds), 5)
        self.assertIn("risk_level", preds[0])
        self.assertIn("predicted_discharge_cfs", preds[0])

    def test_api_risk_station(self):
        r = self.client.get("/api/risk/01570500")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["data"]["station_id"], "01570500")
        self.assertIn(body["data"]["risk_level"], ["NORMAL", "WATCH", "WARNING", "CRITICAL"])

    def test_api_evaluation_hydrology(self):
        r = self.client.get("/api/evaluation/hydrology?config=A")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["status"], "success")
        self.assertIn("forecast_skill_pooled", body["data"])
        self.assertIn("model_comparison", body["data"])
        self.assertIn("robustness_stress_testing", body["data"])

    def test_end_to_end_flow_and_swarm_integration(self):
        pred_resp = self.client.post("/api/predict", json={
            "station_id": "01570500",
            "start_date": "2023-01-01",
            "end_date": "2023-01-02",
            "config": "A"
        })
        self.assertEqual(pred_resp.status_code, 200)
        pred_data = pred_resp.json()["data"]["predictions"]
        
        simulated_assessment = {
            "station_id": "01570500",
            "date": "2023-01-01",
            "discharge_cfs": 112000.0,
            "risk_level": "WARNING",
            "data_quality_status": "VALID_OBSERVATION"
        }
        
        act_resp = self.client.post("/api/swarm/activate", json={"assessments": [simulated_assessment]})
        self.assertEqual(act_resp.status_code, 200)
        act_body = act_resp.json()["data"]
        self.assertEqual(act_body["activation_state"], "WARNING")
        self.assertGreater(act_body["missions_generated"], 0)
        
        missions_resp = self.client.get("/api/swarm/missions")
        self.assertEqual(missions_resp.status_code, 200)
        missions = missions_resp.json()["data"]["missions"]
        self.assertGreater(len(missions), 0)
        
        for m in missions:
            if m.get("station_id") == "01570500":
                self.assertEqual(m["station_id"], "01570500")
                self.assertEqual(m["target_station_id"], "01570500")
                self.assertEqual(m["discharge_cfs"], 112000.0)
                self.assertEqual(m["risk_level"], "WARNING")
                self.assertEqual(m["data_quality_status"], "VALID_OBSERVATION")
                break

    def test_observed_vs_predicted_risk_discrepancy(self):
        r_obs = self.client.get("/api/risk/01570500?basis=observed")
        self.assertEqual(r_obs.status_code, 200)
        data_obs = r_obs.json()["data"]
        self.assertEqual(data_obs["assessment_basis"], "OBSERVED")
        self.assertIn("observed_risk_level", data_obs)
        self.assertIn("predicted_risk_level", data_obs)
        self.assertIn("risk_basis_discrepancy", data_obs)

        r_pred = self.client.get("/api/risk/01570500?basis=predicted")
        self.assertEqual(r_pred.status_code, 200)
        data_pred = r_pred.json()["data"]
        self.assertEqual(data_pred["assessment_basis"], "PREDICTED")
        self.assertIn("risk_basis_discrepancy", data_pred)

    def test_risk_threshold_exact_boundaries(self):
        st = "01570500"
        thresh = self.risk_engine.get_thresholds_for_station(st)
        
        below_watch = self.risk_engine.classify_discharge(st, thresh["watch"] - 0.01)
        self.assertEqual(below_watch["risk_level"], "NORMAL")
        
        exact_watch = self.risk_engine.classify_discharge(st, thresh["watch"])
        self.assertEqual(exact_watch["risk_level"], "WATCH")
        
        exact_warning = self.risk_engine.classify_discharge(st, thresh["warning"])
        self.assertEqual(exact_warning["risk_level"], "WARNING")
        
        exact_critical = self.risk_engine.classify_discharge(st, thresh["critical"])
        self.assertEqual(exact_critical["risk_level"], "CRITICAL")

    def test_missing_and_invalid_discharge_handling(self):
        st = "01570500"
        res_nan = self.risk_engine.classify_discharge(st, np.nan)
        self.assertEqual(res_nan["data_quality_status"], "INVALID_OR_MISSING")
        self.assertEqual(res_nan["evidence_quality"], "DEGRADED")
        self.assertEqual(res_nan["discharge_cfs"], 0.0)

        res_none = self.risk_engine.classify_discharge(st, None)
        self.assertEqual(res_none["data_quality_status"], "INVALID_OR_MISSING")
        self.assertEqual(res_none["evidence_quality"], "DEGRADED")

        r_bad = self.client.get("/api/risk/NONEXISTENT_STATION_9999")
        self.assertEqual(r_bad.status_code, 404)

    def test_provisional_labeling_and_disclaimer(self):
        st = "01570500"
        res = self.risk_engine.classify_discharge(st, 50000.0)
        self.assertEqual(res["threshold_type"], "EMPIRICAL_DEMONSTRATION")
        self.assertIn("regulatory_disclaimer", res)
        self.assertIn("NOT certified NWS/NOAA", res["regulatory_disclaimer"])
        self.assertFalse(res["is_provisional"])

        unknown = self.risk_engine.classify_discharge("UNSEEN_GAUGE", 50000.0)
        self.assertTrue(unknown["is_provisional"])
        self.assertIn("regulatory_disclaimer", unknown)

    def test_persistence_evaluation_metrics_and_reproducibility(self):
        evaluator = HydrologicalEvaluator()
        rep = evaluator.run_leakage_safe_evaluation(random_state=42, save_predictions_csv=None)
        self.assertEqual(rep["evaluation_type"], "LEAKAGE_SAFE_HELD_OUT_STATION_GENERALIZATION")
        self.assertEqual(rep["training_station_count"], 16)
        self.assertEqual(rep["held_out_stations_count"], 6)
        self.assertEqual(len(rep["leakage_safety_audit"]["train_test_station_intersection"]), 0)
        
        persist = rep["model_comparison"]["persistence_baseline_1day_lag"]["pooled_metrics"]
        cfg_a = rep["model_comparison"]["config_a_hist_gb_log1p_24features"]["pooled_metrics"]
        self.assertLess(persist["rmse"], cfg_a["rmse"])
        self.assertGreater(persist["nse"], cfg_a["nse"])

    def test_api_replay_endpoints_unified(self):
        events_resp = self.client.get("/api/swarm/replay/events")
        self.assertEqual(events_resp.status_code, 200)
        events_body = events_resp.json()
        self.assertEqual(events_body["status"], "success")
        self.assertGreaterEqual(len(events_body["data"]), 2)
        event_ids = [e["event_id"] for e in events_body["data"]]
        self.assertIn("EVENT-IN-YAMUNA-2023", event_ids)
        self.assertIn("EVENT-US-SUSQUEHANNA-2023", event_ids)

        run_resp = self.client.post("/api/swarm/replay/run", json={"event_id": "EVENT-IN-YAMUNA-2023", "step_index": 2})
        self.assertEqual(run_resp.status_code, 200)
        run_body = run_resp.json()
        self.assertEqual(run_body["status"], "success")
        self.assertEqual(run_body["data"]["river"], "Yamuna River (Upper Yamuna Basin)")
        self.assertEqual(len(run_body["data"]["timeline_frames"]), 3)

if __name__ == "__main__":
    unittest.main()

