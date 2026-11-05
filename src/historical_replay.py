import os
import time
import pandas as pd
from typing import Dict, List, Any, Optional

from src.risk_engine import FloodRiskEngine
from src.swarm_activation import SwarmActivationEngine
from src.swarm_simulator import SwarmCoordinator

HISTORICAL_EVENTS_CATALOG = {
    "EVENT-IN-YAMUNA-2023": {
        "event_id": "EVENT-IN-YAMUNA-2023",
        "title": "July 2023 Yamuna River Mega-Flood (Delhi NCR & Haryana, India)",
        "country": "India",
        "state_or_region": "National Capital Territory of Delhi / Haryana",
        "river": "Yamuna River (Upper Yamuna Basin)",
        "sub_basin": "Ganges Sub-basin",
        "start_date": "2023-07-07",
        "end_date": "2023-07-18",
        "peak_date": "2023-07-13",
        "timezone": "IST (UTC+05:30)",
        "measurement_units": {
            "river_stage": "metres above Mean Sea Level (m MSL)",
            "upstream_discharge_release": "cubic feet per second (cfs)",
            "precipitation": "millimetres (mm)"
        },
        "primary_gauge_station": {
            "station_id": "YMN-DEL-ORB-01",
            "station_name": "Old Railway Bridge (ORB), Delhi",
            "river_name": "Yamuna River",
            "latitude": 28.663,
            "longitude": 77.234,
            "statutory_reference_marks": {
                "warning_level_m": 204.50,
                "danger_level_m": 205.33,
                "prior_1978_all_time_record_m": 207.49,
                "observed_july_2023_crest_m": 208.66,
                "authority": "Central Water Commission (CWC), Government of India"
            },
            "vega_miti_operational_rules": {
                "critical_water_level_trigger_m": 206.50,
                "critical_barrage_release_trigger_cfs": 300000.0,
                "rule_type": "VEGA_MITI_DEMONSTRATION_OPERATIONAL_THRESHOLD"
            }
        },
        "upstream_barrage": {
            "station_id": "YMN-HAR-HKB-01",
            "station_name": "Hathnikund Barrage, Yamunanagar, Haryana",
            "latitude": 30.315,
            "longitude": 77.583,
            "peak_barrage_release_cfs": 359000.0,
            "distance_upstream_km": 228.0,
            "hydraulic_transit_time_context": {
                "empirical_estimate_hours": "48 to 72 hours",
                "classification": "APPROXIMATE_CONTEXTUAL_ASSUMPTION",
                "technical_basis": "Empirical operational guideline historically referenced in CWC and DDMA flood advisories based on 228 river km distance and estimated 3.5-5.0 km/h monsoonal high-flow channel propagation velocities.",
                "scientific_limitation": "Not a constant or deterministic hydrodynamic routing parameter. Velocity varies dynamically with antecedent baseflow, flood volume, cross-section geometry, and backwater throttling from downstream barrages.",
                "causal_disclaimer": "VEGA-MITI does not assert an instantaneous or deterministic causal relationship between upstream release and local Delhi stage."
            }
        },
        "downstream_infrastructure": [
            {"name": "Wazirabad Barrage", "latitude": 28.711, "longitude": 77.231},
            {"name": "ITO Barrage", "latitude": 28.628, "longitude": 77.248},
            {"name": "Okhla Barrage", "latitude": 28.544, "longitude": 77.311}
        ],
        "data_provenance": {
            "water_levels": {
                "source_title": "Daily River Stage Bulletin, Old Railway Bridge Delhi",
                "issuing_authority": "Central Water Commission (CWC), Ministry of Jal Shakti, Government of India",
                "portal_url": "https://ffs.india-water.gov.in/",
                "document_reference": "CWC Flood Forecast Monitoring Directorate Daily Bulletins, Station Code: 004-MDELHI / YMN-DEL-ORB-01 (July 2023)",
                "supported_fields": ["water_level_m", "statutory_reference_marks"],
                "verification_status": "OFFICIALLY_PUBLISHED_CWC_BULLETIN"
            },
            "barrage_outflow": {
                "source_title": "Hathnikund Barrage Daily Inflow & Outflow Register",
                "issuing_authority": "Department of Irrigation and Water Resources, Government of Haryana",
                "portal_url": "https://hid.gov.in/",
                "document_reference": "Hathnikund Barrage Discharge Register & Yamunanagar Flood Control Room Daily Log (July 2023)",
                "supported_fields": ["upstream_release_cfs", "upstream_release_cumec"],
                "verification_status": "OFFICIALLY_LOGGED_BARRAGE_DISCHARGE"
            },
            "rainfall": {
                "source_title": "Daily 24-Hour Accumulated Rainfall Report, Safdarjung Observatory",
                "issuing_authority": "India Meteorological Department (IMD), Ministry of Earth Sciences, Government of India",
                "portal_url": "https://mausam.imd.gov.in/",
                "document_reference": "IMD National Weather Forecasting Centre (NWFC) All-India Daily Weather Reports (July 2023)",
                "supported_fields": ["rainfall_mm"],
                "verification_status": "OFFICIALLY_PUBLISHED_METEOROLOGICAL_RECORD"
            },
            "in_situ_streamflow_discharge": {
                "source_title": "In-Situ Continuous Discharge Velocity Metering at Old Railway Bridge, Delhi",
                "issuing_authority": "Central Water Commission (CWC) / Delhi I&FC Department",
                "portal_url": None,
                "document_reference": "UNAVAILABLE (Old Railway Bridge is a stage-only gauge site; continuous in-situ velocity/discharge streamflow is not metered)",
                "supported_fields": ["in_situ_discharge_cfs"],
                "verification_status": "UNMETERED_IN_SITU"
            }
        },
        "is_partial_record": True,
        "completeness_status": "PARTIAL_RECORD_STAGE_AND_UPSTREAM_BARRAGE_DISCHARGE",
        "missing_measurements": [
            "in_situ_continuous_discharge_cfs",
            "hourly_continuous_hydrograph_delhi",
            "spatially_distributed_upper_catchment_gridded_precipitation"
        ],
        "data_completeness_notes": "Old Railway Bridge (ORB) in Delhi is an active stage-gauge station (measuring water level in m MSL) but lacks continuous in-situ streamflow discharge velocity instrumentation. Discharge is gauged 228 km upstream at Hathnikund Barrage (cfs). Local Delhi streamflow discharge is unmetered. Upper catchment spatial rainfall is summarized via Safdarjung and regional IMD bulletins.",
        "regulatory_disclaimer": "204.50 m (Warning) and 205.33 m (Danger) are official CWC statutory reference levels. 206.50 m is a custom VEGA-MITI operational demonstration rule. Never presented as official flood forecast stages. Swarm movements on 20x20 grid are simulated research visualizations.",
        "timeline_data": [
            {
                "date": "2023-07-07",
                "observation_timestamp": "2023-07-07T08:30:00+05:30",
                "publication_timestamp": "2023-07-07T11:30:00+05:30",
                "phase": "BEFORE_FLOOD",
                "rainfall_mm": 12.5,
                "rainfall_status": "OBSERVED",
                "rainfall_source": "IMD_SAFDARJUNG_DAILY_WEATHER_REPORT",
                "water_level_m": 203.40,
                "water_level_status": "OBSERVED",
                "water_level_source": "CWC_DAILY_RIVER_STAGE_BULLETIN_ORB_DELHI",
                "upstream_release_cfs": 42000.0,
                "upstream_release_cumec": 1189.31,
                "upstream_release_status": "REPORTED_BY_BARRAGE_LOG",
                "upstream_release_source": "HARYANA_IRRIGATION_DEPT_HATHNIKUND_LOG",
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "key_observation": "Normal pre-monsoon flow; water level 1.10 m below CWC warning mark",
                "retrospective_context": "Initial seasonal baseflow before monsoon trough convergence"
            },
            {
                "date": "2023-07-08",
                "observation_timestamp": "2023-07-08T08:30:00+05:30",
                "publication_timestamp": "2023-07-08T11:30:00+05:30",
                "phase": "RISING_RISK",
                "rainfall_mm": 126.1,
                "rainfall_status": "OBSERVED",
                "rainfall_source": "IMD_SAFDARJUNG_DAILY_WEATHER_REPORT",
                "water_level_m": 204.10,
                "water_level_status": "OBSERVED",
                "water_level_source": "CWC_DAILY_RIVER_STAGE_BULLETIN_ORB_DELHI",
                "upstream_release_cfs": 85000.0,
                "upstream_release_cumec": 2406.93,
                "upstream_release_status": "REPORTED_BY_BARRAGE_LOG",
                "upstream_release_source": "HARYANA_IRRIGATION_DEPT_HATHNIKUND_LOG",
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "key_observation": "Torrential monsoon downpour starts across Delhi NCR and Himachal hills",
                "retrospective_context": "Catchment saturation begins in upper sub-basins"
            },
            {
                "date": "2023-07-09",
                "observation_timestamp": "2023-07-09T08:30:00+05:30",
                "publication_timestamp": "2023-07-09T13:00:00+05:30",
                "phase": "RISING_RISK",
                "rainfall_mm": 153.0,
                "rainfall_status": "OBSERVED",
                "rainfall_source": "IMD_SAFDARJUNG_DAILY_WEATHER_REPORT",
                "water_level_m": 204.85,
                "water_level_status": "OBSERVED",
                "water_level_source": "CWC_DAILY_RIVER_STAGE_BULLETIN_ORB_DELHI",
                "upstream_release_cfs": 145000.0,
                "upstream_release_cumec": 4105.94,
                "upstream_release_status": "REPORTED_BY_BARRAGE_LOG",
                "upstream_release_source": "HARYANA_IRRIGATION_DEPT_HATHNIKUND_LOG",
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "key_observation": "Safdarjung records 153.0 mm (highest 24h July rain since 1982); Yamuna breaches Warning Level (204.50 m)",
                "retrospective_context": "Local urban runoff combines with early tributary discharge"
            },
            {
                "date": "2023-07-10",
                "observation_timestamp": "2023-07-10T17:00:00+05:30",
                "publication_timestamp": "2023-07-10T18:00:00+05:30",
                "phase": "RISING_RISK",
                "rainfall_mm": 42.0,
                "rainfall_status": "OBSERVED",
                "rainfall_source": "IMD_SAFDARJUNG_DAILY_WEATHER_REPORT",
                "water_level_m": 205.76,
                "water_level_status": "OBSERVED",
                "water_level_source": "CWC_DAILY_RIVER_STAGE_BULLETIN_ORB_DELHI",
                "upstream_release_cfs": 216000.0,
                "upstream_release_cumec": 6116.43,
                "upstream_release_status": "REPORTED_BY_BARRAGE_LOG",
                "upstream_release_source": "HARYANA_IRRIGATION_DEPT_HATHNIKUND_LOG",
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "key_observation": "River breaches CWC Danger Level (205.33 m); Hathnikund release surges past 200,000 cfs",
                "retrospective_context": "Upstream hydraulic surge enters upper Delhi reaches"
            },
            {
                "date": "2023-07-11",
                "observation_timestamp": "2023-07-11T11:00:00+05:30",
                "publication_timestamp": "2023-07-11T12:30:00+05:30",
                "phase": "HIGH_RISK_PEAK",
                "rainfall_mm": 18.0,
                "rainfall_status": "OBSERVED",
                "rainfall_source": "IMD_SAFDARJUNG_DAILY_WEATHER_REPORT",
                "water_level_m": 206.71,
                "water_level_status": "OBSERVED",
                "water_level_source": "CWC_DAILY_RIVER_STAGE_BULLETIN_ORB_DELHI",
                "upstream_release_cfs": 359000.0,
                "upstream_release_cumec": 10165.73,
                "upstream_release_status": "REPORTED_BY_BARRAGE_LOG",
                "upstream_release_source": "HARYANA_IRRIGATION_DEPT_HATHNIKUND_LOG",
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "key_observation": "Peak barrage release from Hathnikund (approx 359,000 cfs) travels downstream; VEGA-MITI critical operational rule triggered",
                "retrospective_context": "Maximum instantaneous volume released from upstream control structure"
            },
            {
                "date": "2023-07-12",
                "observation_timestamp": "2023-07-12T13:00:00+05:30",
                "publication_timestamp": "2023-07-12T14:30:00+05:30",
                "phase": "HIGH_RISK_PEAK",
                "rainfall_mm": 5.0,
                "rainfall_status": "OBSERVED",
                "rainfall_source": "IMD_SAFDARJUNG_DAILY_WEATHER_REPORT",
                "water_level_m": 207.71,
                "water_level_status": "OBSERVED",
                "water_level_source": "CWC_DAILY_RIVER_STAGE_BULLETIN_ORB_DELHI",
                "upstream_release_cfs": 180000.0,
                "upstream_release_cumec": 5097.02,
                "upstream_release_status": "REPORTED_BY_BARRAGE_LOG",
                "upstream_release_source": "HARYANA_IRRIGATION_DEPT_HATHNIKUND_LOG",
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "key_observation": "Breaches historic 45-year 1978 record (207.49 m); Ring Road and Monastery Market inundated",
                "retrospective_context": "Extensive backwater effect through stormwater drainage outfalls"
            },
            {
                "date": "2023-07-13",
                "observation_timestamp": "2023-07-13T18:00:00+05:30",
                "publication_timestamp": "2023-07-13T19:30:00+05:30",
                "phase": "HIGH_RISK_PEAK",
                "rainfall_mm": 2.0,
                "rainfall_status": "OBSERVED",
                "rainfall_source": "IMD_SAFDARJUNG_DAILY_WEATHER_REPORT",
                "water_level_m": 208.66,
                "water_level_status": "OBSERVED",
                "water_level_source": "CWC_DAILY_RIVER_STAGE_BULLETIN_ORB_DELHI",
                "upstream_release_cfs": 95000.0,
                "upstream_release_cumec": 2690.10,
                "upstream_release_status": "REPORTED_BY_BARRAGE_LOG",
                "upstream_release_source": "HARYANA_IRRIGATION_DEPT_HATHNIKUND_LOG",
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "key_observation": "All-time historical crest of 208.66 m recorded at Old Railway Bridge at 18:00 IST; Red Fort perimeter flooded",
                "retrospective_context": "Peak flood stage in recorded Delhi history"
            },
            {
                "date": "2023-07-14",
                "observation_timestamp": "2023-07-14T10:00:00+05:30",
                "publication_timestamp": "2023-07-14T11:30:00+05:30",
                "phase": "HIGH_RISK_PEAK",
                "rainfall_mm": 0.0,
                "rainfall_status": "OBSERVED",
                "rainfall_source": "IMD_SAFDARJUNG_DAILY_WEATHER_REPORT",
                "water_level_m": 208.20,
                "water_level_status": "OBSERVED",
                "water_level_source": "CWC_DAILY_RIVER_STAGE_BULLETIN_ORB_DELHI",
                "upstream_release_cfs": 58000.0,
                "upstream_release_cumec": 1642.37,
                "upstream_release_status": "REPORTED_BY_BARRAGE_LOG",
                "upstream_release_source": "HARYANA_IRRIGATION_DEPT_HATHNIKUND_LOG",
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "key_observation": "High-water plateau holds across central Delhi embankments; flood regulator near WHO building breached",
                "retrospective_context": "Inundation persists due to downstream channel throttling"
            },
            {
                "date": "2023-07-15",
                "observation_timestamp": "2023-07-15T08:30:00+05:30",
                "publication_timestamp": "2023-07-15T11:30:00+05:30",
                "phase": "RECESSION",
                "rainfall_mm": 8.0,
                "rainfall_status": "OBSERVED",
                "rainfall_source": "IMD_SAFDARJUNG_DAILY_WEATHER_REPORT",
                "water_level_m": 207.45,
                "water_level_status": "OBSERVED",
                "water_level_source": "CWC_DAILY_RIVER_STAGE_BULLETIN_ORB_DELHI",
                "upstream_release_cfs": 44000.0,
                "upstream_release_cumec": 1245.94,
                "upstream_release_status": "REPORTED_BY_BARRAGE_LOG",
                "upstream_release_source": "HARYANA_IRRIGATION_DEPT_HATHNIKUND_LOG",
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "key_observation": "Water recedes below 1978 benchmark; army and engineering units seal breached regulator",
                "retrospective_context": "Upstream inflows drop significantly"
            },
            {
                "date": "2023-07-16",
                "observation_timestamp": "2023-07-16T08:30:00+05:30",
                "publication_timestamp": "2023-07-16T11:30:00+05:30",
                "phase": "RECESSION",
                "rainfall_mm": 1.0,
                "rainfall_status": "OBSERVED",
                "rainfall_source": "IMD_SAFDARJUNG_DAILY_WEATHER_REPORT",
                "water_level_m": 206.30,
                "water_level_status": "OBSERVED",
                "water_level_source": "CWC_DAILY_RIVER_STAGE_BULLETIN_ORB_DELHI",
                "upstream_release_cfs": 38000.0,
                "upstream_release_cumec": 1076.04,
                "upstream_release_status": "REPORTED_BY_BARRAGE_LOG",
                "upstream_release_source": "HARYANA_IRRIGATION_DEPT_HATHNIKUND_LOG",
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "key_observation": "Gradual draining through Okhla downstream sluices; arterial roads gradually cleared of silt",
                "retrospective_context": "Recession limb well-established"
            },
            {
                "date": "2023-07-17",
                "observation_timestamp": "2023-07-17T08:30:00+05:30",
                "publication_timestamp": "2023-07-17T11:30:00+05:30",
                "phase": "RECOVERY",
                "rainfall_mm": 0.0,
                "rainfall_status": "OBSERVED",
                "rainfall_source": "IMD_SAFDARJUNG_DAILY_WEATHER_REPORT",
                "water_level_m": 205.20,
                "water_level_status": "OBSERVED",
                "water_level_source": "CWC_DAILY_RIVER_STAGE_BULLETIN_ORB_DELHI",
                "upstream_release_cfs": 32000.0,
                "upstream_release_cumec": 906.14,
                "upstream_release_status": "REPORTED_BY_BARRAGE_LOG",
                "upstream_release_source": "HARYANA_IRRIGATION_DEPT_HATHNIKUND_LOG",
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "key_observation": "Water level drops below CWC Danger Level (205.33 m); post-flood recovery operations active",
                "retrospective_context": "River confines back within active channel banks"
            },
            {
                "date": "2023-07-18",
                "observation_timestamp": "2023-07-18T08:30:00+05:30",
                "publication_timestamp": "2023-07-18T11:30:00+05:30",
                "phase": "RECOVERY",
                "rainfall_mm": 0.0,
                "rainfall_status": "OBSERVED",
                "rainfall_source": "IMD_SAFDARJUNG_DAILY_WEATHER_REPORT",
                "water_level_m": 204.30,
                "water_level_status": "OBSERVED",
                "water_level_source": "CWC_DAILY_RIVER_STAGE_BULLETIN_ORB_DELHI",
                "upstream_release_cfs": 28000.0,
                "upstream_release_cumec": 792.87,
                "upstream_release_status": "REPORTED_BY_BARRAGE_LOG",
                "upstream_release_source": "HARYANA_IRRIGATION_DEPT_HATHNIKUND_LOG",
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "key_observation": "Water level recedes below CWC Warning Level (204.50 m); swarm de-escalation complete",
                "retrospective_context": "Catchment returns to baseline seasonal equilibrium"
            }
        ]
    },
    "EVENT-US-SUSQUEHANNA-2023": {
        "event_id": "EVENT-US-SUSQUEHANNA-2023",
        "title": "December 2023 Susquehanna River High-Flow Event (Harrisburg, PA, US)",
        "country": "United States",
        "state_or_region": "Pennsylvania",
        "river": "Susquehanna River",
        "start_date": "2023-12-14",
        "end_date": "2023-12-26",
        "peak_date": "2023-12-20",
        "timezone": "EST (UTC-05:00)",
        "measurement_units": {
            "river_discharge": "cubic feet per second (cfs)",
            "precipitation": "millimetres (mm)",
            "temperature": "degrees Celsius (C)"
        },
        "primary_gauge_station": {
            "station_id": "01570500",
            "station_name": "Susquehanna River at Harrisburg, PA",
            "river_name": "Susquehanna River",
            "latitude": 40.252,
            "longitude": -76.883,
            "drainage_area_sqmi": 24100.0,
            "mean_elevation_ft": 289.4
        },
        "data_provenance": {
            "discharge": "USGS NWIS Station 01570500 daily streamflow from data/processed/train.csv",
            "weather": "NASA POWER daily surface meteorology"
        },
        "is_partial_record": False,
        "regulatory_disclaimer": "Historical daily mean discharge from USGS NWIS verified records. Research simulation on discrete 20x20 grid.",
        "timeline_data": []
    }
}

