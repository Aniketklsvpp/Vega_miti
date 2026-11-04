import os
import time
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score, average_precision_score
from src.predict import RiverDischargePredictor
from src.feature_engineering import build_features

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
        preds_df = self.predictor.predict(X_test, test_idents, config=config)
        inference_time = time.time() - t0
        
        y_true = test_subset["discharge_cfs"].values
        y_pred = preds_df["discharge_cfs"].values
        
        main_metrics = compute_forecast_metrics(y_true, y_pred)
        
        mean_baseline_pred = np.full_like(y_true, fill_value=float(np.mean(train_subset["discharge_cfs"])))
        mean_baseline_metrics = compute_forecast_metrics(y_true, mean_baseline_pred)
        
        test_sorted = test_subset.sort_values(["station_id", "date"]).copy()
        persistence_preds = test_sorted.groupby("station_id")["discharge_cfs"].shift(1)
        persistence_valid_mask = persistence_preds.notna()
        
        y_true_pers = test_sorted.loc[persistence_valid_mask, "discharge_cfs"].values
        y_pred_pers = persistence_preds.dropna().values
        persistence_metrics = compute_forecast_metrics(y_true_pers, y_pred_pers)
        
        high_flow_metrics = compute_high_flow_detection_metrics(y_true, y_pred, threshold_percentile=0.90)
        
        station_metrics = {}
        for st in test_stations:
            idx = (test_idents["station_id"].values == st)
            if np.sum(idx) > 0:
                station_metrics[st] = compute_forecast_metrics(y_true[idx], y_pred[idx])
                
        macro_mae = float(np.mean([m["mae"] for m in station_metrics.values()]))
        macro_rmse = float(np.mean([m["rmse"] for m in station_metrics.values()]))
        macro_nse = float(np.mean([m["nse"] for m in station_metrics.values()]))
        
        X_test_noisy = X_test.copy()
        for col in X_test_noisy.select_dtypes(include=[np.number]).columns:
            std_val = float(X_test_noisy[col].std())
            if std_val > 0:
                noise = np.random.normal(0, 0.2 * std_val, size=len(X_test_noisy))
                X_test_noisy[col] = X_test_noisy[col] + noise
                
        preds_noisy = self.predictor.predict(X_test_noisy, test_idents, config=config)["discharge_cfs"].values
        noisy_metrics = compute_forecast_metrics(y_true, preds_noisy)
        noise_degradation_pct = round(((noisy_metrics["rmse"] - main_metrics["rmse"]) / max(1e-6, main_metrics["rmse"])) * 100.0, 2)
        
        X_test_missing = X_test.copy()
        weather_cols = [c for c in ["precipitation_mm", "temp_max_c", "temp_min_c", "soil_moisture"] if c in X_test_missing.columns]
        for c in weather_cols:
            mask = np.random.rand(len(X_test_missing)) < 0.25
            X_test_missing.loc[mask, c] = 0.0
            
        preds_missing = self.predictor.predict(X_test_missing, test_idents, config=config)["discharge_cfs"].values
        missing_metrics = compute_forecast_metrics(y_true, preds_missing)
        missing_degradation_pct = round(((missing_metrics["rmse"] - main_metrics["rmse"]) / max(1e-6, main_metrics["rmse"])) * 100.0, 2)
        
        artifact_path = self.predictor.model_a_path if config.upper() == "A" else self.predictor.model_b_path
        artifact_size = os.path.getsize(artifact_path) if os.path.exists(artifact_path) else 0
        latency_per_1k = round((inference_time / max(1, len(y_true))) * 1000 * 1000, 2)
        
        report = {
            "evaluation_title": "DELTA-SWARM Hydrological Evaluation Report",
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
    
    md_content = f"""# DELTA-SWARM — Hydrological Evaluation Summary

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
