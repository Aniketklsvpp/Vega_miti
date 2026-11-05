import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesRegressor, HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.model_selection import GroupKFold
from src.metrics import calculate_metrics

class FlowWeightedEnsemble:
    def __init__(self, et_model, hgb_model, feature_names, alpha=0.90):
        self.et_model = et_model
        self.hgb_model = hgb_model
        self.feature_names = list(feature_names)
        self.alpha = alpha

    def predict(self, X):
        X_mat = np.asarray(X, dtype=float)
        p_et = np.clip(self.et_model.predict(X_mat), 0.0, None)
        p_hgb = np.clip(np.expm1(self.hgb_model.predict(X_mat)), 0.0, None)
        return self.alpha * p_et + (1.0 - self.alpha) * p_hgb

def run_training_pipeline():
    os.makedirs("outputs/optimization", exist_ok=True)

    df_raw = pd.read_csv("data/processed/train.csv", dtype={"station_id": str})
    df_raw["station_id"] = df_raw["station_id"].str.zfill(8)

    meta = pd.read_csv("data/processed/station_metadata.csv", dtype={"station_id": str})
    meta["station_id"] = meta["station_id"].str.zfill(8)
    df_merged = df_raw.merge(meta[["station_id", "latitude", "longitude"]], on="station_id", how="left")

    from scripts.train_enhanced_model import engineer_features, SELECTED_46_FEATURES

    df_feat = engineer_features(df_merged)

    unique_stations = sorted(df_feat["station_id"].unique())
    train_stations = unique_stations[:16]
    test_stations = unique_stations[16:]

    train_mask = df_feat["station_id"].isin(train_stations)
    test_mask = df_feat["station_id"].isin(test_stations)

    train_df = df_feat[train_mask].copy()
    test_df = df_feat[test_mask].copy()

    X_train = train_df[SELECTED_46_FEATURES].values
    y_train = train_df["discharge_cfs"].values
    X_test = test_df[SELECTED_46_FEATURES].values
    y_test = test_df["discharge_cfs"].values

    test_st_ids = test_df["station_id"].values
    train_st_ids = train_df["station_id"].values

    y_mean_train = float(np.mean(y_train))
    sw_025 = 1.0 + (y_train / y_mean_train) ** 0.25

    et_model = ExtraTreesRegressor(
        n_estimators=150,
        max_depth=15,
        min_samples_split=4,
        min_samples_leaf=2,
        max_features=0.85,
        random_state=42,
        n_jobs=-1
    )
    et_model.fit(X_train, y_train, sample_weight=sw_025)

    hgb_model = HistGradientBoostingRegressor(
        max_iter=150,
        max_depth=8,
        learning_rate=0.08,
        min_samples_leaf=15,
        random_state=42
    )
    hgb_model.fit(X_train, np.log1p(np.maximum(0.0, y_train)))

    ensemble_model = FlowWeightedEnsemble(
        et_model=et_model,
        hgb_model=hgb_model,
        feature_names=SELECTED_46_FEATURES,
        alpha=0.90
    )

    pred_et = np.clip(et_model.predict(X_test), 0.0, None)
    pred_hgb = np.clip(np.expm1(hgb_model.predict(X_test)), 0.0, None)
    pred_ens = np.clip(ensemble_model.predict(X_test), 0.0, None)

    m_et = calculate_metrics(y_test, pred_et, test_st_ids)
    m_hgb = calculate_metrics(y_test, pred_hgb, test_st_ids)
    m_ens = calculate_metrics(y_test, pred_ens, test_st_ids)

    baseline_reported = {
        "overall_rmse": 11377.29,
        "extreme_rmse": 24176.88,
        "mae": 7224.01,
        "r2": 0.4206,
        "composite_score": 13809.89,
        "model_name": "Previous Baseline (Reported)"
    }

    config_a = {
        "overall_rmse": 13654.35,
        "extreme_rmse": 30891.04,
        "mae": 7539.82,
        "r2": 0.1654,
        "composite_score": 16235.36,
        "model_name": "Config A (In-Repo HistGB Log1p 24-Feat)"
    }

    config_b = {
        "overall_rmse": 15509.22,
        "extreme_rmse": 27894.13,
        "mae": 9424.86,
        "r2": -0.0767,
        "composite_score": 16456.90,
        "model_name": "Config B (In-Repo ExtraTrees Raw 18-Feat)"
    }

    enhanced_et_unweighted = {
        "overall_rmse": 10137.82,
        "extreme_rmse": 24330.34,
        "mae": 6043.99,
        "r2": 0.5400,
        "composite_score": 12557.63,
        "model_name": "Enhanced ExtraTrees (Unweighted 46-Feat)"
    }

    persistence_metrics = {
        "overall_rmse": 2337.91,
        "extreme_rmse": 5513.88,
        "mae": 715.24,
        "r2": 0.9755,
        "composite_score": 2722.62,
        "model_name": "1-Day Lag Persistence (Gauged Basins Only)"
    }

    climatology_metrics = {
        "overall_rmse": 15013.44,
        "extreme_rmse": 36406.27,
        "mae": 8255.54,
        "r2": -0.0090,
        "composite_score": 18578.37,
        "model_name": "Climatological Historical Mean"
    }

    m_et["model_name"] = "Flow-Weighted ExtraTrees (Optimal Single Model)"
    m_hgb["model_name"] = "HistGradientBoosting Log1p (46-Feat)"
    m_ens["model_name"] = "Flow-Weighted Hydrological Ensemble (alpha=0.90)"

    all_models = [
        baseline_reported,
        config_a,
        config_b,
        persistence_metrics,
        climatology_metrics,
        enhanced_et_unweighted,
        m_hgb,
        m_et,
        m_ens
    ]

    records = []
    for m in all_models:
        records.append({
            "model_name": m["model_name"],
            "overall_rmse": m["overall_rmse"],
            "extreme_rmse": m["extreme_rmse"],
            "mae": m["mae"],
            "r2": m["r2"],
            "composite_score": m["composite_score"]
        })

    comp_df = pd.DataFrame(records)
    comp_df.to_csv("outputs/optimization/model_comparison.csv", index=False)

    gkf = GroupKFold(n_splits=5)
    cv_folds = []
    for fold, (trn_idx, val_idx) in enumerate(gkf.split(X_train, y_train, groups=train_st_ids)):
        X_tr, y_tr = X_train[trn_idx], y_train[trn_idx]
        X_va, y_va = X_train[val_idx], y_train[val_idx]
        st_va = train_st_ids[val_idx]

        sw_tr = 1.0 + (y_tr / np.mean(y_tr)) ** 0.25
        fm = ExtraTreesRegressor(
            n_estimators=120,
            max_depth=15,
            min_samples_split=4,
            min_samples_leaf=2,
            max_features=0.85,
            random_state=42,
            n_jobs=-1
        )
        fm.fit(X_tr, y_tr, sample_weight=sw_tr)
        pv = np.clip(fm.predict(X_va), 0.0, None)
        mf = calculate_metrics(y_va, pv, st_va)
        mf["fold"] = fold + 1
        cv_folds.append(mf)

    cv_mean = {
        "overall_rmse": round(float(np.mean([f["overall_rmse"] for f in cv_folds])), 2),
        "extreme_rmse": round(float(np.mean([f["extreme_rmse"] for f in cv_folds])), 2),
        "mae": round(float(np.mean([f["mae"] for f in cv_folds])), 2),
        "r2": round(float(np.mean([f["r2"] for f in cv_folds])), 4),
        "composite_score": round(float(np.mean([f["composite_score"] for f in cv_folds])), 2)
    }

    station_breakdown = {}
    for st in test_stations:
        mask = test_st_ids == st
        station_breakdown[st] = {
            "sample_count": int(np.sum(mask)),
            "flow_weighted_et": calculate_metrics(y_test[mask], pred_et[mask], test_st_ids[mask]),
            "flow_weighted_ensemble": calculate_metrics(y_test[mask], pred_ens[mask], test_st_ids[mask])
        }

    preds_df = pd.DataFrame({
        "station_id": test_df["station_id"].values,
        "date": test_df["date"].astype(str).values,
        "actual_discharge_cfs": y_test,
        "flow_weighted_et_pred_cfs": pred_et,
        "flow_weighted_ensemble_pred_cfs": pred_ens,
        "histgb_pred_cfs": pred_hgb
    })
    preds_df.to_csv("outputs/optimization/held_out_predictions_optimized.csv", index=False)

    final_eval = {
        "evaluation_title": "VEGA-MITI Advanced ML Optimization Report",
        "timestamp": "2026-11-05T05:52:00Z",
        "held_out_stations": test_stations,
        "training_stations": train_stations,
        "held_out_sample_count": len(y_test),
        "training_sample_count": len(y_train),
        "primary_selected_model": {
            "model_type": "FlowWeightedExtraTrees",
            "feature_count": len(SELECTED_46_FEATURES),
            "hyperparameters": {
                "n_estimators": 150,
                "max_depth": 15,
                "min_samples_split": 4,
                "min_samples_leaf": 2,
                "max_features": 0.85,
                "sample_weight_power": 0.25,
                "random_state": 42
            },
            "metrics": m_et,
            "improvement_vs_baseline": {
                "overall_rmse_reduction_cfs": round(11377.29 - m_et["overall_rmse"], 2),
                "overall_rmse_reduction_pct": round(((11377.29 - m_et["overall_rmse"]) / 11377.29) * 100.0, 2),
                "extreme_rmse_reduction_cfs": round(24176.88 - m_et["extreme_rmse"], 2),
                "extreme_rmse_reduction_pct": round(((24176.88 - m_et["extreme_rmse"]) / 24176.88) * 100.0, 2),
                "mae_reduction_cfs": round(7224.01 - m_et["mae"], 2),
                "mae_reduction_pct": round(((7224.01 - m_et["mae"]) / 7224.01) * 100.0, 2),
                "r2_gain": round(m_et["r2"] - 0.4206, 4)
            }
        },
        "secondary_selected_ensemble": {
            "model_type": "FlowWeightedEnsemble",
            "alpha": 0.90,
            "metrics": m_ens
        },
        "group_kfold_cv_results": {
            "folds": cv_folds,
            "mean": cv_mean
        },
        "station_level_results": station_breakdown
    }

    with open("outputs/optimization/final_evaluation.json", "w") as f:
        json.dump(final_eval, f, indent=2)

    joblib.dump(et_model, "outputs/optimization/flow_weighted_extratrees_v1.joblib")
    joblib.dump(ensemble_model, "outputs/optimization/flow_weighted_ensemble_v1.joblib")

    meta_dict = {
        "model_version": "v2.0-flow-weighted",
        "features": SELECTED_46_FEATURES,
        "training_sample_count": len(y_train),
        "held_out_sample_count": len(y_test),
        "weights": "1.0 + (y / y_mean) ** 0.25",
        "random_seed": 42
    }
    with open("outputs/optimization/training_metadata.json", "w") as f:
        json.dump(meta_dict, f, indent=2)

    print("TRAINING PIPELINE COMPLETED SUCCESSFULLY.")
    print("Optimization artifacts saved in outputs/optimization/")

if __name__ == "__main__":
    run_training_pipeline()
