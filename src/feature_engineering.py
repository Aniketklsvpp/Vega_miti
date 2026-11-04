import numpy as np
import pandas as pd
from src.data_validation import validate_dataset
from src.preprocessing import PreprocessingPipeline, separate_target_and_identifiers

def add_temporal_features(df):
    out = df.copy()
    if "date" in out.columns:
        dates = pd.to_datetime(out["date"], errors="coerce")
        day_of_yr = getattr(dates.dt, "day_of_year", None)
        if day_of_yr is None:
            day_of_yr = dates.dt.dayofyear
        out["day_of_year"] = day_of_yr.astype(float)
        out["month"] = dates.dt.month.astype(float)
        day_of_wk = getattr(dates.dt, "day_of_week", None)
        if day_of_wk is None:
            day_of_wk = dates.dt.dayofweek
        out["day_of_week"] = day_of_wk.astype(float)
        out["season"] = (dates.dt.month % 12 // 3 + 1).astype(float)
        out["sin_day_of_year"] = np.sin(2 * np.pi * out["day_of_year"] / 365.25)
        out["cos_day_of_year"] = np.cos(2 * np.pi * out["day_of_year"] / 365.25)
    return out

def add_meteorological_features(df):
    out = df.copy()
    if "temp_max_c" in out.columns and "temp_min_c" in out.columns:
        out["temp_range"] = out["temp_max_c"] - out["temp_min_c"]
        out["temp_avg"] = (out["temp_max_c"] + out["temp_min_c"]) / 2.0
        
    if "drainage_area_sqmi" in out.columns:
        out["log_drainage_area"] = np.log1p(np.maximum(0.0, out["drainage_area_sqmi"].fillna(0.0)))
        
    return out

def add_lag_and_rolling_features(df, station_col="station_id", date_col="date"):
    out = df.copy()
    if station_col not in out.columns or date_col not in out.columns:
        return out
        
    out["_original_order"] = np.arange(len(out))
    out[date_col] = pd.to_datetime(out[date_col], errors="coerce")
    out = out.sort_values([station_col, date_col])
    
    grouped = out.groupby(station_col)
    
    if "precipitation_mm" in out.columns:
        out["precip_lag_1"] = grouped["precipitation_mm"].shift(1)
        out["precip_lag_2"] = grouped["precipitation_mm"].shift(2)
        out["precip_lag_3"] = grouped["precipitation_mm"].shift(3)
        
        shifted_precip = grouped["precipitation_mm"].shift(1)
        shifted_grouped = shifted_precip.groupby(out[station_col])
        out["precip_roll_sum_3d"] = shifted_grouped.rolling(3, min_periods=1).sum().reset_index(level=0, drop=True)
        out["precip_roll_sum_7d"] = shifted_grouped.rolling(7, min_periods=1).sum().reset_index(level=0, drop=True)
        out["precip_roll_sum_14d"] = shifted_grouped.rolling(14, min_periods=1).sum().reset_index(level=0, drop=True)
        
    if "temp_avg" in out.columns:
        out["temp_avg_lag_1"] = grouped["temp_avg"].shift(1)
        
    if "soil_moisture" in out.columns:
        out["soil_moisture_lag_1"] = grouped["soil_moisture"].shift(1)
        shifted_sm = grouped["soil_moisture"].shift(1)
        shifted_sm_grouped = shifted_sm.groupby(out[station_col])
        out["soil_moisture_roll_mean_3d"] = shifted_sm_grouped.rolling(3, min_periods=1).mean().reset_index(level=0, drop=True)
        
    out = out.sort_values("_original_order").drop(columns=["_original_order"])
    return out

def engineer_features_dataframe(df):
    res = add_temporal_features(df)
    res = add_meteorological_features(res)
    res = add_lag_and_rolling_features(res)
    return res

def build_features(train_df, test_df=None):
    quality_report = validate_dataset(train_df, test_df)
    
    train_work = train_df.copy()
    train_work["_is_train"] = True
    train_work["_row_idx"] = np.arange(len(train_work))
    
    if test_df is not None:
        test_work = test_df.copy()
        test_work["_is_train"] = False
        test_work["_row_idx"] = np.arange(len(test_work))
        combined = pd.concat([train_work, test_work], ignore_index=True)
    else:
        combined = train_work
        
    engineered_combined = engineer_features_dataframe(combined)
    
    train_processed = engineered_combined[engineered_combined["_is_train"]].sort_values("_row_idx").drop(columns=["_is_train", "_row_idx"])
    
    if test_df is not None:
        test_processed = engineered_combined[~engineered_combined["_is_train"]].sort_values("_row_idx").drop(columns=["_is_train", "_row_idx"])
    else:
        test_processed = None
        
    X_train_raw, y_train, train_identifiers = separate_target_and_identifiers(train_processed, target_col="discharge_cfs")
    
    pipeline = PreprocessingPipeline(target_col="discharge_cfs")
    pipeline.fit(X_train_raw)
    
    X_train = pipeline.transform(X_train_raw)
    feature_names = list(X_train.columns)
    
    if test_processed is not None:
        X_test_raw, _, test_identifiers = separate_target_and_identifiers(test_processed, target_col="discharge_cfs")
        for col in feature_names:
            if col not in X_test_raw.columns:
                X_test_raw[col] = np.nan
        X_test_raw = X_test_raw[feature_names]
        X_test = pipeline.transform(X_test_raw)
    else:
        X_test = None
        test_identifiers = None
        
    return X_train, y_train, X_test, train_identifiers, test_identifiers, feature_names, quality_report
