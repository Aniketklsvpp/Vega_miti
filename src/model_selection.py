import os
import time
import json
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from src.train import create_model, train_full, save_model
from src.validation import StationGroupValidator

class ModelComparisonEngine:
    def __init__(self, random_state=42):
        self.random_state = random_state
        self.validator = StationGroupValidator(n_splits=5, random_state=random_state)

    def run_comparison(self, X, y, identifiers, feature_names=None, is_synthetic=True):
        candidate_configs = [
            {"name": "Dummy (Mean)", "type": "dummy", "transform": False},
            {"name": "HistGradientBoosting (Raw)", "type": "hist_gb", "transform": False},
            {"name": "HistGradientBoosting (Log1p)", "type": "hist_gb", "transform": True},
            {"name": "RandomForest (Raw)", "type": "random_forest", "transform": False},
            {"name": "RandomForest (Log1p)", "type": "random_forest", "transform": True},
            {"name": "ExtraTrees (Raw)", "type": "extra_trees", "transform": False},
            {"name": "ExtraTrees (Log1p)", "type": "extra_trees", "transform": True}
        ]

        comparison_records = []
        val_results_map = {}
        best_model_info = None
        best_composite = float("inf")

        for cfg in candidate_configs:
            start_time = time.time()
            builder = lambda c=cfg: create_model(c["type"], transform_target=c["transform"], random_state=self.random_state)
            val_res = self.validator.evaluate(builder, X, y, identifiers, model_name=cfg["name"])
            elapsed = round(time.time() - start_time, 2)
            
            agg = val_res["aggregate_metrics"]
            record = {
                "model_name": cfg["name"],
                "model_type": cfg["type"],
                "target_transform": cfg["transform"],
                "overall_rmse": agg["overall_rmse"],
                "extreme_rmse": agg["extreme_rmse"],
                "mae": agg["mae"],
                "r2": agg["r2"],
                "composite_score": agg["composite_score"],
                "validation_time_sec": elapsed
            }
            comparison_records.append(record)
            val_results_map[cfg["name"]] = val_res

            if agg["composite_score"] < best_composite:
                best_composite = agg["composite_score"]
                best_model_info = {
                    "config": cfg,
                    "validation_result": val_res
                }

        comparison_df = pd.DataFrame(comparison_records).sort_values("composite_score", ascending=True)

        selected_cfg = best_model_info["config"]
        selected_val = best_model_info["validation_result"]

        best_oof = selected_val["oof_dataframe"]
        extreme_rows = best_oof[best_oof["extreme_event_flag"] == 1]
        normal_rows = best_oof[best_oof["extreme_event_flag"] == 0]

        underestimate_pct = float(np.mean(extreme_rows["predicted_discharge_cfs"] < extreme_rows["actual_discharge_cfs"]) * 100.0) if len(extreme_rows) > 0 else 0.0
        extreme_mean_err = float(np.mean(extreme_rows["prediction_error"])) if len(extreme_rows) > 0 else 0.0
        normal_mean_err = float(np.mean(normal_rows["prediction_error"])) if len(normal_rows) > 0 else 0.0

        final_model = create_model(selected_cfg["type"], transform_target=selected_cfg["transform"], random_state=self.random_state)
        train_full(final_model, X, y)

        os.makedirs("outputs", exist_ok=True)
        comparison_path = os.path.join("outputs", "model_comparison.csv")
        comparison_df.to_csv(comparison_path, index=False)

        val_pred_path = os.path.join("outputs", "validation_predictions.csv")
        best_oof.to_csv(val_pred_path, index=False)

        model_artifact_path = os.path.join("outputs", "selected_model.joblib")
        save_model(final_model, model_artifact_path)

        results_json = {
            "project_name": "Vega_miti",
            "model_name": selected_cfg["name"],
            "model_type": selected_cfg["type"],
            "target_transform": selected_cfg["transform"],
            "validation_method": selected_val["validation_method"],
            "validation_station_count": selected_val["station_count"],
            "total_folds": selected_val["total_folds"],
            "aggregate_metrics": selected_val["aggregate_metrics"],
            "fold_metrics": selected_val["fold_metrics"],
            "per_station_metrics": selected_val["per_station_metrics"],
            "worst_performing_stations": selected_val["worst_stations"],
            "extreme_event_analysis": {
                "underestimation_rate_pct": round(underestimate_pct, 2),
                "extreme_mean_error_cfs": round(extreme_mean_err, 2),
                "normal_mean_error_cfs": round(normal_mean_err, 2),
                "extreme_event_sample_count": len(extreme_rows),
                "normal_sample_count": len(normal_rows)
            },
            "feature_names": feature_names if feature_names is not None else [],
            "model_configuration": {
                "random_state": self.random_state,
                "model_artifact": model_artifact_path
            },
            "training_timestamp": datetime.now(timezone.utc).isoformat(),
            "dataset_status": "synthetic_fallback" if is_synthetic else "official_competition_data",
            "is_synthetic": is_synthetic,
            "known_model_limitations": [
                "Evaluated using station-held-out validation to simulate unseen stations",
                "Extreme-event prediction constrained by historical station catchment attributes"
            ]
        }

        results_json_path = os.path.join("outputs", "model_results.json")
        with open(results_json_path, "w", encoding="utf-8") as f:
            json.dump(results_json, f, indent=2)

        return {
            "comparison_df": comparison_df,
            "selected_config": selected_cfg,
            "validation_result": selected_val,
            "final_model": final_model,
            "results_json": results_json
        }

