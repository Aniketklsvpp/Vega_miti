import unittest
import numpy as np
import pandas as pd
from pathlib import Path
import tempfile
import shutil

from src.data_loader import load_csv, load_all_data
from src.data_validation import (
    check_schema,
    check_duplicates,
    check_missingness,
    check_value_ranges,
    calculate_extreme_event_stats,
    validate_dataset
)
from src.preprocessing import PreprocessingPipeline, separate_target_and_identifiers
from src.feature_engineering import build_features, add_lag_and_rolling_features

def create_synthetic_test_data():
    dates = pd.date_range("2023-01-01", periods=10, freq="D")
    records = []
    for st_idx, st in enumerate(["STATION_A", "STATION_B"]):
        for i, dt in enumerate(dates):
            records.append({
                "station_id": st,
                "date": dt,
                "precipitation_mm": float((i + 1) * (st_idx + 1)),
                "temp_max_c": 20.0 + i,
                "temp_min_c": 10.0 + i,
                "soil_moisture": 0.3 + (i * 0.01),
                "drainage_area_sqmi": 500.0 * (st_idx + 1),
                "mean_elevation_ft": 1000.0,
                "discharge_cfs": 100.0 + (i * 20.0) + (1000.0 if i == 9 else 0.0)
            })
    return pd.DataFrame(records)

class TestDataPipeline(unittest.TestCase):
    def setUp(self):
        self.synthetic_df = create_synthetic_test_data()
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_load_csv(self):
        csv_path = Path(self.temp_dir) / "test.csv"
        self.synthetic_df.to_csv(csv_path, index=False)
        loaded = load_csv(csv_path, parse_dates=["date"])
        self.assertEqual(len(loaded), len(self.synthetic_df))
        self.assertTrue(pd.api.types.is_datetime64_any_dtype(loaded["date"]))
        self.assertEqual(str(loaded["station_id"].iloc[0]), "STATION_A")

    def test_check_schema(self):
        res = check_schema(self.synthetic_df, ["station_id", "date", "discharge_cfs", "missing_col"])
        self.assertFalse(res["is_valid"])
        self.assertIn("missing_col", res["missing_columns"])

    def test_check_duplicates(self):
        dup_df = pd.concat([self.synthetic_df, self.synthetic_df.iloc[[0]]], ignore_index=True)
        res = check_duplicates(dup_df)
        self.assertTrue(res["has_duplicates"])
        self.assertEqual(res["duplicate_count"], 2)

    def test_check_value_ranges(self):
        corrupted = self.synthetic_df.copy()
        corrupted.loc[0, "discharge_cfs"] = -5.0
        corrupted.loc[1, "precipitation_mm"] = -1.0
        corrupted.loc[2, "soil_moisture"] = 1.5
        res = check_value_ranges(corrupted, is_train=True)
        self.assertTrue(any("negative discharge" in e for e in res["errors"]))
        self.assertTrue(any("negative precipitation" in w for w in res["warnings"]))
        self.assertTrue(any("soil moisture" in w for w in res["warnings"]))

    def test_extreme_event_stats(self):
        stats = calculate_extreme_event_stats(self.synthetic_df)
        self.assertIn("STATION_A", stats)
        self.assertIn("STATION_B", stats)
        self.assertEqual(stats["STATION_A"]["observation_count"], 10)
        self.assertGreater(stats["STATION_A"]["p90_cfs"], stats["STATION_A"]["median_cfs"])

    def test_station_isolated_lags_and_no_future_leakage(self):
        df = self.synthetic_df.copy()
        engineered = add_lag_and_rolling_features(df)
        st_b_row0 = engineered[engineered["station_id"] == "STATION_B"].iloc[0]
        self.assertTrue(pd.isna(st_b_row0["precip_lag_1"]))
        
        st_a = engineered[engineered["station_id"] == "STATION_A"].sort_values("date")
        self.assertEqual(st_a.iloc[1]["precip_lag_1"], st_a.iloc[0]["precipitation_mm"])
        self.assertEqual(st_a.iloc[2]["precip_roll_sum_3d"], st_a.iloc[0]["precipitation_mm"] + st_a.iloc[1]["precipitation_mm"])

    def test_build_features_interface_and_unseen_stations(self):
        train_df = self.synthetic_df[self.synthetic_df["station_id"] == "STATION_A"].copy()
        test_df = self.synthetic_df[self.synthetic_df["station_id"] == "STATION_B"].copy().drop(columns=["discharge_cfs"])
        
        X_train, y_train, X_test, train_ids, test_ids, feature_names, report = build_features(train_df, test_df)
        
        self.assertEqual(len(X_train), len(train_df))
        self.assertEqual(len(y_train), len(train_df))
        self.assertEqual(len(X_test), len(test_df))
        self.assertEqual(len(train_ids), len(train_df))
        self.assertEqual(len(test_ids), len(test_df))
        self.assertListEqual(list(X_train.columns), list(X_test.columns))
        self.assertListEqual(feature_names, list(X_train.columns))
        self.assertNotIn("discharge_cfs", X_train.columns)
        self.assertNotIn("discharge_cfs", X_test.columns)
        self.assertEqual(report["station_analysis"]["unseen_count"], 1)
        self.assertFalse(X_train.isna().any().any())
        self.assertFalse(X_test.isna().any().any())

    def test_row_order_preservation(self):
        shuffled_train = self.synthetic_df.sample(frac=1.0, random_state=42).reset_index(drop=True)
        X_train, y_train, _, train_ids, _, _, _ = build_features(shuffled_train)
        
        self.assertTrue((train_ids["station_id"].values == shuffled_train["station_id"].values).all())
        self.assertTrue((y_train.values == shuffled_train["discharge_cfs"].values).all())

if __name__ == "__main__":
    unittest.main()

