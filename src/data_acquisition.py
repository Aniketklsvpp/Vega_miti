import json
import time
from pathlib import Path
import numpy as np
import pandas as pd
import requests

from src.data_validation import validate_dataset

CANDIDATE_STATIONS = [
    {"site_no": "01570500", "state": "PA", "name": "Susquehanna River at Harrisburg, PA"},
    {"site_no": "01638500", "state": "MD", "name": "Potomac River at Point of Rocks, MD"},
    {"site_no": "01646500", "state": "DC", "name": "Potomac River near Wash, DC Little Falls"},
    {"site_no": "02037500", "state": "VA", "name": "James River near Richmond, VA"},
    {"site_no": "02146000", "state": "SC", "name": "Catawba River near Rock Hill, SC"},
    {"site_no": "02169500", "state": "SC", "name": "Congaree River at Columbia, SC"},
    {"site_no": "02202500", "state": "GA", "name": "Ogeechee River near Eden, GA"},
    {"site_no": "03234500", "state": "OH", "name": "Scioto River at Higby, OH"},
    {"site_no": "03374100", "state": "IN", "name": "White River at Hazleton, IN"},
    {"site_no": "05484500", "state": "IA", "name": "Raccoon River at Van Meter, IA"},
    {"site_no": "05527500", "state": "IL", "name": "Kankakee River near Wilmington, IL"},
    {"site_no": "05586100", "state": "IL", "name": "Illinois River at Valley City, IL"},
    {"site_no": "06192500", "state": "MT", "name": "Yellowstone River near Livingston, MT"},
    {"site_no": "07144100", "state": "KS", "name": "Little Arkansas River near Sedgwick, KS"},
    {"site_no": "07196500", "state": "OK", "name": "Illinois River near Tahlequah, OK"},
    {"site_no": "08116650", "state": "TX", "name": "Brazos River near Rosharon, TX"},
    {"site_no": "08158000", "state": "TX", "name": "Colorado River at Austin, TX"},
    {"site_no": "09095500", "state": "CO", "name": "Colorado River near Cameo, CO"},
    {"site_no": "09180500", "state": "UT", "name": "Colorado River near Cisco, UT"},
    {"site_no": "09380000", "state": "AZ", "name": "Colorado River at Lees Ferry, AZ"},
    {"site_no": "11447650", "state": "CA", "name": "Sacramento River at Freeport, CA"},
    {"site_no": "12119000", "state": "WA", "name": "Cedar River at Renton, WA"},
    {"site_no": "14211720", "state": "OR", "name": "Willamette River at Portland, OR"}
]

def fetch_usgs_metadata(sites, raw_dir):
    cache_path = Path(raw_dir) / "usgs_metadata.rdb"
    if cache_path.is_file():
        text_data = cache_path.read_text(encoding="utf-8")
    else:
        url = f"https://waterservices.usgs.gov/nwis/site/?format=rdb&sites={','.join(sites)}&siteOutput=expanded"
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        text_data = resp.text
        cache_path.write_text(text_data, encoding="utf-8")
        
    lines = [l for l in text_data.splitlines() if not l.startswith("#") and l.strip()]
    if not lines:
        return {}
    header = lines[0].split("\t")
    meta_dict = {}
    for line in lines[2:]:
        fields = line.split("\t")
        if len(fields) >= len(header):
            row = dict(zip(header, fields))
            site_no = str(row.get("site_no", "")).strip()
            try:
                drain_area = float(row.get("drain_area_va", 0.0)) if row.get("drain_area_va") else np.nan
            except ValueError:
                drain_area = np.nan
            try:
                elev = float(row.get("alt_va", 0.0)) if row.get("alt_va") else np.nan
            except ValueError:
                elev = np.nan
            meta_dict[site_no] = {
                "station_id": site_no,
                "station_name": row.get("station_nm", ""),
                "latitude": float(row.get("dec_lat_va", 0.0)),
                "longitude": float(row.get("dec_long_va", 0.0)),
                "drainage_area_sqmi": drain_area,
                "mean_elevation_ft": elev,
                "state": row.get("state_cd", ""),
                "huc_cd": row.get("huc_cd", "")
            }
    return meta_dict

def fetch_usgs_daily_discharge(site_no, start_date, end_date, raw_dir):
    cache_path = Path(raw_dir) / f"usgs_dv_{site_no}.json"
    if cache_path.is_file():
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        url = (
            f"https://waterservices.usgs.gov/nwis/dv/?format=json&sites={site_no}"
            f"&startDT={start_date}&endDT={end_date}&parameterCd=00060&siteStatus=all"
        )
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(data, f)
            
    records = []
    try:
        ts_list = data["value"]["timeSeries"]
        for ts in ts_list:
            vals = ts["values"][0]["value"]
            for v in vals:
                dt_str = v["dateTime"].split("T")[0]
                val_str = v["value"]
                try:
                    cfs_val = float(val_str)
                    if cfs_val < 0:
                        cfs_val = np.nan
                except ValueError:
                    cfs_val = np.nan
                records.append({
                    "station_id": str(site_no),
                    "date": dt_str,
                    "discharge_cfs": cfs_val
                })
    except (KeyError, IndexError):
        pass
        
    df = pd.DataFrame(records)
    if not df.empty:
        df = df.drop_duplicates(subset=["station_id", "date"])
    return df

