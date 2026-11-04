import os
import time
import json
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, precision_recall_fscore_support

def calculate_nse(y_true, y_pred):
    denom = np.sum((y_true - np.mean(y_true)) ** 2)
    if denom < 1e-9:
        return 0.0
    num = np.sum((y_true - y_pred) ** 2)
    return float(1.0 - (num / denom))

class BasinshiftEvaluator:
    def __init__(self, model, feature_names):
        self.model = model
        self.feature_names = feature_names

    def evaluate_forecast_skill(self, y_true, y_pred):
        y_true = np.asarray(y_true, dtype=float)
        y_pred = np.asarray(y_pred, dtype=float)
        mae = float(mean_absolute_error(y_true, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        mean_obs = float(np.mean(y_true))
        norm_mae = float(mae / mean_obs) if mean_obs > 1e-6 else 0.0
        nse = calculate_nse(y_true, y_pred)
        return {
            "mae_cfs": round(mae, 2),
            "rmse_cfs": round(rmse, 2),
            "normalized_mae": round(norm_mae, 4),
            "nse": round(nse, 4)
        }

    def evaluate_high_flow_detection(self, y_true, y_pred, threshold_percentile=90.0):
        y_true = np.asarray(y_true, dtype=float)
        y_pred = np.asarray(y_pred, dtype=float)
        th_true = np.percentile(y_true, threshold_percentile)
        th_pred = np.percentile(y_pred, threshold_percentile)
        
        true_events = (y_true >= th_true).astype(int)
        pred_events = (y_pred >= th_pred).astype(int)

        prec, rec, f1, _ = precision_recall_fscore_support(true_events, pred_events, average="binary", zero_division=0)
        false_alarms = int(np.sum((pred_events == 1) & (true_events == 0)))
        total_non_events = int(np.sum(true_events == 0))
        far = float(false_alarms / total_non_events) if total_non_events > 0 else 0.0

        return {
            "threshold_cfs": round(float(th_true), 2),
            "event_precision": round(float(prec), 4),
            "event_recall": round(float(rec), 4),
            "event_f1_score": round(float(f1), 4),
            "false_alarm_rate": round(far, 4),
            "total_extreme_events": int(np.sum(true_events))
        }

    def evaluate_generalization(self, val_df):
        per_station = {}
        nse_list = []
        rmse_list = []
        
        for st in val_df["station_id"].unique():
            sub = val_df[val_df["station_id"] == st]
            y_t = sub["actual_discharge_cfs"].values
            y_p = sub["predicted_discharge_cfs"].values
            st_rmse = float(np.sqrt(mean_squared_error(y_t, y_p)))
            st_nse = calculate_nse(y_t, y_p)
            per_station[str(st)] = {"rmse": round(st_rmse, 2), "nse": round(st_nse, 4)}
            nse_list.append(st_nse)
            rmse_list.append(st_rmse)

        pooled_rmse = float(np.sqrt(mean_squared_error(val_df["actual_discharge_cfs"], val_df["predicted_discharge_cfs"])))
        pooled_nse = calculate_nse(val_df["actual_discharge_cfs"].values, val_df["predicted_discharge_cfs"].values)

        return {
            "unseen_catchments_count": len(per_station),
            "macro_average_nse": round(float(np.mean(nse_list)), 4),
            "macro_average_rmse_cfs": round(float(np.mean(rmse_list)), 2),
            "pooled_rmse_cfs": round(pooled_rmse, 2),
            "pooled_nse": round(pooled_nse, 4),
            "per_catchment": per_station
        }

    def evaluate_robustness(self, X_df, y_true):
        y_true = np.asarray(y_true, dtype=float)
        base_preds = self.model.predict(X_df.values)
        base_rmse = float(np.sqrt(mean_squared_error(y_true, base_preds)))

        X_noise = X_df.copy()
        for col in ["precipitation_mm", "precip_lag_1", "precip_roll_sum_3d"]:
            if col in X_noise.columns:
                noise = np.random.normal(0, 0.20 * (X_noise[col].std() + 1e-4), size=len(X_noise))
                X_noise[col] = np.clip(X_noise[col] + noise, a_min=0.0, a_max=None)
        preds_noise = self.model.predict(X_noise.values)
        rmse_noise = float(np.sqrt(mean_squared_error(y_true, preds_noise)))

        X_missing = X_df.copy()
        if "precipitation_mm" in X_missing.columns:
            mask = np.random.rand(len(X_missing)) < 0.20
            X_missing.loc[mask, "precipitation_mm"] = 0.0
        preds_missing = self.model.predict(X_missing.values)
        rmse_missing = float(np.sqrt(mean_squared_error(y_true, preds_missing)))

        X_delayed = X_df.copy()
        if "precip_lag_1" in X_delayed.columns and "precip_lag_2" in X_delayed.columns:
            X_delayed["precip_lag_1"] = X_delayed["precip_lag_2"]
        preds_delayed = self.model.predict(X_delayed.values)
        rmse_delayed = float(np.sqrt(mean_squared_error(y_true, preds_delayed)))

        return {
            "baseline_rmse_cfs": round(base_rmse, 2),
            "noisy_inputs_rmse_cfs": round(rmse_noise, 2),
            "noise_degradation_pct": round(((rmse_noise - base_rmse) / base_rmse) * 100.0, 2),
            "missing_inputs_rmse_cfs": round(rmse_missing, 2),
            "missing_degradation_pct": round(((rmse_missing - base_rmse) / base_rmse) * 100.0, 2),
            "delayed_inputs_rmse_cfs": round(rmse_delayed, 2),
            "delay_degradation_pct": round(((rmse_delayed - base_rmse) / base_rmse) * 100.0, 2)
        }

    def evaluate_efficiency(self, X_df, artifact_path=None):
        n_samples = len(X_df)
        t0 = time.time()
        for _ in range(5):
            self.model.predict(X_df.values)
        elapsed = (time.time() - t0) / 5.0
        latency_us_per_sample = (elapsed / n_samples) * 1e6

        artifact_size_kb = 0.0
        if artifact_path and os.path.exists(artifact_path):
            artifact_size_kb = round(os.path.getsize(artifact_path) / 1024.0, 2)

        return {
            "total_benchmark_samples": n_samples,
            "inference_latency_us_per_sample": round(latency_us_per_sample, 2),
            "throughput_samples_per_sec": round(n_samples / elapsed, 1),
            "artifact_size_kb": artifact_size_kb
        }

    def generate_full_report(self, X_df, y_true, val_df, artifact_path=None):
        y_pred = self.model.predict(X_df.values)
        return {
            "framework": "BASINSHIFT_GLOBAL_FLOOD_INTELLIGENCE",
            "forecast_skill": self.evaluate_forecast_skill(y_true, y_pred),
            "high_flow_detection": self.evaluate_high_flow_detection(y_true, y_pred),
            "generalization": self.evaluate_generalization(val_df),
            "robustness": self.evaluate_robustness(X_df, y_true),
            "efficiency": self.evaluate_efficiency(X_df, artifact_path=artifact_path),
            "unsupported_metrics_disclosure": [
                "CRPS and Brier score currently unsupported without ensemble/probabilistic dispersion head",
                "Evacuation routing validation unsupported"
            ]
        }