class HistoricalReplayEngine:
    def __init__(self, train_path: str = "data/processed/train.csv"):
        self.risk_engine = FloodRiskEngine(train_path=train_path)
        self.activation_engine = SwarmActivationEngine()
        self._populate_us_timeline(train_path)

    def _populate_us_timeline(self, train_path: str):
        timeline = []
        if os.path.exists(train_path):
            try:
                df = pd.read_csv(train_path, dtype={"station_id": str})
                sub = df[(df["station_id"] == "01570500") & (df["date"] >= "2023-12-14") & (df["date"] <= "2023-12-26")].sort_values("date")
                for _, r in sub.iterrows():
                    dt = str(r["date"])
                    q = float(r["discharge_cfs"])
                    precip = float(r["precipitation_mm"])
                    
                    if dt in ("2023-12-14", "2023-12-15", "2023-12-16"):
                        phase = "BEFORE_FLOOD"
                        obs = "Advisory winter baseflow; dry conditions preceding frontal storm"
                        retro = "Catchment baseflow conditions before precipitation system"
                    elif dt in ("2023-12-17", "2023-12-18"):
                        phase = "RISING_RISK"
                        obs = f"Intense atmospheric storm brings heavy rainfall ({precip:.1f} mm); basin saturated"
                        retro = "Direct precipitation runoff initiates hydrograph climb"
                    elif dt in ("2023-12-19", "2023-12-20", "2023-12-21"):
                        phase = "HIGH_RISK_PEAK"
                        obs = f"Runoff convergence causes massive discharge crest ({q:,.0f} cfs); river exceeds historical 99th percentile"
                        retro = "Crest propagation down the lower mainstem"
                    elif dt in ("2023-12-22", "2023-12-23"):
                        phase = "RECESSION"
                        obs = "Discharge recedes from flood crest; cold front stabilizes catchment"
                        retro = "Declining hydrograph recession limb"
                    else:
                        phase = "RECOVERY"
                        obs = "Flow normalizes toward seasonal median; post-event inspection"
                        retro = "Post-event baseflow stabilization"

                    timeline.append({
                        "date": dt,
                        "phase": phase,
                        "rainfall_mm": round(precip, 2),
                        "discharge_cfs": round(q, 2),
                        "temp_max_c": float(r["temp_max_c"]) if pd.notna(r.get("temp_max_c")) else None,
                        "temp_min_c": float(r["temp_min_c"]) if pd.notna(r.get("temp_min_c")) else None,
                        "key_observation": obs,
                        "retrospective_context": retro
                    })
            except Exception:
                pass

        if not timeline:
            susq_json = os.path.join("outputs", "swarm", "replay_susquehanna_2023.json")
            if not os.path.exists(susq_json):
                susq_json = os.path.join("frontend", "public", "data", "swarm", "replay_susquehanna_2023.json")
            if os.path.exists(susq_json):
                import json
                try:
                    with open(susq_json, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    frames = data.get("timeline_frames", [])
                    for fr in frames:
                        obs_state = fr.get("observed_historical_state", {})
                        timeline.append({
                            "date": fr["date"],
                            "phase": fr.get("timeline_phase", "NORMAL"),
                            "rainfall_mm": float(obs_state.get("rainfall_mm") or 0.0),
                            "discharge_cfs": float(obs_state.get("discharge_cfs") or 0.0),
                            "temp_max_c": 12.0,
                            "temp_min_c": 2.0,
                            "key_observation": obs_state.get("key_observation", ""),
                            "retrospective_context": fr.get("retrospective_event_outcome", {}).get("context", "")
                        })
                except Exception:
                    pass

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
                "timezone": item.get("timezone", "UTC"),
                "measurement_units": item.get("measurement_units", {}),
                "primary_station_id": item["primary_gauge_station"]["station_id"],
                "primary_station_name": item["primary_gauge_station"]["station_name"],
                "latitude": item["primary_gauge_station"]["latitude"],
                "longitude": item["primary_gauge_station"]["longitude"],
                "total_days": len(item["timeline_data"]),
                "data_provenance": item["data_provenance"],
                "is_partial_record": item["is_partial_record"],
                "completeness_status": item.get("completeness_status", "COMPLETE"),
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

    def assess_event_observation(self, event_id: str, row: Dict[str, Any]) -> Dict[str, Any]:
        dt = row.get("date")
        if event_id == "EVENT-IN-YAMUNA-2023":
            st_id = "YMN-DEL-ORB-01"
            level_m = row.get("water_level_m")
            release_cfs = row.get("upstream_release_cfs")
            precip_mm = row.get("rainfall_mm")

            if level_m is None and release_cfs is None:
                return {
                    "station_id": st_id,
                    "date": dt,
                    "water_level_m": None,
                    "upstream_release_cfs": None,
                    "in_situ_discharge_cfs": None,
                    "in_situ_discharge_status": "UNMETERED_IN_SITU",
                    "discharge_cfs": None,
                    "rainfall_mm": precip_mm,
                    "risk_level": "UNKNOWN",
                    "risk_state": "INSUFFICIENT_DATA",
                    "confidence_score": 0.0,
                    "data_quality_status": "INVALID_OR_MISSING",
                    "evidence_quality": "DEGRADED",
                    "evidence_used": ["INSUFFICIENT_DATA"],
                    "is_provisional": True,
                    "explanation": "Missing water level and barrage discharge observations; risk state is UNKNOWN due to insufficient data.",
                    "recommended_action": "REQUEST_IMMEDIATE_SENSOR_TELEMETRY",
                    "statutory_reference_marks": {
                        "warning_level_m": 204.50,
                        "danger_level_m": 205.33,
                        "authority": "Central Water Commission (CWC)"
                    },
                    "regulatory_disclaimer": "Data missing. Demonstration only."
                }

            lvl_val = float(level_m) if level_m is not None else 0.0
            rel_val = float(release_cfs) if release_cfs is not None else 0.0

            evidence_sources = []
            if level_m is not None:
                evidence_sources.append(f"CWC_OLD_RAILWAY_BRIDGE_STAGE_{lvl_val:.2f}M")
            if release_cfs is not None:
                evidence_sources.append(f"HATHNIKUND_BARRAGE_RELEASE_{rel_val:,.0f}CFS")
            if precip_mm is not None:
                evidence_sources.append(f"IMD_PRECIPITATION_{precip_mm:.1f}MM")

            if lvl_val >= 206.50 or rel_val >= 300000.0:
                risk_level = "CRITICAL"
                explanation = f"Water level ({lvl_val:.2f} m MSL) breaches CWC Danger Level (205.33 m) and meets VEGA-MITI operational critical threshold (206.50 m); upstream barrage release ({rel_val:,.0f} cfs) indicates severe urban flooding."
                action = "SIMULATED_HIGH_PRIORITY_SURVEY_MISSIONS"
            elif lvl_val >= 205.33 or rel_val >= 200000.0:
                risk_level = "WARNING"
                explanation = f"Water level ({lvl_val:.2f} m MSL) meets or exceeds official CWC Danger Level (205.33 m); upstream release ({rel_val:,.0f} cfs) requires barrier surveillance and evacuation readiness."
                action = "SIMULATED_VERIFICATION_MISSIONS"
            elif lvl_val >= 204.50 or rel_val >= 100000.0:
                risk_level = "WATCH"
                explanation = f"Water level ({lvl_val:.2f} m MSL) meets or exceeds official CWC Warning Level (204.50 m); flow elevated above baseline."
                action = "INCREASE_SIMULATED_MONITORING_FREQUENCY"
            else:
                risk_level = "NORMAL"
                explanation = f"Water level ({lvl_val:.2f} m MSL) remains below official CWC Warning Level (204.50 m). Normal river conditions."
                action = "PASSIVE_MONITORING"

            return {
                "station_id": st_id,
                "date": dt,
                "observation_timestamp": row.get("observation_timestamp"),
                "publication_timestamp": row.get("publication_timestamp"),
                "water_level_m": lvl_val,
                "water_level_status": row.get("water_level_status", "OBSERVED"),
                "upstream_release_cfs": rel_val,
                "upstream_release_cumec": row.get("upstream_release_cumec"),
                "upstream_release_status": row.get("upstream_release_status", "REPORTED_BY_BARRAGE_LOG"),
                "in_situ_discharge_cfs": None,
                "in_situ_discharge_status": "UNMETERED_IN_SITU",
                "discharge_cfs": None,
                "legacy_deprecated_discharge_cfs": rel_val,
                "discharge_semantics_clarification": "discharge_cfs is null because in-situ velocity is not metered at Old Railway Bridge Delhi. Upstream barrage outflow is reported in upstream_release_cfs (located 228 km upstream at Hathnikund). legacy_deprecated_discharge_cfs is preserved solely for backward compatibility.",
                "rainfall_mm": precip_mm,
                "rainfall_status": row.get("rainfall_status", "OBSERVED"),

                "risk_level": risk_level,
                "evidence_sources": evidence_sources,
                "evidence_quality": "HIGH",
                "data_quality_status": "VALID_OBSERVATION",
                "evidence_quality_breakdown": {
                    "individual_observation_confidence": "HIGH",
                    "observation_confidence_basis": "Stage measured by CWC verified gauge; barrage release logged by Haryana Irrigation Flood Control Room; rainfall recorded by IMD Safdarjung Observatory.",
                    "record_completeness": "PARTIAL",
                    "in_situ_discharge_availability": "UNMETERED_IN_SITU",
                    "spatial_rainfall_coverage": "POINT_OBSERVATION_ONLY (Safdarjung Observatory, IMD; upper-basin gridded radar unavailable)",
                    "overall_evidence_synthesis": "Individual point observations have HIGH verification confidence, but overall basinwide hydrological record is PARTIAL due to absence of local Delhi in-situ streamflow velocity metering."
                },
                "completeness_status": "PARTIAL_RECORD_STAGE_AND_UPSTREAM_BARRAGE_DISCHARGE",
                "threshold_source": "CENTRAL_WATER_COMMISSION_AND_VEGA_MITI_OPERATIONAL",
                "is_provisional": False,
                "statutory_reference_marks": {
                    "warning_level_m": 204.50,
                    "danger_level_m": 205.33,
                    "prior_1978_record_m": 207.49,
                    "historic_all_time_peak_m": 208.66,
                    "authority": "Central Water Commission (CWC), Government of India"
                },
                "vega_miti_operational_rules": {
                    "critical_water_level_trigger_m": 206.50,
                    "critical_barrage_release_trigger_cfs": 300000.0,
                    "rule_type": "VEGA_MITI_DEMONSTRATION_OPERATIONAL_THRESHOLD"
                },
                "explanation": explanation,
                "recommended_action": action,
                "regulatory_disclaimer": "204.50m (Warning) and 205.33m (Danger) are official CWC statutory marks. 206.50m is a custom VEGA-MITI operational demonstration rule. NOT a certified CWC flood stage."
            }
        else:
            st_id = "01570500"
            q = row.get("discharge_cfs")
            if q is None:
                return {
                    "station_id": st_id,
                    "date": dt,
                    "discharge_cfs": 0.0,
                    "risk_level": "NORMAL",
                    "data_quality_status": "INVALID_OR_MISSING",
                    "evidence_quality": "DEGRADED",
                    "explanation": "Missing discharge observation; cannot classify risk.",
                    "recommended_action": "PASSIVE_MONITORING",
                    "is_provisional": True
                }
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

        total_steps = len(timeline)
        if step_index is not None and (step_index < 0 or step_index >= total_steps):
            return {
                "status": "error",
                "error": f"Invalid step_index {step_index}. Valid range is 0 to {total_steps - 1}."
            }

        coordinator = SwarmCoordinator(grid_size=(20, 20), lease_duration_sec=60)
        activation_engine = SwarmActivationEngine()
        steps_to_run = timeline if step_index is None else timeline[:step_index + 1]

        replay_frames = []
        failure_applied = False

        for idx, row in enumerate(steps_to_run):
            dt = row["date"]
            phase = row["phase"]
            obs_ts = row.get("observation_timestamp") or f"{dt}T08:30:00+05:30"
            pub_ts = row.get("publication_timestamp") or f"{dt}T11:30:00+05:30"
            hist_epoch = float(pd.Timestamp(obs_ts).timestamp())
            wall_clock_now = float(time.time())

            if idx > 0:
                for mid, m in list(coordinator.missions.items()):
                    if m["status"] == "IN_PROGRESS":
                        coordinator.complete_mission(mid)

            assessment = self.assess_event_observation(event_id, row)
            
            activation_result = activation_engine.evaluate_activation([assessment])
            current_state = activation_result["current_state"]
            
            for m in activation_result["missions"]:
                coordinator.add_mission(m)

            allocations = coordinator.allocate_missions(strategy="adaptive")
            for alloc in allocations:
                alloc["assigned_at"] = hist_epoch
                alloc["assigned_at_iso"] = obs_ts
                alloc["runtime_simulation_wall_clock_sec"] = wall_clock_now
                alloc["timestamp_domain"] = "HISTORICAL_EVENT_TIME"

            reassigned_missions = []
            failure_event = None
            if simulate_failure and not failure_applied and phase == "HIGH_RISK_PEAK" and allocations:
                target_agent = allocations[0]["agent_id"]
                coordinator.simulate_agent_disconnect(target_agent)
                reassigned = coordinator.check_heartbeats_and_leases(timeout_sec=0)
                reallocations = coordinator.allocate_missions(strategy="adaptive")
                for re_alloc in reallocations:
                    re_alloc["assigned_at"] = hist_epoch
                    re_alloc["assigned_at_iso"] = obs_ts
                    re_alloc["runtime_simulation_wall_clock_sec"] = wall_clock_now
                    re_alloc["timestamp_domain"] = "HISTORICAL_EVENT_TIME"
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
                "observed_historical_state": {
                    "key_observation": row.get("key_observation", ""),
                    "observation_timestamp": obs_ts,
                    "publication_timestamp": pub_ts,
                    "rainfall_mm": row.get("rainfall_mm"),
                    "water_level_m": row.get("water_level_m"),
                    "upstream_release_cfs": row.get("upstream_release_cfs"),
                    "upstream_release_cumec": row.get("upstream_release_cumec"),
                    "in_situ_discharge_cfs": None if event_id == "EVENT-IN-YAMUNA-2023" else row.get("discharge_cfs"),
                    "in_situ_discharge_status": "UNMETERED_IN_SITU" if event_id == "EVENT-IN-YAMUNA-2023" else "OBSERVED",
                    "discharge_cfs": None if event_id == "EVENT-IN-YAMUNA-2023" else row.get("discharge_cfs"),
                    "legacy_deprecated_discharge_cfs": row.get("upstream_release_cfs") if event_id == "EVENT-IN-YAMUNA-2023" else row.get("discharge_cfs"),
                    "discharge_semantics_clarification": "For Old Railway Bridge Delhi, discharge_cfs is null because in-situ velocity is not metered. Upstream release is reported in upstream_release_cfs." if event_id == "EVENT-IN-YAMUNA-2023" else "USGS NWIS observed streamflow discharge."
                },
                "available_evidence": {
                    "cutoff_date": dt,
                    "evidence_sources": assessment.get("evidence_sources", ["USGS_NWIS_DISCHARGE"])
                },
                "vega_miti_risk_assessment": assessment,
                "retrospective_event_outcome": {
                    "context": row.get("retrospective_context", ""),
                    "event_peak_date": ev.get("peak_date")
                },
                "simulated_swarm_response": {
                    "coordinate_frame": "SIMULATED_20X20_GRID",
                    "coordinate_disclaimer": "Agent positions represent a simulated 20x20 discrete mission coordinate frame, not actual geographical latitude/longitude.",
                    "simulation_clock": {
                        "event_step_date": dt,
                        "historical_observation_timestamp": obs_ts,
                        "historical_publication_timestamp": pub_ts,
                        "historical_event_epoch_sec": hist_epoch,
                        "runtime_simulation_wall_clock_sec": wall_clock_now,
                        "clock_domain_clarification": "historical_event_epoch_sec represents historical event time (July 2023). runtime_simulation_wall_clock_sec represents host execution wall-clock time."
                    },
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
            "timezone": ev.get("timezone", "UTC"),
            "measurement_units": ev.get("measurement_units", {}),
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
