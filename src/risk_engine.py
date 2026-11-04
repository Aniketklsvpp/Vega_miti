import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any, Optional

class FloodRiskEngine:
    def __init__(self, data_path: Optional[str] = None, train_path: Optional[str] = None):
        self.default_thresholds = {
            "watch": 25000.0,
            "warning": 50000.0,
            "critical": 100000.0
        }
        self.station_thresholds = {}
        target_path = data_path or train_path or "data/processed/train.csv"
        if target_path and Path(target_path).is_file():
            self._calibrate_from_historical_data(target_path)

    def _calibrate_from_historical_data(self, csv_path: str):
        try:
            df = pd.read_csv(csv_path)
            if "station_id" not in df.columns or "discharge_cfs" not in df.columns:
                return
            df["station_id"] = df["station_id"].astype(str).str.zfill(8)
            for st, grp in df.groupby("station_id"):
                q = grp["discharge_cfs"].dropna()
                if len(q) < 10:
                    continue
                p50 = float(np.percentile(q, 50))
                p90 = float(np.percentile(q, 90))
                p95 = float(np.percentile(q, 95))
                p99 = float(np.percentile(q, 99))
                q_max = float(q.max())
                self.station_thresholds[st] = {
                    "median": p50,
                    "watch": p90,
                    "warning": p95,
                    "critical": p99,
                    "max": q_max,
                    "source": "HISTORICAL_PERCENTILES",
                    "is_provisional": False
                }
        except Exception:
            pass

    def get_thresholds_for_station(self, station_id: str) -> Dict[str, Any]:
        st_clean = str(station_id).strip()
        if st_clean in self.station_thresholds:
            return self.station_thresholds[st_clean]
        return {
            "median": 1000.0,
            "watch": self.default_thresholds["watch"],
            "warning": self.default_thresholds["warning"],
            "critical": self.default_thresholds["critical"],
            "max": 50000.0,
            "source": "PROVISIONAL_DEFAULT_DEMONSTRATION_THRESHOLD",
            "is_provisional": True
        }

    def classify_discharge(self, station_id, discharge_cfs, date=None, data_quality_status=None):
        st_clean = str(station_id).strip()
        thresh = self.get_thresholds_for_station(st_clean)
        
        is_valid = pd.notna(discharge_cfs)
        if is_valid:
            try:
                q_val = float(discharge_cfs)
                if not np.isfinite(q_val):
                    is_valid = False
            except (ValueError, TypeError):
                is_valid = False

        if not is_valid:
            return {
                "station_id": st_clean,
                "date": str(date) if date is not None else None,
                "discharge_cfs": None,
                "high_flow_threshold_cfs": round(thresh["watch"], 2),
                "critical_threshold_cfs": round(thresh["critical"], 2),
                "risk_level": "UNKNOWN",
                "risk_state": "INSUFFICIENT_DATA",
                "confidence_score": 0.0,
                "risk_score": 0.0,
                "threshold_type": "EMPIRICAL_DEMONSTRATION",
                "regulatory_disclaimer": "Empirical demonstration thresholds based on 2022-2023 historical distribution percentiles (P90/P95/P99). NOT certified NWS/NOAA or official flood warning stages. Swarm agent activities are simulated research models on a discrete 20x20 grid, not actual drone dispatches or emergency management interventions.",
                "thresholds": {
                    "watch_p90_cfs": round(thresh["watch"], 2),
                    "warning_p95_cfs": round(thresh["warning"], 2),
                    "critical_p99_cfs": round(thresh["critical"], 2),
                    "median_cfs": round(thresh["median"], 2)
                },
                "threshold_source": thresh["source"],
                "is_provisional": thresh["is_provisional"],
                "data_quality_status": "INVALID_OR_MISSING",
                "evidence_quality": "DEGRADED",
                "explanation": "Discharge measurement is missing, null, or invalid. Risk state is UNKNOWN due to insufficient data.",
                "recommended_action": "REQUEST_IMMEDIATE_SENSOR_TELEMETRY"
            }

        q_val = float(discharge_cfs)
        if q_val >= thresh["critical"]:
            risk_level = "CRITICAL"
            explanation = (
                f"Discharge ({q_val:,.1f} cfs) meets or exceeds the empirical demonstration CRITICAL threshold "
                f"({thresh['critical']:,.1f} cfs, 99th percentile). Severe high-flow conditions indicated."
            )
            action = "SIMULATED_HIGH_PRIORITY_SURVEY_MISSIONS"
        elif q_val >= thresh["warning"]:
            risk_level = "WARNING"
            explanation = (
                f"Discharge ({q_val:,.1f} cfs) meets or exceeds the empirical demonstration WARNING threshold "
                f"({thresh['warning']:,.1f} cfs, 95th percentile). Elevated high-flow event in progress."
            )
            action = "SIMULATED_VERIFICATION_MISSIONS"
        elif q_val >= thresh["watch"]:
            risk_level = "WATCH"
            explanation = (
                f"Discharge ({q_val:,.1f} cfs) meets or exceeds the empirical demonstration WATCH threshold "
                f"({thresh['watch']:,.1f} cfs, 90th percentile). Flow is elevated above normal seasonal baseline."
            )
            action = "INCREASE_SIMULATED_MONITORING_FREQUENCY"
        else:
            risk_level = "NORMAL"
            explanation = (
                f"Discharge ({q_val:,.1f} cfs) is below empirical demonstration WATCH threshold "
                f"({thresh['watch']:,.1f} cfs). Normal river conditions."
            )
            action = "PASSIVE_MONITORING"

        quality_status = "VALID_OBSERVATION" if is_valid else "INVALID_OR_MISSING"
        if data_quality_status and data_quality_status != "VALID":
            quality_status = "DEGRADED"

        return {
            "station_id": st_clean,
            "date": str(date) if date is not None else None,
            "discharge_cfs": round(q_val, 2),
            "high_flow_threshold_cfs": round(thresh["watch"], 2),
            "critical_threshold_cfs": round(thresh["critical"], 2),
            "risk_level": risk_level,
            "threshold_type": "EMPIRICAL_DEMONSTRATION",
            "regulatory_disclaimer": "Empirical demonstration thresholds based on 2022-2023 historical distribution percentiles (P90/P95/P99). NOT certified NWS/NOAA or official flood warning stages. Swarm agent activities are simulated research models on a discrete 20x20 grid, not actual drone dispatches or emergency management interventions.",
            "thresholds": {
                "watch_p90_cfs": round(thresh["watch"], 2),
                "warning_p95_cfs": round(thresh["warning"], 2),
                "critical_p99_cfs": round(thresh["critical"], 2),
                "median_cfs": round(thresh["median"], 2)
            },
            "threshold_source": thresh["source"],
            "is_provisional": thresh["is_provisional"],
            "data_quality_status": quality_status,
            "evidence_quality": "HIGH" if quality_status == "VALID_OBSERVATION" else "DEGRADED",
            "confidence_score": 1.0 if not thresh["is_provisional"] else 0.70,
            "explanation": explanation,
            "recommended_action": action
        }

    def assess_station_risk(self, station_id, discharge_cfs, date=None):
        return self.classify_discharge(station_id, discharge_cfs, date=date)

    def assess_batch(self, predictions_df):
        results = []
        for _, row in predictions_df.iterrows():
            st_id = row.get("station_id")
            val = row.get("discharge_cfs", row.get("predicted_discharge_cfs"))
            dt = row.get("date")
            results.append(self.assess_station_risk(st_id, val, date=dt))
        return pd.DataFrame(results)

    def detect_risk_transition(self, prev_risk_level, current_risk_level):
        hierarchy = {"NORMAL": 0, "WATCH": 1, "WARNING": 2, "CRITICAL": 3}
        prev_idx = hierarchy.get(str(prev_risk_level).upper(), 0)
        curr_idx = hierarchy.get(str(current_risk_level).upper(), 0)

        if curr_idx > prev_idx:
            status = "ESCALATION"
        elif curr_idx < prev_idx:
            status = "REDUCTION"
        else:
            status = "STEADY"

        return {
            "previous_risk": prev_risk_level,
            "current_risk": current_risk_level,
            "transition": status,
            "severity_delta": curr_idx - prev_idx
        }

HydrologicalRiskEngine = FloodRiskEngine
