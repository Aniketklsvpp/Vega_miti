import os
import json
import unittest
import numpy as np
import pandas as pd
from src.metrics import calculate_metrics, identify_extreme_events
from src.validation import StationGroupValidator
from src.train import create_model, train_full, save_model, load_model
from src.predict import generate_predictions
from src.synthetic_fixture import generate_synthetic_data
from src.feature_adapter import default_feature_extractor

class TestMLEngine(unittest.TestCase):
    def test_metrics_calculation(self):
        y_true = np.array([10.0, 20.0, 30.0, 100.0, 200.0])
        y_pred = np.array([12.0, 18.0, 32.0, 95.0, 190.0])
        stations = np.array(["S1", "S1", "S1", "S1", "S1"])
        
        m = calculate_metrics(y_true, y_pred, stations)
        self.assertIn("overall_rmse", m)
        self.assertIn("extreme_rmse", m)
        self.assertIn("mae", m)
        self.assertIn("r2", m)
        self.assertIn("composite_score", m)
        self.assertGreater(m["n_extreme"], 0)
        self.assertTrue(np.isfinite(m["overall_rmse"]))

    def test_extreme_event_flagging(self):
        y_true = np.arange(100, dtype=float)
        stations = np.array(["S1"] * 50 + ["S2"] * 50)
        flags = identify_extreme_events(y_true, stations)
        self.assertEqual(len(flags), 100)
        self.assertGreater(np.sum(flags), 0)

    def test_group_validation_station_isolation(self):
        X = np.random.randn(40, 3)
        y = np.random.uniform(10, 100, size=40)
        identifiers = pd.DataFrame({
            "station_id": ["S1"] * 10 + ["S2"] * 10 + ["S3"] * 10 + ["S4"] * 10,
            "date": pd.date_range("2024-01-01", periods=40)
        })

        validator = StationGroupValidator(n_splits=4, random_state=42)
        res = validator.evaluate(lambda: create_model("hist_gb", transform_target=False), X, y, identifiers)
        
        self.assertEqual(res["station_count"], 4)
        self.assertEqual(len(res["fold_metrics"]), 4)
        for fold in res["fold_metrics"]:
            val_st = fold["val_stations"]
            self.assertEqual(len(val_st), 1)

    def test_target_transform_nonnegativity(self):
        model = create_model("hist_gb", transform_target=True, random_state=42)
        X = np.random.randn(30, 4)
        y = np.abs(np.random.randn(30) * 50)
        train_full(model, X, y)
        preds = model.predict(X)
        self.assertTrue(np.all(preds >= 0.0))
        self.assertTrue(np.all(np.isfinite(preds)))

    def test_end_to_end_prediction_generation(self):
        train_df, test_df = generate_synthetic_data(seed=42)
        X_train, y_train, X_test, train_idents, test_idents, feature_names, _ = default_feature_extractor(train_df, test_df)
        
        model = create_model("hist_gb", transform_target=True, random_state=42)
        train_full(model, X_train, y_train)
        
        out_csv = "outputs/test_preds.csv"
        df_out = generate_predictions(model, X_test, test_idents, output_path=out_csv)
        
        self.assertEqual(len(df_out), len(test_df))
        self.assertListEqual(list(df_out.columns), ["station_id", "date", "discharge_cfs"])
        self.assertTrue(np.all(df_out["discharge_cfs"] >= 0))
        self.assertTrue(os.path.exists(out_csv))
        os.remove(out_csv)

if __name__ == "__main__":
    unittest.main()

