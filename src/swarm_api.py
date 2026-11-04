from fastapi import FastAPI, APIRouter, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from src.swarm_simulator import SwarmCoordinator, run_coordination_comparison
from src.swarm_activation import SwarmActivationEngine
from src.risk_engine import FloodRiskEngine
from src.historical_replay import HistoricalReplayEngine

router = APIRouter(prefix="/api/swarm", tags=["swarm"])
coordinator = SwarmCoordinator(grid_size=(20, 20), lease_duration_sec=45)
activation_engine = SwarmActivationEngine()
risk_engine = FloodRiskEngine()
replay_engine = HistoricalReplayEngine()

def envelope(data=None, error=None):
    if error:
        return {"status": "error", "data": None, "error": str(error)}
    return {"status": "success", "data": data if data is not None else {}, "error": None}

class AgentDisconnectRequest(BaseModel):
    agent_id: str

class AgentReconnectRequest(BaseModel):
    agent_id: str

class SwarmActivationRequest(BaseModel):
    assessments: Optional[List[Dict[str, Any]]] = None

class ReplayRunRequest(BaseModel):
    event_id: str = "EVENT-IN-YAMUNA-2023"
    step_index: Optional[int] = None
    simulate_failure: Optional[bool] = True
    action: Optional[str] = "run"

@router.get("/agents")
def get_agents():
    snapshot = coordinator.get_swarm_snapshot()
    return envelope(snapshot["agents"])

@router.get("/missions")
def get_missions():
    missions_list = list(coordinator.missions.values())
    leases = coordinator.task_leases
    return envelope({
        "missions": missions_list,
        "active_leases": leases,
        "total_missions": len(missions_list),
        "in_progress": sum(1 for m in missions_list if m["status"] == "IN_PROGRESS"),
        "completed": sum(1 for m in missions_list if m["status"] == "COMPLETED"),
        "reassigned": sum(1 for m in missions_list if m["status"] == "REASSIGNED")
    })

@router.post("/activate")
def activate_swarm(req: SwarmActivationRequest):
    assessments = req.assessments
    if not assessments:
        assessments = [
            {"station_id": "01570500", "discharge_cfs": 179000.0, "risk_level": "CRITICAL", "data_quality_status": "VALID_OBSERVATION"},
            {"station_id": "01638500", "discharge_cfs": 45000.0, "risk_level": "WARNING", "data_quality_status": "VALID_OBSERVATION"}
        ]
    activation_res = activation_engine.evaluate_activation(assessments)
    for m in activation_res["missions"]:
        coordinator.add_mission(m)
    allocations = coordinator.allocate_missions(strategy="adaptive")
    return envelope({
        "activation_state": activation_res["current_state"],
        "critical_count": activation_res["critical_stations"],
        "warning_count": activation_res["warning_stations"],
        "missions_generated": activation_res["active_missions_generated"],
        "allocations_made": allocations,
        "swarm_status": coordinator.get_swarm_snapshot()
    })

@router.post("/agent/disconnect")
def disconnect_agent(req: AgentDisconnectRequest):
    if req.agent_id not in coordinator.agents:
        return envelope(error=f"Agent '{req.agent_id}' not found.")
    coordinator.simulate_agent_disconnect(req.agent_id)
    reassigned = coordinator.check_heartbeats_and_leases(timeout_sec=0)
    reallocations = coordinator.allocate_missions(strategy="adaptive")
    return envelope({
        "agent_id": req.agent_id,
        "status": "DISCONNECTED",
        "reassigned_missions": reassigned,
        "new_allocations": reallocations
    })

@router.post("/agent/reconnect")
def reconnect_agent(req: AgentReconnectRequest):
    if req.agent_id not in coordinator.agents:
        return envelope(error=f"Agent '{req.agent_id}' not found.")
    coordinator.simulate_agent_reconnect(req.agent_id)
    allocations = coordinator.allocate_missions(strategy="adaptive")
    return envelope({
        "agent_id": req.agent_id,
        "status": "CONNECTED",
        "events_synced": coordinator.get_swarm_snapshot()["synchronized_events_count"],
        "new_allocations": allocations
    })

