import os
import time
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    average_precision_score,
    mean_absolute_error,
    mean_squared_error,
    precision_recall_fscore_support
)
from src.predict import RiverDischargePredictor
from src.feature_engineering import build_features

def calculate_nse(y_true, y_pred):
    yt = np.asarray(y_true, dtype=float)
    yp = np.asarray(y_pred, dtype=float)
    denom = np.sum((yt - np.mean(yt)) ** 2)
    if denom < 1e-9:
        return 0.0
    num = np.sum((yt - yp) ** 2)
    return float(1.0 - (num / denom))

def compute_forecast_metrics(y_true, y_pred):
    yt = np.asarray(y_true, dtype=float)
    yp = np.asarray(y_pred, dtype=float)
    
    diff = yp - yt
    mae = float(np.mean(np.abs(diff)))
    rmse = float(np.sqrt(np.mean(diff ** 2)))
    
    y_mean = float(np.mean(yt))
    y_range = float(np.max(yt) - np.min(yt)) if len(yt) > 0 else 1.0
    
    nmae_mean = float(mae / max(1e-6, y_mean))
    nmae_range = float(mae / max(1e-6, y_range))
    
    denom = np.sum((yt - y_mean) ** 2)
    num = np.sum(diff ** 2)
    nse = float(1.0 - (num / denom)) if denom > 1e-6 else -999.0
    
    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "nmae_normalized_by_mean": round(nmae_mean, 4),
        "nmae_normalized_by_range": round(nmae_range, 4),
        "nse": round(nse, 4)
    }

def compute_high_flow_detection_metrics(y_true, y_pred, threshold_percentile=0.90):
    yt = np.asarray(y_true, dtype=float)
    yp = np.asarray(y_pred, dtype=float)
    
    q_thresh = float(np.quantile(yt, threshold_percentile))
    
    actual_events = (yt >= q_thresh).astype(int)
    pred_events = (yp >= q_thresh).astype(int)
    
    p = float(precision_score(actual_events, pred_events, zero_division=0))
    r = float(recall_score(actual_events, pred_events, zero_division=0))
    f1 = float(f1_score(actual_events, pred_events, zero_division=0))
    
    try:
        auprc = float(average_precision_score(actual_events, yp))
    except Exception:
        auprc = p
        
    return {
        "threshold_percentile": threshold_percentile,
        "threshold_value_cfs": round(q_thresh, 2),
        "precision": round(p, 4),
        "recall": round(r, 4),
        "f1_score": round(f1, 4),
        "auprc": round(auprc, 4),
        "actual_event_count": int(np.sum(actual_events)),
        "predicted_event_count": int(np.sum(pred_events)),
        "total_observations": len(yt)
    }

class HydrologicalEvaluator:
    def __init__(self, data_path="data/processed/train.csv"):
        self.data_path = Path(data_path)
        self.predictor = RiverDischargePredictor()

    def run_full_evaluation(self, config="A"):
        df = pd.read_csv(self.data_path, dtype={"station_id": str})
        unique_stations = sorted(df["station_id"].unique())
        
        split_idx = int(len(unique_stations) * 0.75)
        train_stations = unique_stations[:split_idx]
        test_stations = unique_stations[split_idx:]
        
        train_subset = df[df["station_id"].isin(train_stations)].copy()
        test_subset = df[df["station_id"].isin(test_stations)].copy()
        
        _, _, X_test, _, test_idents, feature_names, _ = build_features(train_subset, test_subset)
        
        t0 = time.time()
        y_pred = self.predictor.predict(X_test, config=config)
        inference_time = time.time() - t0
        
        y_true = test_subset["discharge_cfs"].values
        
        main_metrics = compute_forecast_metrics(y_true, y_pred)
        high_flow_metrics = compute_high_flow_detection_metrics(y_true, y_pred, threshold_percentile=0.90)
        
        train_mean_val = float(train_subset["discharge_cfs"].mean())
        mean_preds = np.full_like(y_true, fill_value=train_mean_val)
        mean_baseline_metrics = compute_forecast_metrics(y_true, mean_preds)
        
        test_subset_sorted = test_subset.sort_values(["station_id", "date"]).copy()
        test_subset_sorted["persistence_pred"] = test_subset_sorted.groupby("station_id")["discharge_cfs"].shift(1)
        test_subset_sorted["persistence_pred"] = test_subset_sorted["persistence_pred"].bfill().fillna(train_mean_val)
        persistence_metrics = compute_forecast_metrics(
            test_subset_sorted["discharge_cfs"].values,
            test_subset_sorted["persistence_pred"].values
        )
        
        station_metrics = {}
        for st_id in test_stations:
            st_mask = (test_idents["station_id"] == st_id).values
            if np.sum(st_mask) > 0:
                station_metrics[st_id] = compute_forecast_metrics(y_true[st_mask], y_pred[st_mask])
                
        macro_mae = float(np.mean([m["mae"] for m in station_metrics.values()]))
        macro_rmse = float(np.mean([m["rmse"] for m in station_metrics.values()]))
        macro_nse = float(np.mean([m["nse"] for m in station_metrics.values()]))
        
        X_mat = np.asarray(X_test, dtype=float)
        noise = np.random.normal(0, 0.20 * np.std(X_mat, axis=0, keepdims=True), size=X_mat.shape)
        X_noisy = X_mat + noise
        y_pred_noisy = self.predictor.predict(X_noisy, config=config)
        noisy_metrics = compute_forecast_metrics(y_true, y_pred_noisy)
        noise_degradation_pct = round(((noisy_metrics["rmse"] - main_metrics["rmse"]) / max(1e-6, main_metrics["rmse"])) * 100.0, 2)
        
        weather_idx = [i for i, name in enumerate(feature_names) if any(w in name for w in ["precip", "temp", "soil"])]
        X_missing = X_mat.copy()
        if weather_idx:
            missing_mask = np.random.rand(*X_mat.shape) < 0.25
            for idx in weather_idx:
                X_missing[missing_mask[:, idx], idx] = 0.0
                
        y_pred_missing = self.predictor.predict(X_missing, config=config)
        missing_metrics = compute_forecast_metrics(y_true, y_pred_missing)
        missing_degradation_pct = round(((missing_metrics["rmse"] - main_metrics["rmse"]) / max(1e-6, main_metrics["rmse"])) * 100.0, 2)
        
        latency_per_1k = round((inference_time / max(1, len(X_test))) * 1000.0 * 1000.0, 2)
        artifact_path = Path("outputs/hist_gb_log1p_full.joblib") if config.upper() == "A" else Path("outputs/extra_trees_raw_past_only.joblib")
        artifact_size = artifact_path.stat().st_size if artifact_path.is_file() else 0
        
        report = {
            "evaluation_title": "VEGA-MITI Hydrological Evaluation Report",
            "model_configuration": config.upper(),
            "target_variable": "discharge_cfs",
            "evaluation_sample_count": len(y_true),
            "held_out_stations_count": len(test_stations),
            "held_out_stations": test_stations,
            "forecast_skill_pooled": main_metrics,
            "forecast_skill_macro_station_average": {
                "macro_mae": round(macro_mae, 4),
                "macro_rmse": round(macro_rmse, 4),
                "macro_nse": round(macro_nse, 4)
            },
            "baseline_comparisons": {
                "training_mean_baseline": mean_baseline_metrics,
                "persistence_baseline": persistence_metrics,
                "rmse_skill_score_vs_mean": round(1.0 - (main_metrics["rmse"] / max(1e-6, mean_baseline_metrics["rmse"])), 4),
                "rmse_skill_score_vs_persistence": round(1.0 - (main_metrics["rmse"] / max(1e-6, persistence_metrics["rmse"])), 4)
            },
            "high_flow_event_detection": high_flow_metrics,
            "per_station_generalization": station_metrics,
            "robustness_stress_testing": {
                "gaussian_noise_injection_degradation_pct": noise_degradation_pct,
                "noisy_inputs_rmse": noisy_metrics["rmse"],
                "missing_weather_degradation_pct": missing_degradation_pct,
                "missing_inputs_rmse": missing_metrics["rmse"]
            },
            "computational_efficiency": {
                "total_inference_time_sec": round(inference_time, 4),
                "latency_ms_per_1000_samples": latency_per_1k,
                "model_artifact_size_bytes": artifact_size
            }
        }
        
        return report

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

