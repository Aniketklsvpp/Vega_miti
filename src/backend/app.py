from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd
from pathlib import Path

from src.prediction_service import PredictionService
from src.risk_engine import FloodRiskEngine
from src.hydrological_evaluation import HydrologicalEvaluator
from src.swarm_api import router as swarm_router

app = FastAPI(
    title="VEGA-MITI Unified Hydrology & Swarm Intelligence Platform",
    description="Unified API combining river discharge prediction, flood risk evaluation, and DELTA-SWARM autonomous multi-agent simulation.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pred_service = PredictionService()
risk_engine = FloodRiskEngine()
evaluator = HydrologicalEvaluator()

class PredictionRequest(BaseModel):
    station_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    config: Optional[str] = "A"
    records: Optional[List[Dict[str, Any]]] = None

def make_envelope(data=None, error=None, status="success"):
    if error:
        return {"status": "error", "error": error}
    return {"status": status, "data": data}

@app.get("/api/health")
def get_health():
    return make_envelope(data={
        "status": "HEALTHY",
        "service": "VEGA-MITI Unified Backend",
        "swarm_simulation": "ACTIVE",
        "models_loaded": {
            "config_a": pred_service.model_a is not None,
            "config_b": pred_service.model_b is not None
        },
        "hydrology_calibrated_stations": len(risk_engine.station_thresholds)
    })

@app.get("/api/stations")
def get_stations():
    df_meta = pred_service._get_station_metadata()
    if df_meta.empty:
        df_train = pred_service._get_train_data()
        unique_st = sorted(df_train["station_id"].unique())
        df_meta = pd.DataFrame([{"station_id": s, "station_name": f"Station {s}"} for s in unique_st])
        
    df_meta["station_id"] = df_meta["station_id"].astype(str).str.zfill(8)
    if risk_engine.station_thresholds:
        df_meta = df_meta[df_meta["station_id"].isin(risk_engine.station_thresholds.keys())]
    stations_list = []
    
    for _, row in df_meta.iterrows():
        st_id = str(row["station_id"])
        thresh = risk_engine.get_thresholds_for_station(st_id)
        st_name = str(row.get("station_name", ""))
        
        river_name = "River"
        if "RIVER" in st_name.upper():
            parts = st_name.upper().split("RIVER")
            river_name = (parts[0].strip() + " RIVER").title()
        elif "CREEK" in st_name.upper():
            parts = st_name.upper().split("CREEK")
            river_name = (parts[0].strip() + " CREEK").title()
        elif "RUN" in st_name.upper():
            parts = st_name.upper().split("RUN")
            river_name = (parts[0].strip() + " RUN").title()

        stations_list.append({
            "station_id": st_id,
            "station_name": st_name,
            "river_name": river_name,
            "state": str(row.get("state", "")),
            "latitude": float(row.get("latitude", 0.0)),
            "longitude": float(row.get("longitude", 0.0)),
            "drainage_area_sqmi": float(row.get("drainage_area_sqmi", 0.0)) if pd.notna(row.get("drainage_area_sqmi")) else None,
            "mean_elevation_ft": float(row.get("mean_elevation_ft", 0.0)) if pd.notna(row.get("mean_elevation_ft")) else None,
            "thresholds": {
                "median_cfs": thresh["median"],
                "watch_p90_cfs": thresh["watch"],
                "warning_p95_cfs": thresh["warning"],
                "critical_p99_cfs": thresh["critical"]
            }
        })
        
    return make_envelope(data={
        "total_stations": len(stations_list),
        "stations": stations_list
    })

@app.get("/api/stations/{station_id}/history")
def get_station_history(
    station_id: str,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    df_all = pred_service._get_train_data()
    sub = df_all[df_all["station_id"].astype(str) == str(station_id).strip()].copy()
    
    if sub.empty:
        raise HTTPException(status_code=404, detail=f"Station '{station_id}' not found.")
        
    sub["date"] = pd.to_datetime(sub["date"], errors="coerce")
    if start_date:
        sub = sub[sub["date"] >= pd.to_datetime(start_date)]
    if end_date:
        sub = sub[sub["date"] <= pd.to_datetime(end_date)]
        
    sub = sub.sort_values("date").reset_index(drop=True)
    history_records = []
    
    for _, row in sub.iterrows():
        dt_str = row["date"].strftime("%Y-%m-%d")
        discharge = float(row["discharge_cfs"]) if pd.notna(row.get("discharge_cfs")) else None
        risk_info = risk_engine.classify_discharge(station_id, discharge, date=dt_str) if discharge is not None else None
        
        history_records.append({
            "station_id": str(station_id),
            "date": dt_str,
            "discharge_cfs": discharge,
            "precipitation_mm": float(row["precipitation_mm"]) if pd.notna(row.get("precipitation_mm")) else None,
            "temp_max_c": float(row["temp_max_c"]) if pd.notna(row.get("temp_max_c")) else None,
            "temp_min_c": float(row["temp_min_c"]) if pd.notna(row.get("temp_min_c")) else None,
            "soil_moisture": float(row["soil_moisture"]) if pd.notna(row.get("soil_moisture")) else None,
            "risk_level": risk_info["risk_level"] if risk_info else "UNKNOWN"
        })
        
    return make_envelope(data={
        "station_id": str(station_id),
        "record_count": len(history_records),
        "history": history_records
    })

@app.post("/api/predict")
def post_predict(req: PredictionRequest):
    if req.records and len(req.records) > 0:
        custom_df = pd.DataFrame(req.records)
        res = pred_service.predict_custom(custom_df, config=req.config or "A")
    elif req.station_id:
        res = pred_service.predict_station(
            station_id=req.station_id,
            start_date=req.start_date,
            end_date=req.end_date,
            config=req.config or "A"
        )
    else:
        raise HTTPException(status_code=400, detail="Must provide either station_id or records list.")
        
    if res["status"] == "error":
        raise HTTPException(status_code=400, detail=res["error"])
        
    preds = res["data"]["predictions"]
    for p in preds:
        pred_risk = risk_engine.classify_discharge(p["station_id"], p["predicted_discharge_cfs"], date=p["date"])
        p["predicted_risk_level"] = pred_risk["risk_level"]
        p["risk_level"] = pred_risk["risk_level"]
        p["risk_explanation"] = pred_risk["explanation"]
        p["thresholds"] = pred_risk["thresholds"]
        p["high_flow_threshold_cfs"] = pred_risk["high_flow_threshold_cfs"]
        p["critical_threshold_cfs"] = pred_risk["critical_threshold_cfs"]
        p["threshold_type"] = pred_risk["threshold_type"]
        p["regulatory_disclaimer"] = pred_risk["regulatory_disclaimer"]
        p["recommended_action"] = pred_risk["recommended_action"]
        
        if p.get("actual_discharge_cfs") is not None and pd.notna(p["actual_discharge_cfs"]):
            obs_risk = risk_engine.classify_discharge(p["station_id"], p["actual_discharge_cfs"], date=p["date"])
            p["observed_risk_level"] = obs_risk["risk_level"]
            p["observed_recommended_action"] = obs_risk["recommended_action"]
            p["risk_basis_discrepancy"] = "MISMATCH" if pred_risk["risk_level"] != obs_risk["risk_level"] else "ALIGNED"
        else:
            p["observed_risk_level"] = None
            p["observed_recommended_action"] = None
            p["risk_basis_discrepancy"] = "OBSERVATION_UNAVAILABLE"
        
    return make_envelope(data=res["data"])

@app.get("/api/risk/{station_id}")
def get_station_risk(
    station_id: str,
    basis: Optional[str] = Query("observed"),
    date: Optional[str] = Query(None)
):
    df_all = pred_service._get_train_data()
    sub = df_all[df_all["station_id"].astype(str) == str(station_id).strip()]
    if sub.empty:
        raise HTTPException(status_code=404, detail=f"Station '{station_id}' not found.")
        
    if date:
        date_sub = sub[sub["date"].astype(str) == str(date).strip()]
        if not date_sub.empty:
            sub = date_sub
            
    latest_row = sub.sort_values("date").iloc[-1]
    actual_discharge = float(latest_row["discharge_cfs"]) if pd.notna(latest_row.get("discharge_cfs")) else None
    dt_str = str(latest_row["date"])
    
    pred_res = pred_service.predict_station(station_id, start_date=dt_str, end_date=dt_str, config="A")
    pred_val = pred_res["data"]["predictions"][0]["predicted_discharge_cfs"] if pred_res.get("status") == "success" and pred_res.get("data", {}).get("predictions") else None
    
    eval_discharge = pred_val if str(basis).lower() == "predicted" else actual_discharge
    risk_info = risk_engine.classify_discharge(station_id, eval_discharge, date=dt_str)
    
    obs_risk = risk_engine.classify_discharge(station_id, actual_discharge)
    pred_risk = risk_engine.classify_discharge(station_id, pred_val)

    risk_info["assessment_basis"] = "PREDICTED" if str(basis).lower() == "predicted" else "OBSERVED"
    risk_info["actual_discharge_cfs"] = round(actual_discharge, 2) if actual_discharge is not None else None
    risk_info["predicted_discharge_cfs"] = round(pred_val, 2) if pred_val is not None else None
    risk_info["flow_value_evaluated_cfs"] = round(eval_discharge, 2) if eval_discharge is not None else None
    risk_info["flow_value_source"] = "ml_model_config_a" if str(basis).lower() == "predicted" else "observed_gauge"
    risk_info["observed_risk_level"] = obs_risk["risk_level"]
    risk_info["predicted_risk_level"] = pred_risk["risk_level"]

    if obs_risk["risk_level"] == "UNKNOWN" or pred_risk["risk_level"] == "UNKNOWN":
        risk_info["risk_basis_discrepancy"] = "INSUFFICIENT_DATA"
        risk_info["discrepancy_note"] = "Hydrological sensor telemetry or model prediction unavailable."
    elif obs_risk["risk_level"] != pred_risk["risk_level"]:
        risk_info["risk_basis_discrepancy"] = "MISMATCH"
        risk_info["discrepancy_note"] = f"Observed risk is {obs_risk['risk_level']} while predicted risk is {pred_risk['risk_level']}."
    else:
        risk_info["risk_basis_discrepancy"] = "ALIGNED"
        risk_info["discrepancy_note"] = "Observed and predicted risk assessments are aligned."
    
    return make_envelope(data=risk_info)

@app.get("/api/evaluation/hydrology")
def get_hydrology_evaluation(config: str = Query("A")):
    report_file = Path("outputs/data_reports/hydrological_evaluation_report.json")
    if report_file.is_file():
        import json
        with open(report_file, "r", encoding="utf-8") as f:
            rep = json.load(f)
        if rep.get("model_configuration", "").upper() == config.upper():
            return make_envelope(data=rep)
            
    rep = evaluator.run_full_evaluation(config=config)
    return make_envelope(data=rep)


app.include_router(swarm_router)
