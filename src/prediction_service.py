from pathlib import Path
import numpy as np
import pandas as pd
from src.predict import RiverDischargePredictor
from src.feature_engineering import build_features

class PredictionService:
    def __init__(self, predictor=None, processed_data_path="data/processed/train.csv"):
        self.predictor = predictor if predictor is not None else RiverDischargePredictor()
        self.processed_data_path = Path(processed_data_path)
        self._cached_train = None

    @property
    def model_a(self):
        return self.predictor.models.get("A")

    @property
    def model_b(self):
        return self.predictor.models.get("B")

    def _get_station_metadata(self):
        meta_path = Path("data/raw/usgs_streamflow_metadata.csv")
        if meta_path.is_file():
            return pd.read_csv(meta_path, dtype={"station_id": str})
        df_train = self._get_train_data()
        unique_st = sorted(df_train["station_id"].unique())
        return pd.DataFrame([{"station_id": s, "station_name": f"Station {s}"} for s in unique_st])

    def _get_train_data(self):
        if self._cached_train is None:
            if not self.processed_data_path.is_file():
                raise FileNotFoundError(f"Processed dataset not found: {self.processed_data_path}")
            self._cached_train = pd.read_csv(self.processed_data_path, dtype={"station_id": str})
        return self._cached_train

    def predict_station(self, station_id, start_date=None, end_date=None, config="A"):
        df_all = self._get_train_data()
        st_clean = str(station_id).strip()
        sub = df_all[df_all["station_id"].astype(str) == st_clean].copy()
        
        if sub.empty:
            return {
                "status": "error",
                "data": None,
                "error": f"Station '{st_clean}' not found in processed dataset."
            }

        sub["date"] = pd.to_datetime(sub["date"], errors="coerce")
        if start_date:
            sub = sub[sub["date"] >= pd.to_datetime(start_date)]
        if end_date:
            sub = sub[sub["date"] <= pd.to_datetime(end_date)]

        if sub.empty:
            return {
                "status": "error",
                "data": None,
                "error": f"No observation records found for station '{st_clean}' within specified date range."
            }

        sub = sub.sort_values("date").reset_index(drop=True)
        sub["date"] = sub["date"].dt.strftime("%Y-%m-%d")

        test_feed = sub.drop(columns=["discharge_cfs"], errors="ignore")
        X_tr, _, X_te, _, test_idents, _, quality_report = build_features(df_all, test_feed)

        pred_df = self.predictor.predict(X_te, test_idents, config=config)

        results = []
        for i, row in pred_df.iterrows():
            rec = {
                "station_id": str(row["station_id"]),
                "date": str(row["date"]),
                "predicted_discharge_cfs": float(row["discharge_cfs"])
            }
            if "discharge_cfs" in sub.columns:
                actual = sub.loc[i, "discharge_cfs"]
                rec["actual_discharge_cfs"] = float(actual) if pd.notna(actual) else None
                if rec["actual_discharge_cfs"] is not None:
                    rec["residual_error_cfs"] = round(rec["predicted_discharge_cfs"] - rec["actual_discharge_cfs"], 4)
            results.append(rec)

        return {
            "status": "success",
            "data": {
                "station_id": st_clean,
                "model_configuration": config.upper(),
                "discharge_units": "cfs (ft3/s)",
                "total_predictions": len(results),
                "data_quality_status": quality_report.get("status", "VALID"),
                "predictions": results
            },
            "error": null if False else None
        }

    def predict_custom(self, test_df, config="A"):
        if not isinstance(test_df, pd.DataFrame) or test_df.empty:
            return {
                "status": "error",
                "data": None,
                "error": "Input dataset is empty or invalid DataFrame."
            }

        req_cols = ["station_id", "date"]
        missing_req = [c for c in req_cols if c not in test_df.columns]
        if missing_req:
            return {
                "status": "error",
                "data": None,
                "error": f"Missing required identifier columns: {missing_req}"
            }

        train_ref = self._get_train_data()
        clean_test = test_df.copy()
        clean_test["station_id"] = clean_test["station_id"].astype(str)

        _, _, X_te, _, test_idents, _, quality_report = build_features(train_ref, clean_test)
        pred_df = self.predictor.predict(X_te, test_idents, config=config)

        results = []
        for i, row in pred_df.iterrows():
            rec = {
                "station_id": str(row["station_id"]),
                "date": str(row["date"]),
                "predicted_discharge_cfs": float(row["discharge_cfs"])
            }
            if "discharge_cfs" in clean_test.columns:
                actual = clean_test.iloc[i]["discharge_cfs"]
                rec["actual_discharge_cfs"] = float(actual) if pd.notna(actual) else None
            results.append(rec)

        return {
            "status": "success",
            "data": {
                "model_configuration": config.upper(),
                "discharge_units": "cfs (ft3/s)",
                "total_predictions": len(results),
                "data_quality_status": quality_report.get("status", "VALID"),
                "predictions": results
            },
            "error": None
        }