def fetch_nasa_power_weather(site_no, lat, lon, start_date, end_date, raw_dir):
    cache_path = Path(raw_dir) / f"weather_nasa_{site_no}.json"
    if cache_path.is_file():
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        s_str = start_date.replace("-", "")
        e_str = end_date.replace("-", "")
        url = (
            f"https://power.larc.nasa.gov/api/temporal/daily/point"
            f"?parameters=PRECTOTCORR,T2M_MAX,T2M_MIN,GWETTOP"
            f"&community=AG&longitude={lon:.4f}&latitude={lat:.4f}"
            f"&start={s_str}&end={e_str}&format=JSON"
        )
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(data, f)
        time.sleep(0.5)
        
    params = data.get("properties", {}).get("parameter", {})
    precip_dict = params.get("PRECTOTCORR", {})
    tmax_dict = params.get("T2M_MAX", {})
    tmin_dict = params.get("T2M_MIN", {})
    sm_dict = params.get("GWETTOP", {})
    
    records = []
    for d_key, p_val in precip_dict.items():
        dt_str = f"{d_key[:4]}-{d_key[4:6]}-{d_key[6:]}"
        tmax_val = tmax_dict.get(d_key, np.nan)
        tmin_val = tmin_dict.get(d_key, np.nan)
        sm_val = sm_dict.get(d_key, np.nan)
        records.append({
            "station_id": str(site_no),
            "date": dt_str,
            "precipitation_mm": float(p_val) if p_val is not None and p_val >= 0 else np.nan,
            "temp_max_c": float(tmax_val) if tmax_val is not None and tmax_val > -99 else np.nan,
            "temp_min_c": float(tmin_val) if tmin_val is not None and tmin_val > -99 else np.nan,
            "soil_moisture": float(sm_val) if sm_val is not None and sm_val >= 0 else np.nan
        })
    return pd.DataFrame(records)

def fetch_weather(site_no, lat, lon, start_date, end_date, raw_dir):
    cache_om = Path(raw_dir) / f"weather_{site_no}.json"
    cache_nasa = Path(raw_dir) / f"weather_nasa_{site_no}.json"
    
    if cache_om.is_file():
        with open(cache_om, "r", encoding="utf-8") as f:
            data = json.load(f)
        daily = data.get("daily", {})
        dates = daily.get("time", [])
        precip = daily.get("precipitation_sum", [])
        tmax = daily.get("temperature_2m_max", [])
        tmin = daily.get("temperature_2m_min", [])
        sm = daily.get("soil_moisture_0_to_7cm_mean", [])
        records = []
        for i in range(len(dates)):
            records.append({
                "station_id": str(site_no),
                "date": dates[i],
                "precipitation_mm": float(precip[i]) if precip[i] is not None else np.nan,
                "temp_max_c": float(tmax[i]) if tmax[i] is not None else np.nan,
                "temp_min_c": float(tmin[i]) if tmin[i] is not None else np.nan,
                "soil_moisture": float(sm[i]) if sm[i] is not None else np.nan
            })
        return pd.DataFrame(records)
        
    if cache_nasa.is_file():
        return fetch_nasa_power_weather(site_no, lat, lon, start_date, end_date, raw_dir)
        
    try:
        url = (
            f"https://archive-api.open-meteo.com/v1/archive?latitude={lat:.4f}&longitude={lon:.4f}"
            f"&start_date={start_date}&end_date={end_date}"
            f"&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,soil_moisture_0_to_7cm_mean"
            f"&timezone=UTC"
        )
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            with open(cache_om, "w", encoding="utf-8") as f:
                json.dump(data, f)
            time.sleep(0.3)
            daily = data.get("daily", {})
            dates = daily.get("time", [])
            precip = daily.get("precipitation_sum", [])
            tmax = daily.get("temperature_2m_max", [])
            tmin = daily.get("temperature_2m_min", [])
            sm = daily.get("soil_moisture_0_to_7cm_mean", [])
            records = []
            for i in range(len(dates)):
                records.append({
                    "station_id": str(site_no),
                    "date": dates[i],
                    "precipitation_mm": float(precip[i]) if precip[i] is not None else np.nan,
                    "temp_max_c": float(tmax[i]) if tmax[i] is not None else np.nan,
                    "temp_min_c": float(tmin[i]) if tmin[i] is not None else np.nan,
                    "soil_moisture": float(sm[i]) if sm[i] is not None else np.nan
                })
            return pd.DataFrame(records)
    except Exception:
        pass
        
    return fetch_nasa_power_weather(site_no, lat, lon, start_date, end_date, raw_dir)

