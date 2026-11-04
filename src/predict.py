import os
import joblib
import numpy as np
import pandas as pd
from src.train import load_model

class RiverDischargePredictor:
    def __init__(self, model_a_path="outputs/hist_gb_log1p_full.joblib", model_b_path="outputs/extra_trees_raw_past_only.joblib"):
        self.model_a_path = model_a_path
        self.model_b_path = model_b_path
        self._models = {}
        self.past_only_features = [
            "drainage_area_sqmi", "mean_elevation_ft", "day_of_year", "month",
            "day_of_week", "season", "sin_day_of_year", "cos_day_of_year",
            "log_drainage_area", "precip_lag_1", "precip_lag_2", "precip_lag_3",
            "precip_roll_sum_3d", "precip_roll_sum_7d", "precip_roll_sum_14d",
            "temp_avg_lag_1", "soil_moisture_lag_1", "soil_moisture_roll_mean_3d"
        ]

    def _get_model(self, config="A"):
        cfg = config.upper()
        if cfg not in self._models:
            path = self.model_a_path if cfg == "A" else self.model_b_path
            if not os.path.exists(path):
                raise FileNotFoundError(f"Model artifact not found for Config {cfg}: {path}")
            artifact = joblib.load(path)
            self._models[cfg] = artifact["model"] if isinstance(artifact, dict) and "model" in artifact else artifact
        return self._models[cfg]

    def predict(self, X_test, test_identifiers, config="A"):
        cfg = config.upper()
        model = self._get_model(cfg)

        if isinstance(X_test, pd.DataFrame):
            if cfg == "B":
                avail = [c for c in self.past_only_features if c in X_test.columns]
                if len(avail) == len(self.past_only_features):
                    X_mat = X_test[self.past_only_features].values
                else:
                    X_mat = X_test.values
            else:
                X_mat = X_test.values
        else:
            X_mat = np.asarray(X_test)
            if cfg == "B" and X_mat.shape[1] == 24:
                full_features = [
                    "precipitation_mm", "temp_max_c", "temp_min_c", "soil_moisture",
                    "drainage_area_sqmi", "mean_elevation_ft", "day_of_year", "month",
                    "day_of_week", "season", "sin_day_of_year", "cos_day_of_year",
                    "temp_range", "temp_avg", "log_drainage_area", "precip_lag_1",
                    "precip_lag_2", "precip_lag_3", "precip_roll_sum_3d",
                    "precip_roll_sum_7d", "precip_roll_sum_14d", "temp_avg_lag_1",
                    "soil_moisture_lag_1", "soil_moisture_roll_mean_3d"
                ]
                indices = [full_features.index(c) for c in self.past_only_features]
                X_mat = X_mat[:, indices]

        raw_preds = model.predict(X_mat)
        clean_preds = np.clip(raw_preds, a_min=0.0, a_max=None)
        clean_preds = np.where(np.isfinite(clean_preds), clean_preds, 0.0)

        ident_df = pd.DataFrame(test_identifiers).copy()
        station_col = "station_id" if "station_id" in ident_df.columns else ident_df.columns[0]
        date_col = "date" if "date" in ident_df.columns else (ident_df.columns[1] if len(ident_df.columns) > 1 else None)

        if len(clean_preds) != len(ident_df):
            raise ValueError(f"Mismatch between prediction count ({len(clean_preds)}) and test row count ({len(ident_df)})")

        out_df = pd.DataFrame({
            "station_id": ident_df[station_col].values,
            "date": ident_df[date_col].values if date_col is not None else np.arange(len(clean_preds)),
            "discharge_cfs": np.round(clean_preds, 4)
        })
        return out_df

def generate_predictions(model_or_path, X_test, test_identifiers, output_path="predictions.csv"):
    if isinstance(model_or_path, str):
        model = load_model(model_or_path)
    else:
        model = model_or_path

    X_mat = np.asarray(X_test)
    raw_preds = model.predict(X_mat)
    
    clean_preds = np.clip(raw_preds, a_min=0.0, a_max=None)
    clean_preds = np.where(np.isfinite(clean_preds), clean_preds, 0.0)

    ident_df = pd.DataFrame(test_identifiers).copy()
    station_col = "station_id" if "station_id" in ident_df.columns else ident_df.columns[0]
    date_col = "date" if "date" in ident_df.columns else (ident_df.columns[1] if len(ident_df.columns) > 1 else None)

    if len(clean_preds) != len(ident_df):
        raise ValueError(f"Mismatch between prediction count ({len(clean_preds)}) and test row count ({len(ident_df)})")

    out_df = pd.DataFrame({
        "station_id": ident_df[station_col].values,
        "date": ident_df[date_col].values if date_col is not None else np.arange(len(clean_preds)),
        "discharge_cfs": np.round(clean_preds, 4)
    })

    if output_path is not None:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        out_df.to_csv(output_path, index=False)

    return out_df
