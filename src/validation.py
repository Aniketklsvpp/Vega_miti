import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold, LeaveOneGroupOut
from src.metrics import calculate_metrics, identify_extreme_events

class StationGroupValidator:
    def __init__(self, n_splits=5, random_state=42):
        self.n_splits = n_splits
        self.random_state = random_state

    def get_splitter(self, groups):
        unique_groups = np.unique(groups)
        n_unique = len(unique_groups)
        if n_unique <= 10:
            return LeaveOneGroupOut(), "LeaveOneGroupOut", n_unique
        splits = min(self.n_splits, n_unique)
        return GroupKFold(n_splits=splits), f"GroupKFold(n_splits={splits})", splits

    def evaluate(self, model_builder, X, y, identifiers, model_name="model"):
        X_df = pd.DataFrame(X).copy()
        y_series = pd.Series(y).copy()
        identifiers_df = pd.DataFrame(identifiers).copy()
        
        station_col = "station_id" if "station_id" in identifiers_df.columns else identifiers_df.columns[0]
        date_col = "date" if "date" in identifiers_df.columns else (identifiers_df.columns[1] if len(identifiers_df.columns) > 1 else None)
        
        groups = identifiers_df[station_col].values
        splitter, split_desc, total_folds = self.get_splitter(groups)
        
        oof_predictions = np.full(len(y_series), np.nan, dtype=float)
        fold_metrics = []
        
        for fold_idx, (train_idx, val_idx) in enumerate(splitter.split(X_df, y_series, groups=groups)):
            X_tr, y_tr = X_df.iloc[train_idx], y_series.iloc[train_idx]
            X_val, y_val = X_df.iloc[val_idx], y_series.iloc[val_idx]
            val_stations = groups[val_idx]
            
            model = model_builder()
            model.fit(X_tr, y_tr)
            
            preds = model.predict(X_val)
            preds = np.clip(preds, a_min=0.0, a_max=None)
            oof_predictions[val_idx] = preds
            
            f_metrics = calculate_metrics(y_val.values, preds, station_ids=val_stations)
            f_metrics["fold"] = fold_idx + 1
            f_metrics["val_stations"] = list(map(str, np.unique(val_stations)))
            fold_metrics.append(f_metrics)

        agg_metrics = calculate_metrics(y_series.values, oof_predictions, station_ids=groups)
        extreme_flags = identify_extreme_events(y_series.values, station_ids=groups)

        val_df = pd.DataFrame({
            "station_id": groups,
            "date": identifiers_df[date_col].values if date_col is not None else np.arange(len(groups)),
            "actual_discharge_cfs": y_series.values,
            "predicted_discharge_cfs": oof_predictions,
            "prediction_error": oof_predictions - y_series.values,
            "extreme_event_flag": extreme_flags
        })

        station_metrics = {}
        for st in np.unique(groups):
            st_sub = val_df[val_df["station_id"] == st]
            st_metrics = calculate_metrics(
                st_sub["actual_discharge_cfs"].values,
                st_sub["predicted_discharge_cfs"].values,
                station_ids=st_sub["station_id"].values
            )
            station_metrics[str(st)] = st_metrics

        worst_stations = sorted(
            station_metrics.items(),
            key=lambda item: item[1]["overall_rmse"] if np.isfinite(item[1]["overall_rmse"]) else -1.0,
            reverse=True
        )

        return {
            "model_name": model_name,
            "validation_method": split_desc,
            "total_folds": total_folds,
            "station_count": len(np.unique(groups)),
            "aggregate_metrics": agg_metrics,
            "fold_metrics": fold_metrics,
            "per_station_metrics": station_metrics,
            "worst_stations": [s[0] for s in worst_stations[:3]],
            "oof_dataframe": val_df
        }

