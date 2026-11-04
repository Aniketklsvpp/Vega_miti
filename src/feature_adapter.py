import importlib
import numpy as np
import pandas as pd

def get_feature_pipeline():
    try:
        mod = importlib.import_module("src.feature_engineering")
        if hasattr(mod, "build_features"):
            return mod.build_features
    except Exception:
        pass
    return default_feature_extractor

def default_feature_extractor(train_df, test_df):
    target_col = "discharge_cfs"
    station_col = "station_id" if "station_id" in train_df.columns else train_df.columns[0]
    date_col = "date" if "date" in train_df.columns else (train_df.columns[1] if "date" in train_df.columns else None)

    train_identifiers = pd.DataFrame({
        "station_id": train_df[station_col],
        "date": train_df[date_col] if date_col in train_df.columns else pd.date_range("2020-01-01", periods=len(train_df))
    })
    test_identifiers = pd.DataFrame({
        "station_id": test_df[station_col],
        "date": test_df[date_col] if (date_col and date_col in test_df.columns) else pd.date_range("2021-01-01", periods=len(test_df))
    })

    y_train = train_df[target_col].values if target_col in train_df.columns else np.zeros(len(train_df))

    exclude_cols = {target_col, station_col, "date", "id"}
    cand_cols = [c for c in train_df.columns if c not in exclude_cols]
    
    numeric_cols = []
    for c in cand_cols:
        if pd.api.types.is_numeric_dtype(train_df[c]):
            numeric_cols.append(c)

    if not numeric_cols:
        X_train = np.ones((len(train_df), 1))
        X_test = np.ones((len(test_df), 1))
        feature_names = ["const_feature"]
    else:
        medians = train_df[numeric_cols].median()
        X_train = train_df[numeric_cols].fillna(medians).values
        test_numeric = [c for c in numeric_cols if c in test_df.columns]
        test_sub = test_df[test_numeric].copy()
        for c in numeric_cols:
            if c not in test_sub.columns:
                test_sub[c] = medians[c]
        X_test = test_sub[numeric_cols].fillna(medians).values
        feature_names = numeric_cols

    quality_report = {
        "n_train_rows": len(train_df),
        "n_test_rows": len(test_df),
        "n_features": len(feature_names),
        "feature_names": feature_names,
        "missing_train_target": int(np.sum(pd.isna(y_train)))
    }

    return X_train, y_train, X_test, train_identifiers, test_identifiers, feature_names, quality_report