@router.post("/coordinator/fail")
def fail_coordinator():
    coordinator.simulate_coordinator_failure()
    for aid, agent in coordinator.agents.items():
        if agent.status == "ASSIGNED":
            agent.record_event("LOCAL_EXECUTION_PROGRESS", {"step": 1})
    return envelope({
        "coordinator_status": "OFFLINE",
        "local_execution_mode": True,
        "buffered_events_count": sum(len(a.event_buffer) for a in coordinator.agents.values())
    })

@router.post("/coordinator/restore")
def restore_coordinator():
    coordinator.simulate_coordinator_recovery()
    allocations = coordinator.allocate_missions(strategy="adaptive")
    return envelope({
        "coordinator_status": "ONLINE",
        "total_synchronized_events": len(coordinator.synchronized_event_log),
        "post_recovery_allocations": allocations
    })

@router.post("/reset")
def reset_simulation():
    global coordinator, activation_engine
    coordinator = SwarmCoordinator(grid_size=(20, 20), lease_duration_sec=45)
    activation_engine = SwarmActivationEngine()
    return envelope({
        "reset_status": "COMPLETED",
        "agents_count": len(coordinator.agents),
        "missions_count": len(coordinator.missions)
    })

@router.get("/evaluation/static")
def evaluate_static():
    sample_missions = [
        {"mission_id": f"MSN-STAT-{i}", "priority": (i % 3) + 1, "target_position": (i * 3 + 1, i * 2 + 1), "required_capabilities": ["AERIAL_OBSERVATION"]}
        for i in range(4)
    ]
    res = run_coordination_comparison(sample_missions)
    return envelope(res["static_strategy"])

@router.get("/evaluation/adaptive")
def evaluate_adaptive():
    sample_missions = [
        {"mission_id": f"MSN-ADAPT-{i}", "priority": (i % 3) + 1, "target_position": (i * 3 + 1, i * 2 + 1), "required_capabilities": ["AERIAL_OBSERVATION"]}
        for i in range(4)
    ]
    res = run_coordination_comparison(sample_missions)
    return envelope(res["adaptive_strategy"])

@router.post("/evaluate/compare")
def compare_strategies():
    sample_missions = [
        {"mission_id": "MSN-BENCH-1", "priority": 1, "target_position": (3, 3), "required_capabilities": ["AERIAL_OBSERVATION", "VERIFICATION"]},
        {"mission_id": "MSN-BENCH-2", "priority": 1, "target_position": (6, 8), "required_capabilities": ["RIVER_MONITORING"]},
        {"mission_id": "MSN-BENCH-3", "priority": 2, "target_position": (10, 6), "required_capabilities": ["DATA_RELAY"]},
        {"mission_id": "MSN-BENCH-4", "priority": 2, "target_position": (4, 16), "required_capabilities": ["AREA_SURVEILLANCE"]},
        {"mission_id": "MSN-BENCH-5", "priority": 3, "target_position": (11, 12), "required_capabilities": ["RIVER_MONITORING"]}
    ]
    res = run_coordination_comparison(sample_missions)
    return envelope(res)

@router.get("/replay/events")
def get_replay_events():
    events = replay_engine.get_available_events()
    return envelope(events)

@router.get("/replay/event/{event_id}")
def get_replay_event(event_id: str):
    meta = replay_engine.get_event_metadata(event_id)
    if not meta:
        return envelope(error=f"Historical event '{event_id}' not found.")
    return envelope(meta)

@router.post("/replay/run")
def run_historical_replay(req: ReplayRunRequest):
    if req.action == "reset":
        return envelope({
            "reset_status": "COMPLETED",
            "event_id": req.event_id,
            "message": "Replay timeline reset to initial step."
        })
    res = replay_engine.execute_replay(
        event_id=req.event_id,
        step_index=req.step_index,
        simulate_failure=True if req.simulate_failure is None else req.simulate_failure
    )
    if res.get("status") == "error":
        return envelope(error=res.get("error"))
    return envelope(res)

app = FastAPI(title="DELTA-SWARM Simulation & Resilience API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
