import os
import joblib
import numpy as np
import pandas as pd
from src.train import TargetTransformedModel

CONFIG_A_PATH = "outputs/hist_gb_log1p_full.joblib"
CONFIG_B_PATH = "outputs/extra_trees_raw_past_only.joblib"

CONFIG_A_FEATURES = [
    "precipitation_mm", "temp_max_c", "temp_min_c", "soil_moisture",
    "drainage_area_sqmi", "mean_elevation_ft", "day_of_year", "month",
    "day_of_week", "season", "sin_day_of_year", "cos_day_of_year",
    "temp_range", "temp_avg", "log_drainage_area", "precip_lag_1",
    "precip_lag_2", "precip_lag_3", "precip_roll_sum_3d", "precip_roll_sum_7d",
    "precip_roll_sum_14d", "temp_avg_lag_1", "soil_moisture_lag_1",
    "soil_moisture_roll_mean_3d"
]

CONFIG_B_FEATURES = [
    c for c in CONFIG_A_FEATURES if c not in [
        "precipitation_mm", "temp_max_c", "temp_min_c",
        "temp_range", "temp_avg", "soil_moisture"
    ]
]

class RiverDischargePredictor:
    def __init__(self, config_a_path=CONFIG_A_PATH, config_b_path=CONFIG_B_PATH):
        self.config_a_path = config_a_path
        self.config_b_path = config_b_path
        self.models = {}
        self._load_models()

    def _load_models(self):
        if os.path.exists(self.config_a_path):
            art_a = joblib.load(self.config_a_path)
            self.models["A"] = art_a["model"] if isinstance(art_a, dict) and "model" in art_a else art_a
            self.models["primary"] = self.models["A"]
        if os.path.exists(self.config_b_path):
            art_b = joblib.load(self.config_b_path)
            self.models["B"] = art_b["model"] if isinstance(art_b, dict) and "model" in art_b else art_b
            self.models["past_only"] = self.models["B"]

    def get_required_features(self, config="A"):
        cfg_key = str(config).upper()
        if cfg_key in ("B", "PAST_ONLY", "PAST"):
            return list(CONFIG_B_FEATURES)
        return list(CONFIG_A_FEATURES)

    def predict(self, X, identifiers, config="A"):
        cfg_key = str(config).upper()
        model_key = "B" if cfg_key in ("B", "PAST_ONLY", "PAST") else "A"
        
        if model_key not in self.models:
            self._load_models()
        if model_key not in self.models:
            raise RuntimeError(f"Model artifact for configuration '{config}' not loaded.")
        
        model = self.models[model_key]
        req_features = self.get_required_features(config)
        
        if isinstance(X, pd.DataFrame):
            missing = [f for f in req_features if f not in X.columns]
            if missing:
                raise ValueError(f"Input features missing required columns: {missing}")
            X_mat = X[req_features].copy()
            if X_mat.isna().any().any():
                medians = X_mat.median()
                X_mat = X_mat.fillna(medians).fillna(0.0)
            X_arr = X_mat.values
        else:
            X_arr = np.asarray(X, dtype=float)
            if X_arr.shape[1] == 24 and len(req_features) == 18:
                indices = [CONFIG_A_FEATURES.index(c) for c in req_features]
                X_arr = X_arr[:, indices]
            elif X_arr.shape[1] != len(req_features):
                raise ValueError(f"Input feature array has {X_arr.shape[1]} columns, expected {len(req_features)}")
            nan_mask = ~np.isfinite(X_arr)
            if np.any(nan_mask):
                col_means = np.nanmean(X_arr, axis=0)
                col_means = np.where(np.isfinite(col_means), col_means, 0.0)
                inds = np.where(nan_mask)
                X_arr[inds] = np.take(col_means, inds[1])

        raw_preds = model.predict(X_arr)
        clean_preds = np.clip(raw_preds, a_min=0.0, a_max=None)
        clean_preds = np.where(np.isfinite(clean_preds), clean_preds, 0.0)

        ident_df = pd.DataFrame(identifiers).copy()
        station_col = "station_id" if "station_id" in ident_df.columns else ident_df.columns[0]
        date_col = "date" if "date" in ident_df.columns else (ident_df.columns[1] if len(ident_df.columns) > 1 else None)

        if len(clean_preds) != len(ident_df):
            raise ValueError(f"Mismatch between prediction count ({len(clean_preds)}) and identifier count ({len(ident_df)})")

        out_df = pd.DataFrame({
            "station_id": ident_df[station_col].values,
            "date": ident_df[date_col].values if date_col is not None else np.arange(len(clean_preds)),
            "discharge_cfs": np.round(clean_preds, 4)
        })
        return out_df

    def predict_to_csv(self, X, identifiers, output_path="predictions.csv", config="A"):
        out_df = self.predict(X, identifiers, config=config)
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        out_df.to_csv(output_path, index=False)
        return out_df

def generate_predictions(model_or_path, X_test, test_identifiers, output_path="predictions.csv"):
    if isinstance(model_or_path, str) and (model_or_path in ("A", "B", "primary", "past_only") or not os.path.exists(model_or_path)):
        predictor = RiverDischargePredictor()
        return predictor.predict_to_csv(X_test, test_identifiers, output_path=output_path, config=model_or_path)
    
    if isinstance(model_or_path, str):
        model = joblib.load(model_or_path)
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
