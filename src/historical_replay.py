import os
import pandas as pd
from typing import Dict, List, Any, Optional

from src.risk_engine import FloodRiskEngine
from src.swarm_activation import SwarmActivationEngine
from src.swarm_simulator import SwarmCoordinator

HISTORICAL_EVENTS_CATALOG = {
    "EVENT-IN-YAMUNA-2023": {
        "event_id": "EVENT-IN-YAMUNA-2023",
        "title": "2023 Yamuna River Mega-Flood (Delhi Basin, India)",
        "country": "India",
        "state_or_region": "National Capital Territory of Delhi / Haryana",
        "river": "Yamuna River (Upper Yamuna Basin)",
        "start_date": "2023-07-07",
        "end_date": "2023-07-18",
        "peak_date": "2023-07-13",
        "primary_gauge_station": {
            "station_id": "YMN-DEL-ORB-01",
            "station_name": "Old Railway Bridge (ORB), Delhi",
            "river_name": "Yamuna River",
            "latitude": 28.663,
            "longitude": 77.234,
            "warning_level_m": 204.50,
            "danger_level_m": 205.33,
            "prior_all_time_record_m": 207.49,
            "observed_crest_level_m": 208.66
        },
        "upstream_barrage": {
            "station_id": "YMN-HAR-HKB-01",
            "station_name": "Hathnikund Barrage, Yamunanagar, Haryana",
            "latitude": 30.315,
            "longitude": 77.583,
            "peak_barrage_release_cfs": 359000.0
        },
        "data_provenance": "CWC (Central Water Commission) Daily Flood Bulletins & IMD (India Meteorological Department) Monsoon Precipitation Records",
        "is_partial_record": False,
        "regulatory_disclaimer": "Historical gauge levels (meters MSL) and barrage releases (cfs) derived from CWC/IMD official public archives. Swarm movements, routes, and leases are simulated research demonstrations on a 20x20 grid.",
        "timeline_data": [
            {
                "date": "2023-07-07",
                "phase": "BEFORE_FLOOD",
                "rainfall_mm": 12.5,
                "water_level_m": 203.40,
                "upstream_release_cfs": 42000.0,
                "key_observation": "Normal pre-monsoon flow; water level 1.1m below warning mark"
            },
            {
                "date": "2023-07-08",
                "phase": "RISING_RISK",
                "rainfall_mm": 126.1,
                "water_level_m": 204.10,
                "upstream_release_cfs": 85000.0,
                "key_observation": "Intense torrential downpour starts across Delhi NCR and Himachal hills"
            },
            {
                "date": "2023-07-09",
                "phase": "RISING_RISK",
                "rainfall_mm": 153.0,
                "water_level_m": 204.85,
                "upstream_release_cfs": 145000.0,
                "key_observation": "Highest 24h July rainfall in Delhi since 1982; Yamuna crosses Warning Level (204.50m)"
            },
            {
                "date": "2023-07-10",
                "phase": "RISING_RISK",
                "rainfall_mm": 42.0,
                "water_level_m": 205.76,
                "upstream_release_cfs": 216000.0,
                "key_observation": "River breaches Danger Level (205.33m); Hathnikund release exceeds 200,000 cfs"
            },
            {
                "date": "2023-07-11",
                "phase": "HIGH_RISK_PEAK",
                "rainfall_mm": 18.0,
                "water_level_m": 206.71,
                "upstream_release_cfs": 359000.0,
                "key_observation": "Peak barrage release from Hathnikund surges downstream toward national capital"
            },
            {
                "date": "2023-07-12",
                "phase": "HIGH_RISK_PEAK",
                "rainfall_mm": 5.0,
                "water_level_m": 207.71,
                "upstream_release_cfs": 180000.0,
                "key_observation": "Breaches historic 1978 record of 207.49m; Ring Road and Monastery Market flooded"
            },
            {
                "date": "2023-07-13",
                "phase": "HIGH_RISK_PEAK",
                "rainfall_mm": 2.0,
                "water_level_m": 208.66,
                "upstream_release_cfs": 95000.0,
                "key_observation": "All-time historical crest of 208.66m recorded at 18:00 IST; Red Fort perimeter inundated"
            },
            {
                "date": "2023-07-14",
                "phase": "HIGH_RISK_PEAK",
                "rainfall_mm": 0.0,
                "water_level_m": 208.20,
                "upstream_release_cfs": 58000.0,
                "key_observation": "High-water plateau holds across central Delhi embankments; flood regulators breached"
            },
            {
                "date": "2023-07-15",
                "phase": "RECESSION",
                "rainfall_mm": 8.0,
                "water_level_m": 207.45,
                "upstream_release_cfs": 44000.0,
                "key_observation": "Water recedes below 1978 benchmark; army and rescue teams seal WHO building regulator"
            },
            {
                "date": "2023-07-16",
                "phase": "RECESSION",
                "rainfall_mm": 1.0,
                "water_level_m": 206.30,
                "upstream_release_cfs": 38000.0,
                "key_observation": "Gradual draining toward Okhla; traffic reopens on higher arterial roads"
            },
            {
                "date": "2023-07-17",
                "phase": "RECOVERY",
                "rainfall_mm": 0.0,
                "water_level_m": 205.20,
                "upstream_release_cfs": 32000.0,
                "key_observation": "Water drops below Danger Level (205.33m); post-event structural surveys underway"
            },
            {
                "date": "2023-07-18",
                "phase": "RECOVERY",
                "rainfall_mm": 0.0,
                "water_level_m": 204.30,
                "upstream_release_cfs": 28000.0,
                "key_observation": "Water returns below Warning Level (204.50m); de-escalation complete"
            }
        ]
    },
    "EVENT-US-SUSQUEHANNA-2023": {
        "event_id": "EVENT-US-SUSQUEHANNA-2023",
        "title": "December 2023 Susquehanna River Flood Event (Harrisburg, PA, US)",
        "country": "United States",
        "state_or_region": "Pennsylvania",
        "river": "Susquehanna River",
        "start_date": "2023-12-14",
        "end_date": "2023-12-26",
        "peak_date": "2023-12-20",
        "primary_gauge_station": {
            "station_id": "01570500",
            "station_name": "Susquehanna River at Harrisburg, PA",
            "river_name": "Susquehanna River",
            "latitude": 40.252,
            "longitude": -76.883,
            "drainage_area_sqmi": 24100.0,
            "mean_elevation_ft": 289.4
        },
        "data_provenance": "USGS NWIS Station 01570500 (data/processed/train.csv) & NASA POWER Daily Meteorology",
        "is_partial_record": False,
        "regulatory_disclaimer": "Historical observations from USGS NWIS verified records. Research simulation on discrete 20x20 grid.",
        "timeline_data": []
    }
}

