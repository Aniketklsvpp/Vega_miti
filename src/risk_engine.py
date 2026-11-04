from pathlib import Path
import numpy as np
import pandas as pd

class FloodRiskEngine:
    def __init__(self, train_path="data/processed/train.csv"):
        self.train_path = Path(train_path)
        self.station_thresholds = {}
        self.default_thresholds = {"watch": 5000.0, "warning": 15000.0, "critical": 35000.0}
        self._load_or_compute_thresholds()

    def _load_or_compute_thresholds(self):
        if self.train_path.is_file():
            df = pd.read_csv(self.train_path, dtype={"station_id": str})
            if "station_id" in df.columns and "discharge_cfs" in df.columns:
                for st, group in df.groupby("station_id"):
                    clean = group["discharge_cfs"].dropna()
                    if len(clean) > 0:
                        self.station_thresholds[str(st)] = {
                            "median": float(clean.median()),
                            "watch": float(clean.quantile(0.90)),
                            "warning": float(clean.quantile(0.95)),
                            "critical": float(clean.quantile(0.99)),
                            "max": float(clean.max()),
                            "source": "USGS_HISTORICAL_2022_2023_EMPIRICAL_DEMONSTRATION_PERCENTILES",
                            "is_provisional": False
                        }

    def get_thresholds_for_station(self, station_id):
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
        
        is_valid = pd.notna(discharge_cfs) and np.isfinite(float(discharge_cfs))
        q_val = float(discharge_cfs) if is_valid else 0.0
        
        if q_val >= thresh["critical"]:
            risk_level = "CRITICAL"
            explanation = (
                f"Discharge ({q_val:,.1f} cfs) meets or exceeds the empirical demonstration CRITICAL threshold "
                f"({thresh['critical']:,.1f} cfs, 99th percentile). Severe flood conditions indicated."
            )
            action = "HIGH_PRIORITY_RESPONSE_MISSIONS"
        elif q_val >= thresh["warning"]:
            risk_level = "WARNING"
            explanation = (
                f"Discharge ({q_val:,.1f} cfs) meets or exceeds the empirical demonstration WARNING threshold "
                f"({thresh['warning']:,.1f} cfs, 95th percentile). Elevated high-flow event in progress."
            )
            action = "PREPARE_VERIFICATION_MISSIONS"
        elif q_val >= thresh["watch"]:
            risk_level = "WATCH"
            explanation = (
                f"Discharge ({q_val:,.1f} cfs) meets or exceeds the empirical demonstration WATCH threshold "
                f"({thresh['watch']:,.1f} cfs, 90th percentile). Flow is elevated above normal seasonal baseline."
            )
            action = "INCREASE_MONITORING_FREQUENCY"
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
            "regulatory_disclaimer": "Empirical demonstration thresholds based on 2022-2023 historical distribution percentiles (P90/P95/P99). NOT certified NWS/NOAA or official flood warning stages.",
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
