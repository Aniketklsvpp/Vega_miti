import os
import unittest
import numpy as np
import pandas as pd
from src.predict import RiverDischargePredictor, CONFIG_A_FEATURES, CONFIG_B_FEATURES
from src.feature_engineering import build_features

class TestModelInference(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.predictor = RiverDischargePredictor()
        raw_path = "data/processed/train.csv"
        if os.path.exists(raw_path):
            df = pd.read_csv(raw_path)
            test_mask = df["station_id"].astype(str) == "12119000"
            unseen_df = df[test_mask].copy().drop(columns=["discharge_cfs"], errors="ignore")
            train_df = df[~test_mask].copy()
            _, _, cls.X_unseen, _, cls.test_idents, cls.f_names, _ = build_features(train_df, unseen_df)
            cls.X_unseen_df = pd.DataFrame(cls.X_unseen, columns=cls.f_names)
        else:
            dates = pd.date_range("2024-01-01", periods=10)
            cls.test_idents = pd.DataFrame({"station_id": ["UNSEEN_01"] * 10, "date": dates})
            cls.X_unseen_df = pd.DataFrame({f: np.random.uniform(1, 10, 10) for f in CONFIG_A_FEATURES})

    def test_artifacts_loaded(self):
        self.assertIn("A", self.predictor.models)
        self.assertIn("B", self.predictor.models)

    def test_config_a_prediction(self):
        preds = self.predictor.predict(self.X_unseen_df, self.test_idents, config="A")
        self.assertEqual(len(preds), len(self.test_idents))
        self.assertListEqual(list(preds.columns), ["station_id", "date", "discharge_cfs"])
        self.assertTrue(np.all(preds["discharge_cfs"] >= 0.0))
        self.assertTrue(np.all(np.isfinite(preds["discharge_cfs"])))

    def test_config_b_prediction(self):
        preds = self.predictor.predict(self.X_unseen_df, self.test_idents, config="B")
        self.assertEqual(len(preds), len(self.test_idents))
        self.assertListEqual(list(preds.columns), ["station_id", "date", "discharge_cfs"])
        self.assertTrue(np.all(preds["discharge_cfs"] >= 0.0))
        self.assertTrue(np.all(np.isfinite(preds["discharge_cfs"])))

    def test_missing_feature_validation(self):
        corrupted = self.X_unseen_df.drop(columns=["precipitation_mm"])
        with self.assertRaises(ValueError):
            self.predictor.predict(corrupted, self.test_idents, config="A")

    def test_nan_imputation_and_finiteness(self):
        corrupted = self.X_unseen_df.copy()
        corrupted.iloc[0, 0] = np.nan
        corrupted.iloc[1, 1] = np.nan
        preds = self.predictor.predict(corrupted, self.test_idents, config="A")
        self.assertEqual(len(preds), len(self.test_idents))
        self.assertTrue(np.all(np.isfinite(preds["discharge_cfs"])))
        self.assertTrue(np.all(preds["discharge_cfs"] >= 0.0))

    def test_row_ordering_preservation(self):
        dates = self.test_idents["date"].values
        preds = self.predictor.predict(self.X_unseen_df, self.test_idents, config="A")
        np.testing.assert_array_equal(preds["date"].values, dates)

if __name__ == "__main__":
    unittest.main()
