import json
import os
import shutil
import tempfile
import unittest
import numpy as np
import pandas as pd

from src.data_inventory import (
    detect_discharge_column_and_units,
    audit_dataset_inventory,
    save_inventory_report
)

class TestDataInventory(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_detect_discharge_column_and_units(self):
        col, unit = detect_discharge_column_and_units(["date", "discharge_cfs", "precipitation_mm"])
        self.assertEqual(col, "discharge_cfs")
        self.assertEqual(unit, "cfs (ft3/s)")

        col_caravan, unit_caravan = detect_discharge_column_and_units(["date", "streamflow", "temp"])
        self.assertEqual(col_caravan, "streamflow")
        self.assertEqual(unit_caravan, "mm/day")

        col_india, unit_india = detect_discharge_column_and_units(["date", "discharge_cumec", "temp"])
        self.assertEqual(col_india, "discharge_cumec")
        self.assertEqual(unit_india, "m3/s (cumec)")

        col_none, unit_none = detect_discharge_column_and_units(["date", "temp_max"])
        self.assertIsNone(col_none)
        self.assertEqual(unit_none, "none")

    def test_audit_dataset_inventory_clean(self):
        dates = pd.date_range("2023-01-01", periods=10, freq="D")
        rows = []
        for st in ["STATION_A", "STATION_B"]:
            for d in dates:
                rows.append({
                    "station_id": st,
                    "date": d.strftime("%Y-%m-%d"),
                    "discharge_cfs": 100.0,
                    "precipitation_mm": 5.0,
                    "state": "VA" if st == "STATION_A" else "MD"
                })
        df = pd.DataFrame(rows)
        
        rep = audit_dataset_inventory(df, source_name="Clean_Synthetic_Test")
        self.assertEqual(rep["total_records"], 20)
        self.assertEqual(rep["catchment_station_count"], 2)
        self.assertEqual(rep["temporal_resolution"], "daily")
        self.assertEqual(rep["temporal_coverage"]["span_days"], 10)
        self.assertEqual(rep["discharge_audit"]["detected_units"], "cfs (ft3/s)")
        self.assertEqual(rep["discharge_audit"]["negative_count"], 0)
        self.assertEqual(rep["duplicate_records_count"], 0)
        self.assertEqual(rep["integrity_status"], "PASS")

    def test_audit_dataset_inventory_with_corruptions(self):
        df = pd.DataFrame({
            "station_id": ["ST1", "ST1", "ST1", "ST1"],
            "date": ["2023-01-01", "2023-01-01", "2023-01-02", "2023-01-03"],
            "discharge_cfs": [50.0, 50.0, -10.0, np.nan],
            "precipitation_mm": [0.0, 0.0, 10.0, 5.0]
        })
        rep = audit_dataset_inventory(df, source_name="Corrupted_Synthetic_Test")
        self.assertEqual(rep["total_records"], 4)
        self.assertEqual(rep["duplicate_records_count"], 1)
        self.assertEqual(rep["discharge_audit"]["negative_count"], 1)
        self.assertEqual(rep["discharge_audit"]["missing_count"], 1)
        self.assertEqual(rep["integrity_status"], "WARNING")

    def test_save_inventory_report(self):
        sample_dict = {"status": "TEST", "value": 123}
        out_path = os.path.join(self.temp_dir, "test_rep.json")
        saved_file = save_inventory_report(sample_dict, out_path)
        self.assertTrue(os.path.isfile(saved_file))
        with open(saved_file, "r", encoding="utf-8") as f:
            loaded = json.load(f)
        self.assertEqual(loaded["status"], "TEST")
        self.assertEqual(loaded["value"], 123)

    def test_existing_train_csv_inventory(self):
        train_path = "data/processed/train.csv"
        if os.path.isfile(train_path):
            rep = audit_dataset_inventory(train_path, source_name="USGS_Train")
            self.assertEqual(rep["total_records"], 16060)
            self.assertEqual(rep["catchment_station_count"], 22)
            self.assertEqual(rep["discharge_audit"]["detected_units"], "cfs (ft3/s)")
            self.assertEqual(rep["discharge_audit"]["negative_count"], 0)
            self.assertEqual(rep["duplicate_records_count"], 0)
            self.assertEqual(rep["integrity_status"], "PASS")

if __name__ == "__main__":
    unittest.main()