class HistoricalReplayEngine:
    def __init__(self, train_path: str = "data/processed/train.csv"):
        self.risk_engine = FloodRiskEngine(train_path=train_path)
        self.activation_engine = SwarmActivationEngine()
        self._populate_us_timeline(train_path)

    def _populate_us_timeline(self, train_path: str):
        if not os.path.exists(train_path):
            return
        df = pd.read_csv(train_path, dtype={"station_id": str})
        sub = df[(df["station_id"] == "01570500") & (df["date"] >= "2023-12-14") & (df["date"] <= "2023-12-26")].sort_values("date")
        
        timeline = []
        for _, r in sub.iterrows():
            dt = str(r["date"])
            q = float(r["discharge_cfs"])
            precip = float(r["precipitation_mm"])
            
            if dt in ("2023-12-14", "2023-12-15", "2023-12-16"):
                phase = "BEFORE_FLOOD"
                obs = "Advisory winter baseflow; dry conditions preceding frontal storm"
            elif dt in ("2023-12-17", "2023-12-18"):
                phase = "RISING_RISK"
                obs = f"Intense atmospheric river system brings heavy rainfall ({precip:.1f} mm); basin saturated"
            elif dt in ("2023-12-19", "2023-12-20", "2023-12-21"):
                phase = "HIGH_RISK_PEAK"
                obs = f"Runoff convergence causes massive discharge crest ({q:,.0f} cfs); river exceeds historical 99th percentile"
            elif dt in ("2023-12-22", "2023-12-23"):
                phase = "RECESSION"
                obs = "Discharge recedes from flood crest; cold front stabilizes catchment"
            else:
                phase = "RECOVERY"
                obs = "Flow normalizes toward seasonal median; post-event inspection"

            timeline.append({
                "date": dt,
                "phase": phase,
                "rainfall_mm": round(precip, 2),
                "discharge_cfs": round(q, 2),
                "temp_max_c": float(r["temp_max_c"]) if pd.notna(r.get("temp_max_c")) else None,
                "temp_min_c": float(r["temp_min_c"]) if pd.notna(r.get("temp_min_c")) else None,
                "key_observation": obs
            })
        HISTORICAL_EVENTS_CATALOG["EVENT-US-SUSQUEHANNA-2023"]["timeline_data"] = timeline

    def get_available_events(self) -> List[Dict[str, Any]]:
        events = []
        for eid, item in HISTORICAL_EVENTS_CATALOG.items():
            events.append({
                "event_id": item["event_id"],
                "title": item["title"],
                "country": item["country"],
                "state_or_region": item["state_or_region"],
                "river": item["river"],
                "start_date": item["start_date"],
                "end_date": item["end_date"],
                "peak_date": item["peak_date"],
                "primary_station_id": item["primary_gauge_station"]["station_id"],
                "primary_station_name": item["primary_gauge_station"]["station_name"],
                "latitude": item["primary_gauge_station"]["latitude"],
                "longitude": item["primary_gauge_station"]["longitude"],
                "total_days": len(item["timeline_data"]),
                "data_provenance": item["data_provenance"],
                "is_partial_record": item["is_partial_record"],
                "regulatory_disclaimer": item["regulatory_disclaimer"]
            })
        return events

    def get_event_metadata(self, event_id: str) -> Optional[Dict[str, Any]]:
        ev = HISTORICAL_EVENTS_CATALOG.get(event_id)
        if not ev:
            return None
        res = dict(ev)
        res["total_timeline_steps"] = len(ev["timeline_data"])
        return res

    def _assess_event_row(self, event_id: str, row: Dict[str, Any]) -> Dict[str, Any]:
        dt = row["date"]
        if event_id == "EVENT-IN-YAMUNA-2023":
            st_id = "YMN-DEL-ORB-01"
            level_m = row.get("water_level_m", 204.0)
            release_cfs = row.get("upstream_release_cfs", 40000.0)
            
            if level_m >= 206.5 or release_cfs >= 300000.0:
                lvl = "CRITICAL"
                expl = f"Water level ({level_m:.2f} m) and upstream barrage release ({release_cfs:,.0f} cfs) severely breach Danger Level (205.33 m)."
                action = "HIGH_PRIORITY_RESPONSE_MISSIONS"
            elif level_m >= 205.33 or release_cfs >= 200000.0:
                lvl = "WARNING"
                expl = f"Water level ({level_m:.2f} m) exceeds CWC Danger Level (205.33 m). Evacuation and barrier surveillance active."
                action = "PREPARE_VERIFICATION_MISSIONS"
            elif level_m >= 204.50 or release_cfs >= 100000.0:
                lvl = "WATCH"
                expl = f"Water level ({level_m:.2f} m) meets or exceeds CWC Warning Level (204.50 m). Monitoring frequency increased."
                action = "INCREASE_MONITORING_FREQUENCY"
            else:
                lvl = "NORMAL"
                expl = f"Water level ({level_m:.2f} m) remains below CWC Warning Level (204.50 m)."
                action = "PASSIVE_MONITORING"

            return {
                "station_id": st_id,
                "date": dt,
                "water_level_m": level_m,
                "discharge_cfs": release_cfs,
                "risk_level": lvl,
                "threshold_type": "CWC_OFFICIAL_FLOOD_STAGES",
                "warning_level_m": 204.50,
                "danger_level_m": 205.33,
                "highest_recorded_level_m": 208.66,
                "evidence_quality": "HIGH",
                "data_quality_status": "VALID_OBSERVATION",
                "is_provisional": False,
                "explanation": expl,
                "recommended_action": action,
                "regulatory_disclaimer": "CWC published flood levels. Simulation on 20x20 test grid."
            }
        else:
            st_id = "01570500"
            q = row.get("discharge_cfs", 50000.0)
            return self.risk_engine.classify_discharge(st_id, q, date=dt)

    def execute_replay(
        self,
        event_id: str,
        step_index: Optional[int] = None,
        simulate_failure: bool = True
    ) -> Dict[str, Any]:
        ev = HISTORICAL_EVENTS_CATALOG.get(event_id)
        if not ev:
            return {"status": "error", "error": f"Event '{event_id}' not found in catalog."}

        timeline = ev["timeline_data"]
        if not timeline:
            return {"status": "error", "error": f"No timeline data for event '{event_id}'."}

        coordinator = SwarmCoordinator(grid_size=(20, 20), lease_duration_sec=60)
        activation_engine = SwarmActivationEngine()
        steps_to_run = timeline if step_index is None else timeline[:step_index + 1]

        replay_frames = []
        failure_applied = False

        for idx, row in enumerate(steps_to_run):
            dt = row["date"]
            phase = row["phase"]
            assessment = self._assess_event_row(event_id, row)
            
            activation_result = activation_engine.evaluate_activation([assessment])
            current_state = activation_result["current_state"]
            
            for m in activation_result["missions"]:
                coordinator.add_mission(m)

            allocations = coordinator.allocate_missions(strategy="adaptive")

            reassigned_missions = []
            failure_event = None
            if simulate_failure and not failure_applied and phase == "HIGH_RISK_PEAK" and allocations:
                target_agent = allocations[0]["agent_id"]
                coordinator.simulate_agent_disconnect(target_agent)
                reassigned = coordinator.check_heartbeats_and_leases(timeout_sec=0)
                reallocations = coordinator.allocate_missions(strategy="adaptive")
                failure_applied = True
                reassigned_missions = reassigned
                failure_event = {
                    "disconnected_agent": target_agent,
                    "reassigned_missions": reassigned,
                    "reallocations": reallocations
                }

            if phase in ("RECESSION", "RECOVERY"):
                for mid, m in coordinator.missions.items():
                    if m["status"] == "IN_PROGRESS":
                        m["status"] = "COMPLETED"

            snapshot = coordinator.get_swarm_snapshot()

            frame = {
                "step_index": idx,
                "date": dt,
                "timeline_phase": phase,
                "key_observation": row.get("key_observation", ""),
                "historical_metrics": {
                    "rainfall_mm": row.get("rainfall_mm"),
                    "water_level_m": row.get("water_level_m"),
                    "discharge_cfs": row.get("discharge_cfs", row.get("upstream_release_cfs"))
                },
                "risk_assessment": assessment,
                "swarm_state": {
                    "activation_state": current_state,
                    "active_missions_count": snapshot["active_missions_count"],
                    "completed_missions_count": snapshot["completed_missions_count"],
                    "new_missions_generated": activation_result["active_missions_generated"],
                    "allocations_in_step": allocations,
                    "reassigned_in_step": reassigned_missions,
                    "failure_event": failure_event,
                    "agents": snapshot["agents"]
                }
            }
            replay_frames.append(frame)

        latest_frame = replay_frames[-1] if replay_frames else None

        return {
            "status": "success",
            "event_id": event_id,
            "title": ev["title"],
            "country": ev["country"],
            "river": ev["river"],
            "geographic_context": {
                "latitude": ev["primary_gauge_station"]["latitude"],
                "longitude": ev["primary_gauge_station"]["longitude"],
                "primary_station_name": ev["primary_gauge_station"]["station_name"]
            },
            "total_steps": len(timeline),
            "executed_steps_count": len(replay_frames),
            "current_step_frame": latest_frame,
            "timeline_frames": replay_frames
        }
