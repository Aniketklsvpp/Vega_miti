import time
from fastapi import FastAPI, APIRouter, Body, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
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

class SwarmStepRequest(BaseModel):
    steps: Optional[int] = Field(default=None, ge=1, le=100)
    steps_count: Optional[int] = Field(default=None, ge=1, le=100)

class ReplayRunRequest(BaseModel):
    event_id: str = "EVENT-IN-YAMUNA-2023"
    step_index: Optional[int] = None
    simulate_failure: Optional[bool] = True
    action: Optional[str] = "run"

@router.get("/status")
def get_swarm_status():
    agents = list(coordinator.agents.values())
    active_count = sum(1 for a in agents if a.status == "ASSIGNED" and a.connectivity == "CONNECTED")
    idle_count = sum(1 for a in agents if a.status in ("AVAILABLE", "IDLE") and a.connectivity == "CONNECTED")
    failed_count = sum(1 for a in agents if a.status == "DISCONNECTED" or a.connectivity == "DISCONNECTED")
    completed_missions = sum(1 for m in coordinator.missions.values() if m["status"] == "COMPLETED")
    in_progress_missions = sum(1 for m in coordinator.missions.values() if m["status"] == "IN_PROGRESS")
    reassigned_missions = sum(1 for m in coordinator.missions.values() if m["status"] == "REASSIGNED")
    pending_missions = sum(1 for m in coordinator.missions.values() if m["status"] == "PENDING")

    return envelope({
        "simulation_state": activation_engine.current_state,
        "coordinator_status": "ONLINE" if coordinator.coordinator_active else "OFFLINE",
        "total_agents": len(agents),
        "active_agents": active_count,
        "active_agents_count": active_count,
        "idle_agents": idle_count,
        "idle_agents_count": idle_count,
        "failed_agents": failed_count,
        "failed_agents_count": failed_count,
        "total_missions_count": len(coordinator.missions),
        "in_progress_missions_count": in_progress_missions,
        "completed_missions_count": completed_missions,
        "reassigned_missions_count": reassigned_missions,
        "pending_missions_count": pending_missions,
        "grid_size": [20, 20],
        "coordinate_frame": "SIMULATED_20X20_GRID",
        "coordinate_disclaimer": "Agent positions represent a simulated 20x20 discrete mission coordinate frame, not actual geographical latitude/longitude."
    })

@router.get("/agents")
def get_agents():
    agents_list = []
    for a in coordinator.agents.values():
        agents_list.append({
            "agent_id": a.agent_id,
            "agent_type": a.agent_type,
            "capabilities": sorted(list(a.capabilities)),
            "position": a.position,
            "battery": a.battery,
            "status": a.status,
            "connectivity": a.connectivity,
            "current_mission": a.current_mission,
            "planned_path": a.planned_path,
            "remaining_steps": max(0, len(a.planned_path) - 1),
            "coordinate_frame": "SIMULATED_20X20_GRID"
        })
    return envelope(agents_list)

@router.get("/agents/{agent_id}")
def get_agent_detail(agent_id: str):
    if agent_id not in coordinator.agents:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found.")
    a = coordinator.agents[agent_id]
    return envelope({
        "agent_id": a.agent_id,
        "agent_type": a.agent_type,
        "capabilities": sorted(list(a.capabilities)),
        "position": a.position,
        "battery": a.battery,
        "status": a.status,
        "connectivity": a.connectivity,
        "current_mission": a.current_mission,
        "planned_path": a.planned_path,
        "remaining_steps": max(0, len(a.planned_path) - 1),
        "buffered_events_count": len(a.event_buffer),
        "coordinate_frame": "SIMULATED_20X20_GRID"
    })

@router.get("/missions")
def get_missions():
    missions_list = list(coordinator.missions.values())
    leases = coordinator.task_leases
    return envelope({
        "missions": missions_list,
        "active_leases": leases,
        "total_missions": len(missions_list),
        "pending": sum(1 for m in missions_list if m["status"] == "PENDING"),
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
    for a in coordinator.agents.values():
        if a.connectivity == "CONNECTED" and a.event_buffer:
            coordinator.synchronize_agent(a.agent_id)
    return envelope({
        "activation_state": activation_res["current_state"],
        "critical_count": activation_res["critical_stations"],
        "warning_count": activation_res["warning_stations"],
        "watch_count": activation_res.get("watch_stations", 0),
        "missions_generated": activation_res["active_missions_generated"],
        "allocations_made": allocations,
        "swarm_status": coordinator.get_swarm_snapshot()
    })

@router.post("/step")
def step_simulation(req: Optional[SwarmStepRequest] = None):
    steps = 1
    if req:
        if req.steps is not None and req.steps > 0:
            steps = req.steps
        elif req.steps_count is not None and req.steps_count > 0:
            steps = req.steps_count
    result = None
    for _ in range(steps):
        result = coordinator.step_simulation()
    if result:
        result["steps_executed"] = steps
        result["agents_updated"] = len(result.get("agents", []))
    return envelope(result)

@router.post("/agents/{agent_id}/fail")
def fail_agent_by_path(agent_id: str):
    if agent_id not in coordinator.agents:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found.")
    coordinator.simulate_agent_disconnect(agent_id)
    reassigned = coordinator.check_heartbeats_and_leases(timeout_sec=0)
    reallocations = coordinator.allocate_missions(strategy="adaptive")
    for a in coordinator.agents.values():
        if a.connectivity == "CONNECTED" and a.event_buffer:
            coordinator.synchronize_agent(a.agent_id)
    return envelope({
        "agent_id": agent_id,
        "failed_agent_id": agent_id,
        "status": "DISCONNECTED",
        "connectivity": "OFFLINE",
        "reassigned_missions": reassigned,
        "new_allocations": reallocations,
        "replacement_agents": [r["agent_id"] for r in reallocations]
    })

@router.post("/agent/disconnect")
def disconnect_agent(req: AgentDisconnectRequest):
    if req.agent_id not in coordinator.agents:
        return envelope(error=f"Agent '{req.agent_id}' not found.")
    coordinator.simulate_agent_disconnect(req.agent_id)
    reassigned = coordinator.check_heartbeats_and_leases(timeout_sec=0)
    reallocations = coordinator.allocate_missions(strategy="adaptive")
    for a in coordinator.agents.values():
        if a.connectivity == "CONNECTED" and a.event_buffer:
            coordinator.synchronize_agent(a.agent_id)
    return envelope({
        "agent_id": req.agent_id,
        "status": "DISCONNECTED",
        "reassigned_missions": reassigned,
        "new_allocations": reallocations,
        "replacement_agents": [r["agent_id"] for r in reallocations]
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

@router.get("/events")
def get_swarm_events(limit: Optional[int] = Query(default=100, ge=1, le=500)):
    all_events = list(coordinator.synchronized_event_log)
    seen_ids = {e.get("event_id") for e in all_events if "event_id" in e}
    for agent in coordinator.agents.values():
        for evt in agent.event_buffer:
            if evt.get("event_id") not in seen_ids:
                all_events.append(evt)
                seen_ids.add(evt.get("event_id"))
    all_events.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
    sliced = all_events[:limit]
    return envelope({
        "total_events": len(all_events),
        "returned_events": len(sliced),
        "returned_count": len(sliced),
        "count": len(sliced),
        "events": sliced
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
        "simulation_state": "NORMAL",
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

@router.get("/benchmarks")
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

app = FastAPI(title="VEGA-MITI Simulation & Resilience API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
