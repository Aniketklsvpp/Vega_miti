import json
from pathlib import Path
import numpy as np
import pandas as pd

def detect_discharge_column_and_units(columns):
    col_map = {
        "discharge_cfs": ("discharge_cfs", "cfs (ft3/s)"),
        "streamflow": ("streamflow", "mm/day"),
        "streamflow_mm_per_day": ("streamflow_mm_per_day", "mm/day"),
        "streamflow_volumetric": ("streamflow_volumetric", "m3/s"),
        "discharge_cumec": ("discharge_cumec", "m3/s (cumec)"),
        "discharge_m3s": ("discharge_m3s", "m3/s (cumec)"),
        "discharge": ("discharge", "unknown_volumetric")
    }
    for col in columns:
        col_lower = col.lower()
        if col_lower in col_map:
            return col_map[col_lower]
        if "cfs" in col_lower:
            return (col, "cfs (ft3/s)")
        if "cumec" in col_lower or "m3" in col_lower:
            return (col, "m3/s (cumec)")
    return (None, "none")

def audit_dataset_inventory(df_or_path, source_name="dataset"):
    if isinstance(df_or_path, (str, Path)):
        path = Path(df_or_path)
        if not path.is_file():
            raise FileNotFoundError(f"Dataset file not found: {path}")
        df = pd.read_csv(path, dtype={"station_id": str, "site_no": str, "gauge_id": str})
        file_path_str = str(path.resolve())
    else:
        df = df_or_path.copy()
        file_path_str = "in_memory_dataframe"

    id_col = next((c for c in ["station_id", "gauge_id", "site_no", "catchment_id"] if c in df.columns), df.columns[0])
    date_col = next((c for c in ["date", "datetime", "time", "Date"] if c in df.columns), None)
    
    total_rows = len(df)
    stations = df[id_col].dropna().unique() if id_col in df.columns else []
    station_count = len(stations)

    date_coverage = {}
    temporal_resolution = "unknown"
    if date_col and date_col in df.columns:
        parsed_dates = pd.to_datetime(df[date_col], errors="coerce")
        clean_dates = parsed_dates.dropna()
        if len(clean_dates) > 0:
            min_date = clean_dates.min().strftime("%Y-%m-%d")
            max_date = clean_dates.max().strftime("%Y-%m-%d")
            span_days = int((clean_dates.max() - clean_dates.min()).days) + 1
            date_coverage = {
                "start_date": min_date,
                "end_date": max_date,
                "span_days": span_days,
                "unparseable_dates_count": int(parsed_dates.isna().sum())
            }
            if station_count > 0:
                obs_per_st = total_rows / max(1, station_count)
                if abs(obs_per_st - span_days) <= 5:
                    temporal_resolution = "daily"
                else:
                    temporal_resolution = "sub-daily or irregular daily"

    geo_coverage = {}
    if "state" in df.columns:
        geo_coverage["states"] = sorted([str(s) for s in df["state"].dropna().unique()])
        geo_coverage["state_count"] = len(geo_coverage["states"])
    if "country" in df.columns or "country_code" in df.columns:
        c_col = "country" if "country" in df.columns else "country_code"
        geo_coverage["countries"] = sorted([str(c) for c in df[c_col].dropna().unique()])
    if "latitude" in df.columns and "longitude" in df.columns:
        geo_coverage["bounding_box"] = {
            "lat_min": float(df["latitude"].min()),
            "lat_max": float(df["latitude"].max()),
            "lon_min": float(df["longitude"].min()),
            "lon_max": float(df["longitude"].max())
        }

    q_col, q_units = detect_discharge_column_and_units(df.columns)
    discharge_stats = {}
    if q_col and q_col in df.columns:
        q_series = pd.to_numeric(df[q_col], errors="coerce")
        missing_q = int(q_series.isna().sum())
        negative_q = int((q_series < 0).sum())
        valid_q = q_series[q_series >= 0]
        discharge_stats = {
            "discharge_column": q_col,
            "detected_units": q_units,
            "missing_count": missing_q,
            "missing_pct": round(missing_q / max(1, total_rows) * 100.0, 3),
            "negative_count": negative_q,
            "negative_pct": round(negative_q / max(1, total_rows) * 100.0, 3),
            "min_valid": float(valid_q.min()) if len(valid_q) > 0 else 0.0,
            "median_valid": float(valid_q.median()) if len(valid_q) > 0 else 0.0,
            "p90_valid": float(valid_q.quantile(0.90)) if len(valid_q) > 0 else 0.0,
            "p99_valid": float(valid_q.quantile(0.99)) if len(valid_q) > 0 else 0.0,
            "max_valid": float(valid_q.max()) if len(valid_q) > 0 else 0.0
        }

    missing_map = {}
    for col in df.columns:
        m_cnt = int(df[col].isna().sum())
        missing_map[col] = {
            "missing_count": m_cnt,
            "missing_percentage": round(m_cnt / max(1, total_rows) * 100.0, 3)
        }

    duplicate_records_count = 0
    if id_col in df.columns and date_col in df.columns:
        duplicate_records_count = int(df.duplicated(subset=[id_col, date_col]).sum())

    inventory_report = {
        "dataset_name": source_name,
        "source_path": file_path_str,
        "total_records": total_rows,
        "catchment_station_count": station_count,
        "station_identifiers_sample": [str(s) for s in stations[:10]],
        "temporal_coverage": date_coverage,
        "temporal_resolution": temporal_resolution,
        "geographic_coverage": geo_coverage,
        "variables_present": list(df.columns),
        "variable_types": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "discharge_audit": discharge_stats,
        "missingness": missing_map,
        "duplicate_records_count": duplicate_records_count,
        "integrity_status": "PASS" if (duplicate_records_count == 0 and discharge_stats.get("negative_count", 0) == 0) else "WARNING"
    }

    return inventory_report

def save_inventory_report(report_dict, output_path="data/reports/dataset_inventory.json"):
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report_dict, f, indent=2)
    return str(out_file.resolve())

if __name__ == "__main__":
    train_file = Path("data/processed/train.csv")
    if train_file.is_file():
        rep = audit_dataset_inventory(train_file, source_name="USGS_22_Station_Processed")
        out_p = save_inventory_report(rep, "data/reports/dataset_inventory.json")
        print("Inventory report successfully saved to:", out_p)
        print("Station Count:", rep["catchment_station_count"])
        print("Total Records:", rep["total_records"])
        print("Discharge Units:", rep["discharge_audit"].get("detected_units"))
        print("Integrity Status:", rep["integrity_status"])
    else:
        print("Train file not found at:", train_file)