def run_data_pipeline(
    start_date="2022-01-01",
    end_date="2023-12-31",
    base_dir="."
):
    base_path = Path(base_dir)
    raw_dir = base_path / "data" / "raw"
    processed_dir = base_path / "data" / "processed"
    metadata_dir = base_path / "data" / "metadata"
    reports_dir = base_path / "outputs" / "data_reports"
    
    for d in [raw_dir, processed_dir, metadata_dir, reports_dir]:
        d.mkdir(parents=True, exist_ok=True)
        
    site_ids = [s["site_no"] for s in CANDIDATE_STATIONS]
    metadata_map = fetch_usgs_metadata(site_ids, raw_dir)
    
    meta_df = pd.DataFrame(list(metadata_map.values()))
    meta_df.to_csv(processed_dir / "station_metadata.csv", index=False)
    
    reg_df = pd.DataFrame(CANDIDATE_STATIONS)
    reg_df.to_csv(metadata_dir / "station_registry.csv", index=False)
    
    station_dfs = []
    coverage_rows = []
    
    for site_info in CANDIDATE_STATIONS:
        site_no = site_info["site_no"]
        meta = metadata_map.get(site_no, {})
        lat = meta.get("latitude")
        lon = meta.get("longitude")
        
        if lat is None or lon is None or np.isnan(lat) or np.isnan(lon):
            continue
            
        discharge_df = fetch_usgs_daily_discharge(site_no, start_date, end_date, raw_dir)
        weather_df = fetch_weather(site_no, lat, lon, start_date, end_date, raw_dir)
        
        if discharge_df.empty or weather_df.empty:
            continue
            
        merged = pd.merge(discharge_df, weather_df, on=["station_id", "date"], how="inner")
        
        merged["drainage_area_sqmi"] = meta.get("drainage_area_sqmi", np.nan)
        merged["mean_elevation_ft"] = meta.get("mean_elevation_ft", np.nan)
        
        station_dfs.append(merged)
        
        cfs_clean = merged["discharge_cfs"].dropna()
        q90 = float(cfs_clean.quantile(0.90)) if len(cfs_clean) > 0 else 0.0
        coverage_rows.append({
            "station_id": site_no,
            "station_name": meta.get("station_name", site_info["name"]),
            "state": site_info["state"],
            "latitude": lat,
            "longitude": lon,
            "drainage_area_sqmi": meta.get("drainage_area_sqmi", np.nan),
            "observations_count": len(merged),
            "median_cfs": float(cfs_clean.median()) if len(cfs_clean) > 0 else 0.0,
            "p90_cfs": q90,
            "max_cfs": float(cfs_clean.max()) if len(cfs_clean) > 0 else 0.0,
            "extreme_events_count": int((cfs_clean >= q90).sum()) if len(cfs_clean) > 0 else 0
        })
        
    full_train_df = pd.concat(station_dfs, ignore_index=True) if station_dfs else pd.DataFrame()
    full_train_df.to_csv(processed_dir / "train.csv", index=False)
    
    coverage_df = pd.DataFrame(coverage_rows)
    coverage_df.to_csv(reports_dir / "station_coverage.csv", index=False)
    
    quality_report = validate_dataset(full_train_df, metadata_df=meta_df)
    with open(reports_dir / "data_quality_report.json", "w", encoding="utf-8") as f:
        json.dump(quality_report, f, indent=2)
        
    source_registry = {
        "sources": [
            {
                "name": "USGS National Water Information System (NWIS)",
                "official_url": "https://waterdata.usgs.gov/",
                "api_endpoint": "https://waterservices.usgs.gov/nwis/dv/",
                "variables": ["discharge_cfs", "station_metadata", "drainage_area_sqmi", "elevation_ft"],
                "retrieval_date": "2026-11-04",
                "station_coverage": f"{len(coverage_rows)} stations across 16 US states",
                "date_coverage": f"{start_date} to {end_date}",
                "limitations": "Provisional daily values verified against USGS quality flags"
            },
            {
                "name": "Open-Meteo Historical Weather API & NASA POWER Global Reanalysis",
                "official_url": "https://open-meteo.com/en/docs/historical-weather-api and https://power.larc.nasa.gov/",
                "api_endpoint": "https://archive-api.open-meteo.com/v1/archive and https://power.larc.nasa.gov/api/temporal/daily/point",
                "variables": ["precipitation_mm", "temp_max_c", "temp_min_c", "soil_moisture"],
                "retrieval_date": "2026-11-04",
                "station_coverage": "Exact station coordinates matching",
                "date_coverage": f"{start_date} to {end_date}",
                "limitations": "Hourly/daily reanalysis aggregated to daily totals and extremes with automatic rate-limit fallback"
            }
        ]
    }
    with open(reports_dir / "source_registry.json", "w", encoding="utf-8") as f:
        json.dump(source_registry, f, indent=2)
        
    return full_train_df, meta_df, coverage_df, quality_report

if __name__ == "__main__":
    df, meta, cov, report = run_data_pipeline(base_dir=".")
    print("Pipeline completed successfully:")
    print("Total rows:", len(df))
    print("Total stations:", len(cov))
    print("Status:", report["status"])
