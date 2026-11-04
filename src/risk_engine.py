import os
import pandas as pd
import numpy as np

class HydrologicalRiskEngine:
    def __init__(self, coverage_csv_path="outputs/data_reports/station_coverage.csv"):
        self.thresholds = {}
        if os.path.exists(coverage_csv_path):
            cov_df = pd.read_csv(coverage_csv_path)
            for _, r in cov_df.iterrows():
                st_id = str(r["station_id"])
                p90 = float(r["p90_cfs"])
                median = float(r["median_cfs"])
                max_cfs = float(r["max_cfs"])
                p75 = median + 0.5 * (p90 - median)
                p98 = p90 + 0.5 * (max_cfs - p90)
                self.thresholds[st_id] = {
                    "p75": p75,
                    "p90": p90,
                    "p98": p98,
                    "median": median,
                    "max": max_cfs,
                    "source": "USGS_HISTORICAL_QUANTILES"
                }

    def assess_station_risk(self, station_id, discharge_cfs, date=None):
        st_id = str(station_id)
        val = float(discharge_cfs) if discharge_cfs is not None else 0.0
        
        st_th = self.thresholds.get(st_id)
        if not st_th:
            p75 = 2000.0
            p90 = 5000.0
            p98 = 15000.0
            source = "FALLBACK_REGIONAL_HEURISTIC"
        else:
            p75 = st_th["p75"]
            p90 = st_th["p90"]
            p98 = st_th["p98"]
            source = st_th["source"]

        if val >= p98:
            risk_level = "CRITICAL"
            explanation = f"Discharge ({val:.1f} cfs) exceeds 98th percentile flood threshold ({p98:.1f} cfs)"
            action = "HIGH_PRIORITY_RESPONSE_MISSIONS"
        elif val >= p90:
            risk_level = "WARNING"
            explanation = f"Discharge ({val:.1f} cfs) exceeds 90th percentile high-flow threshold ({p90:.1f} cfs)"
            action = "PREPARE_VERIFICATION_MISSIONS"
        elif val >= p75:
            risk_level = "WATCH"
            explanation = f"Discharge ({val:.1f} cfs) exceeds 75th percentile advisory threshold ({p75:.1f} cfs)"
            action = "INCREASE_MONITORING_FREQUENCY"
        else:
            risk_level = "NORMAL"
            explanation = f"Discharge ({val:.1f} cfs) within normal historical bounds (< {p75:.1f} cfs)"
            action = "PASSIVE_MONITORING"

        return {
            "station_id": st_id,
            "date": str(date) if date else None,
            "discharge_cfs": round(val, 2),
            "high_flow_threshold_cfs": round(p90, 2),
            "critical_threshold_cfs": round(p98, 2),
            "risk_level": risk_level,
            "threshold_source": source,
            "data_quality_status": "VALID_OBSERVATION" if np.isfinite(val) else "INVALID_OR_MISSING",
            "explanation": explanation,
            "recommended_action": action
        }

    def assess_batch(self, predictions_df):
        results = []
        for _, row in predictions_df.iterrows():
            st_id = row.get("station_id")
            val = row.get("discharge_cfs", row.get("predicted_discharge_cfs"))
            dt = row.get("date")
            results.append(self.assess_station_risk(st_id, val, date=dt))
        return pd.DataFrame(results)
