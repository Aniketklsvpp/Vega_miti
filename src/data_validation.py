import numpy as np
import pandas as pd

def check_schema(df, required_columns):
    actual_columns = set(df.columns)
    missing = [col for col in required_columns if col not in actual_columns]
    return {
        "is_valid": len(missing) == 0,
        "missing_columns": missing,
        "actual_columns": list(df.columns)
    }

def check_duplicates(df, subset=None):
    if subset is None:
        subset = [c for c in ["station_id", "date"] if c in df.columns]
    if not subset:
        return {"duplicate_count": 0, "duplicate_indices": []}
    duplicates = df.duplicated(subset=subset, keep=False)
    dup_count = int(duplicates.sum())
    return {
        "duplicate_count": dup_count,
        "has_duplicates": dup_count > 0,
        "duplicate_subset": subset
    }

def check_missingness(df):
    total_rows = len(df)
    missing_counts = df.isnull().sum().to_dict()
    missing_pct = {k: (v / total_rows * 100.0) if total_rows > 0 else 0.0 for k, v in missing_counts.items()}
    return {
        "total_rows": total_rows,
        "missing_counts": missing_counts,
        "missing_percentages": missing_pct
    }

def check_value_ranges(df, is_train=True):
    warnings = []
    errors = []
    
    if "station_id" in df.columns:
        empty_stations = df["station_id"].isna().sum() + (df["station_id"] == "").sum()
        if empty_stations > 0:
            errors.append(f"Found {int(empty_stations)} empty or null station identifiers.")
            
    if "date" in df.columns:
        nat_dates = df["date"].isna().sum()
        if nat_dates > 0:
            errors.append(f"Found {int(nat_dates)} unparseable or null dates.")
            
    if "discharge_cfs" in df.columns:
        if is_train:
            missing_discharge = int(df["discharge_cfs"].isna().sum())
            if missing_discharge > 0:
                warnings.append(f"Found {missing_discharge} missing discharge target values in training data.")
        negative_discharge = int((df["discharge_cfs"] < 0).sum())
        if negative_discharge > 0:
            errors.append(f"Found {negative_discharge} negative discharge values.")
            
    if "precipitation_mm" in df.columns:
        neg_precip = int((df["precipitation_mm"] < 0).sum())
        if neg_precip > 0:
            warnings.append(f"Found {neg_precip} negative precipitation values.")
            
    if "soil_moisture" in df.columns:
        invalid_sm = int(((df["soil_moisture"] < 0) | (df["soil_moisture"] > 1.0)).sum())
        if invalid_sm > 0:
            warnings.append(f"Found {invalid_sm} soil moisture values outside expected [0, 1] range.")
            
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    inf_counts = {}
    for col in numeric_cols:
        count = int(np.isinf(df[col]).sum())
        if count > 0:
            inf_counts[col] = count
            errors.append(f"Column {col} has {count} infinite values.")
            
    return {
        "errors": errors,
        "warnings": warnings,
        "infinite_counts": inf_counts
    }

def calculate_extreme_event_stats(df, station_col="station_id", target_col="discharge_cfs"):
    if target_col not in df.columns or station_col not in df.columns:
        return {}
    
    stats = {}
    for station, group in df.groupby(station_col):
        clean_target = group[target_col].dropna()
        count = len(clean_target)
        if count == 0:
            continue
            
        q90 = float(clean_target.quantile(0.90))
        q95 = float(clean_target.quantile(0.95))
        q99 = float(clean_target.quantile(0.99))
        med = float(clean_target.median())
        max_val = float(clean_target.max())
        count_above_90 = int((clean_target >= q90).sum())
        missing_pct = float(group[target_col].isna().sum() / len(group) * 100.0)
        
        stats[str(station)] = {
            "observation_count": count,
            "median_cfs": med,
            "p90_cfs": q90,
            "p95_cfs": q95,
            "p99_cfs": q99,
            "max_cfs": max_val,
            "count_above_p90": count_above_90,
            "missing_pct": missing_pct
        }
        
    return stats

def validate_dataset(train_df, test_df=None, metadata_df=None):
    report = {
        "train_rows": len(train_df),
        "train_columns": list(train_df.columns),
        "status": "VALID",
        "errors": [],
        "warnings": []
    }
    
    dup_check = check_duplicates(train_df)
    if dup_check["has_duplicates"]:
        report["warnings"].append(f"Training dataset has {dup_check['duplicate_count']} duplicate records on {dup_check['duplicate_subset']}.")
        
    missing_info = check_missingness(train_df)
    report["train_missingness"] = missing_info["missing_percentages"]
    
    range_check = check_value_ranges(train_df, is_train=True)
    report["errors"].extend(range_check["errors"])
    report["warnings"].extend(range_check["warnings"])
    
    if "station_id" in train_df.columns and "discharge_cfs" in train_df.columns:
        report["extreme_event_statistics"] = calculate_extreme_event_stats(train_df)
        
    if test_df is not None:
        report["test_rows"] = len(test_df)
        report["test_columns"] = list(test_df.columns)
        
        test_dups = check_duplicates(test_df)
        if test_dups["has_duplicates"]:
            report["warnings"].append(f"Test dataset has {test_dups['duplicate_count']} duplicate records.")
            
        test_ranges = check_value_ranges(test_df, is_train=False)
        report["errors"].extend(test_ranges["errors"])
        report["warnings"].extend(test_ranges["warnings"])
        
        train_stations = set(train_df["station_id"].astype(str)) if "station_id" in train_df.columns else set()
        test_stations = set(test_df["station_id"].astype(str)) if "station_id" in test_df.columns else set()
        
        overlap = train_stations.intersection(test_stations)
        unseen = test_stations.difference(train_stations)
        
        report["station_analysis"] = {
            "train_station_count": len(train_stations),
            "test_station_count": len(test_stations),
            "overlap_count": len(overlap),
            "unseen_count": len(unseen),
            "unseen_stations": sorted(list(unseen))
        }
        
    if metadata_df is not None and "station_id" in metadata_df.columns:
        meta_stations = set(metadata_df["station_id"].astype(str))
        train_stations = set(train_df["station_id"].astype(str)) if "station_id" in train_df.columns else set()
        missing_meta = train_stations.difference(meta_stations)
        if missing_meta:
            report["warnings"].append(f"{len(missing_meta)} training stations lack entries in station_metadata.")
            
    if report["errors"]:
        report["status"] = "INVALID"
    elif report["warnings"]:
        report["status"] = "VALID_WITH_WARNINGS"
        
    return report