def export_evaluation_report(report, out_dir="outputs/data_reports"):
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    json_path = out_path / "hydrological_evaluation_report.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        
    md_path = out_path / "hydrological_evaluation_summary.md"
    m = report["forecast_skill_pooled"]
    hf = report["high_flow_event_detection"]
    b = report["baseline_comparisons"]
    rob = report["robustness_stress_testing"]
    eff = report["computational_efficiency"]
    
    md_content = f"""# VEGA-MITI — Hydrological Evaluation Summary

**Model Configuration:** {report['model_configuration']}  
**Evaluation Samples:** {report['evaluation_sample_count']} across {report['held_out_stations_count']} held-out stations  
**Held-out Stations:** {', '.join(report['held_out_stations'])}

## 1. Forecast Skill (Held-Out Stations)
- **RMSE:** {m['rmse']:,.2f} cfs
- **MAE:** {m['mae']:,.2f} cfs
- **Normalized MAE (Mean):** {m['nmae_normalized_by_mean']:.4f}
- **Nash-Sutcliffe Efficiency (NSE):** {m['nse']:.4f}
- **Macro Station-Average RMSE:** {report['forecast_skill_macro_station_average']['macro_rmse']:,.2f} cfs

## 2. Baseline Comparison
- **Mean Baseline RMSE:** {b['training_mean_baseline']['rmse']:,.2f} cfs (Skill score: {b['rmse_skill_score_vs_mean']:.4f})
- **Persistence Baseline RMSE:** {b['persistence_baseline']['rmse']:,.2f} cfs (Skill score: {b['rmse_skill_score_vs_persistence']:.4f})

## 3. High-Flow Event Detection (90th Percentile)
- **Threshold Value:** {hf['threshold_value_cfs']:,.1f} cfs
- **Precision:** {hf['precision']:.4f}
- **Recall:** {hf['recall']:.4f}
- **F1-Score:** {hf['f1_score']:.4f}
- **AUPRC:** {hf['auprc']:.4f}
- **Events Detected:** {hf['predicted_event_count']} predicted / {hf['actual_event_count']} actual

## 4. Robustness Stress Testing
- **Gaussian Noise Degradation:** {rob['gaussian_noise_injection_degradation_pct']}% (RMSE: {rob['noisy_inputs_rmse']:,.2f} cfs)
- **25% Missing Weather Degradation:** {rob['missing_weather_degradation_pct']}% (RMSE: {rob['missing_inputs_rmse']:,.2f} cfs)

## 5. Computational Efficiency
- **Latency:** {eff['latency_ms_per_1000_samples']} ms per 1,000 samples
- **Model Size:** {eff['model_artifact_size_bytes'] / 1024:.1f} KB
"""
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
        
    return str(json_path), str(md_path)
