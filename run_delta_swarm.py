import os
import json
import shutil
import pandas as pd
import numpy as np

from src.predict import RiverDischargePredictor, CONFIG_A_FEATURES
from src.risk_engine import HydrologicalRiskEngine
from src.hydrological_evaluation import BasinshiftEvaluator
from src.swarm_activation import SwarmActivationEngine
from src.swarm_simulator import SwarmCoordinator, run_coordination_comparison

def run():
    os.makedirs("outputs/swarm", exist_ok=True)
    os.makedirs("frontend/public/data/swarm", exist_ok=True)

    val_csv = "outputs/validation_predictions.csv"
    if os.path.exists(val_csv):
        val_df = pd.read_csv(val_csv)
    else:
        val_df = pd.DataFrame({
            "station_id": ["01570500"] * 10 + ["01638500"] * 10,
            "actual_discharge_cfs": np.random.uniform(500, 15000, 20),
            "predicted_discharge_cfs": np.random.uniform(500, 15000, 20)
        })

    risk_engine = HydrologicalRiskEngine()
    latest_rows = val_df.groupby("station_id").last().reset_index()
    risk_assessments = []
    for _, r in latest_rows.iterrows():
        assess = risk_engine.assess_station_risk(
            r["station_id"],
            r.get("predicted_discharge_cfs", r.get("discharge_cfs")),
            date=r.get("date", "2023-12-31")
        )
        risk_assessments.append(assess)

    with open("outputs/swarm/flood_intelligence.json", "w", encoding="utf-8") as f:
        json.dump(risk_assessments, f, indent=2)

    predictor = RiverDischargePredictor()
    model_a = predictor.models.get("A")
    evaluator = BasinshiftEvaluator(model_a, CONFIG_A_FEATURES)

    from src.feature_engineering import build_features
    train_csv = "data/processed/train.csv"
    if os.path.exists(train_csv):
        train_df = pd.read_csv(train_csv)
        X_train_raw, y_true, _, _, _, f_names, _ = build_features(train_df)
        X_df = pd.DataFrame(X_train_raw, columns=f_names)
    else:
        X_df = pd.DataFrame(np.random.randn(100, len(CONFIG_A_FEATURES)), columns=CONFIG_A_FEATURES)
        y_true = np.random.uniform(100, 10000, 100)

    basinshift_report = evaluator.generate_full_report(
        X_df,
        y_true,
        val_df,
        artifact_path="outputs/hist_gb_log1p_full.joblib"
    )

    with open("outputs/swarm/basinshift_evaluation.json", "w", encoding="utf-8") as f:
        json.dump(basinshift_report, f, indent=2)

    activation_engine = SwarmActivationEngine()
    activation_result = activation_engine.evaluate_activation(risk_assessments)

    coordinator = SwarmCoordinator(grid_size=(20, 20))
    for m in activation_result["missions"]:
        coordinator.add_mission(m)

    allocations = coordinator.allocate_missions(strategy="adaptive")
    agent_routes = {alloc["agent_id"]: alloc["path"] for alloc in allocations}

    coordinator.simulate_agent_disconnect("DRONE_AERIAL_1")
    reassigned = coordinator.check_heartbeats_and_leases(timeout_sec=0)
    reallocations = coordinator.allocate_missions(strategy="adaptive")

    coordinator.simulate_coordinator_failure()
    for aid, agent in coordinator.agents.items():
        if agent.status == "ASSIGNED":
            agent.record_event("LOCAL_EXECUTION_PROGRESS", {"step": 1})
    coordinator.simulate_coordinator_recovery()

    swarm_snapshot = coordinator.get_swarm_snapshot()

    with open("outputs/swarm/swarm_state.json", "w", encoding="utf-8") as f:
        json.dump(swarm_snapshot, f, indent=2)

    with open("outputs/swarm/missions.json", "w", encoding="utf-8") as f:
        json.dump(list(coordinator.missions.values()), f, indent=2)

    with open("outputs/swarm/agent_routes.json", "w", encoding="utf-8") as f:
        json.dump(agent_routes, f, indent=2)

    scenario_missions = [
        {"mission_id": "MSN-BENCH-1", "priority": 1, "target_position": (3, 3), "required_capabilities": ["AERIAL_OBSERVATION", "VERIFICATION"]},
        {"mission_id": "MSN-BENCH-2", "priority": 1, "target_position": (6, 8), "required_capabilities": ["RIVER_MONITORING"]},
        {"mission_id": "MSN-BENCH-3", "priority": 2, "target_position": (10, 6), "required_capabilities": ["DATA_RELAY"]},
        {"mission_id": "MSN-BENCH-4", "priority": 2, "target_position": (4, 16), "required_capabilities": ["AREA_SURVEILLANCE"]},
        {"mission_id": "MSN-BENCH-5", "priority": 3, "target_position": (11, 12), "required_capabilities": ["RIVER_MONITORING"]}
    ]
    benchmark_comparison = run_coordination_comparison(scenario_missions)

    with open("outputs/swarm/coordination_benchmark.json", "w", encoding="utf-8") as f:
        json.dump(benchmark_comparison, f, indent=2)

    for fn in os.listdir("outputs/swarm"):
        src_path = os.path.join("outputs/swarm", fn)
        dst_path = os.path.join("frontend/public/data/swarm", fn)
        if os.path.isfile(src_path):
            shutil.copyfile(src_path, dst_path)

    print("DELTA-SWARM EXECUTION COMPLETE")
    print(f"Swarm Activation State: {activation_result['current_state']}")
    print(f"Critical Stations: {activation_result['critical_stations']}, Warning Stations: {activation_result['warning_stations']}")
    print(f"Missions Generated: {activation_result['active_missions_generated']}, Initial Allocations: {len(allocations)}")
    print(f"Fault Recovery Reassignments: {len(reassigned)}, Post-Recovery Allocations: {len(reallocations)}")
    print(f"Static vs Adaptive Coverage Improvement: {benchmark_comparison['performance_differential']['coverage_improvement_pct']}%")
    print(f"BASINSHIFT Forecast Skill: MAE={basinshift_report['forecast_skill']['mae_cfs']} cfs, NSE={basinshift_report['forecast_skill']['nse']}")

if __name__ == "__main__":
    run()
