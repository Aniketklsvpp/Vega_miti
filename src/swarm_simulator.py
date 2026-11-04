import heapq
import math
import time
import uuid

class AStarPlanner:
    def __init__(self, grid_size=(20, 20), obstacles=None):
        self.width, self.height = grid_size
        self.obstacles = set(obstacles) if obstacles else set()

    def set_obstacles(self, obstacles):
        self.obstacles = set(obstacles)

    def add_obstacle(self, pos):
        self.obstacles.add(pos)

    def remove_obstacle(self, pos):
        self.obstacles.discard(pos)

    def heuristic(self, a, b):
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def find_path(self, start, goal):
        start = (int(start[0]), int(start[1]))
        goal = (int(goal[0]), int(goal[1]))
        
        if start == goal:
            return [start]
        if goal in self.obstacles:
            return None

        open_set = []
        heapq.heappush(open_set, (0, start))
        came_from = {}
        g_score = {start: 0}
        f_score = {start: self.heuristic(start, goal)}

        while open_set:
            current = heapq.heappop(open_set)[1]
            if current == goal:
                path = []
                while current in came_from:
                    path.append(current)
                    current = came_from[current]
                path.append(start)
                path.reverse()
                return path

            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                neighbor = (current[0] + dx, current[1] + dy)
                if not (0 <= neighbor[0] < self.width and 0 <= neighbor[1] < self.height):
                    continue
                if neighbor in self.obstacles:
                    continue

                tentative_g = g_score[current] + 1
                if tentative_g < g_score.get(neighbor, float("inf")):
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    f = tentative_g + self.heuristic(neighbor, goal)
                    f_score[neighbor] = f
                    heapq.heappush(open_set, (f, neighbor))

        return None

class Agent:
    def __init__(self, agent_id, agent_type, capabilities, position, battery=100.0):
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.capabilities = set(capabilities)
        self.position = position
        self.battery = battery
        self.connectivity = "CONNECTED"
        self.status = "AVAILABLE"
        self.current_mission = None
        self.last_heartbeat = time.time()
        self.event_buffer = []
        self.planned_path = []

    def record_event(self, event_type, payload):
        event = {
            "event_id": f"EVT-{uuid.uuid4().hex[:8]}",
            "agent_id": self.agent_id,
            "event_type": event_type,
            "timestamp": time.time(),
            "payload": payload
        }
        self.event_buffer.append(event)
        return event

    def send_heartbeat(self):
        self.last_heartbeat = time.time()

class SwarmCoordinator:
    def __init__(self, grid_size=(20, 20), lease_duration_sec=45):
        self.planner = AStarPlanner(grid_size=grid_size)
        self.lease_duration_sec = lease_duration_sec
        self.coordinator_active = True
        self.synchronized_event_log = []
        self.seen_event_ids = set()
        self.agents = {}
        self.missions = {}
        self.task_leases = {}
        self._init_default_swarm()

    def _init_default_swarm(self):
        defs = [
            ("DRONE_AERIAL_1", "UAV", ["AERIAL_OBSERVATION", "VERIFICATION"], (1, 1), 95.0),
            ("DRONE_AERIAL_2", "UAV", ["AERIAL_OBSERVATION", "VERIFICATION", "AREA_SURVEILLANCE"], (18, 1), 88.0),
            ("USV_RIVER_1", "USV", ["RIVER_MONITORING", "VERIFICATION"], (5, 10), 92.0),
            ("USV_RIVER_2", "USV", ["RIVER_MONITORING"], (12, 10), 85.0),
            ("RELAY_NODE_1", "RELAY", ["DATA_RELAY", "AERIAL_OBSERVATION"], (10, 5), 90.0),
            ("GROUND_SCOUT_1", "UGV", ["AREA_SURVEILLANCE", "VERIFICATION"], (2, 18), 78.0)
        ]
        for aid, atype, caps, pos, bat in defs:
            self.agents[aid] = Agent(aid, atype, caps, pos, bat)

        default_obstacles = [(7, 8), (7, 9), (7, 10), (14, 12), (14, 13), (14, 14)]
        self.planner.set_obstacles(default_obstacles)

    def add_mission(self, mission_dict):
        mid = mission_dict["mission_id"]
        mission_dict["status"] = "PENDING"
        self.missions[mid] = mission_dict

    def allocate_missions(self, strategy="adaptive"):
        if not self.coordinator_active and strategy == "adaptive":
            return []

        pending_missions = [m for m in self.missions.values() if m["status"] in ("PENDING", "REASSIGNED")]
        if not pending_missions:
            return []

        pending_missions.sort(key=lambda m: m["priority"])
        allocations = []

        for m in pending_missions:
            mid = m["mission_id"]
            req_caps = set(m.get("required_capabilities", []))
            target_pos = m["target_position"]
            best_agent = None
            best_bid = -float("inf")

            for aid, agent in self.agents.items():
                if strategy == "adaptive":
                    if agent.connectivity != "CONNECTED" or agent.status not in ("AVAILABLE", "IDLE"):
                        continue
                    if not req_caps.issubset(agent.capabilities):
                        continue
                    dist = abs(agent.position[0] - target_pos[0]) + abs(agent.position[1] - target_pos[1])
                    bid = (4 - m["priority"]) * 100.0 - dist * 3.0 + agent.battery * 0.4
                else:
                    if agent.status not in ("AVAILABLE", "IDLE"):
                        continue
                    dist = abs(agent.position[0] - target_pos[0]) + abs(agent.position[1] - target_pos[1])
                    bid = -dist

                if bid > best_bid:
                    best_bid = bid
                    best_agent = agent

            if best_agent is not None:
                path = self.planner.find_path(best_agent.position, target_pos)
                if path is not None:
                    best_agent.status = "ASSIGNED"
                    best_agent.current_mission = mid
                    best_agent.planned_path = path
                    m["status"] = "IN_PROGRESS"
                    m["assigned_agent_id"] = best_agent.agent_id
                    now = time.time()
                    self.task_leases[mid] = {
                        "agent_id": best_agent.agent_id,
                        "granted_at": now,
                        "expires_at": now + self.lease_duration_sec
                    }
                    alloc = {
                        "mission_id": mid,
                        "agent_id": best_agent.agent_id,
                        "path_length": len(path),
                        "path": path,
                        "bid_score": round(best_bid, 2)
                    }
                    allocations.append(alloc)
                    best_agent.record_event("MISSION_ASSIGNED", alloc)

        return allocations

    def check_heartbeats_and_leases(self, timeout_sec=20):
        now = time.time()
        reassigned = []
        if timeout_sec is not None and timeout_sec > 0:
            for aid, agent in self.agents.items():
                if now - agent.last_heartbeat > timeout_sec and agent.connectivity == "CONNECTED":
                    agent.connectivity = "DISCONNECTED"
                    agent.status = "DISCONNECTED"
                    agent.record_event("AGENT_HEARTBEAT_LOST", {"last_heartbeat": agent.last_heartbeat})

        for mid, lease in list(self.task_leases.items()):
            agent = self.agents.get(lease["agent_id"])
            if now > lease["expires_at"] or (agent and agent.connectivity == "DISCONNECTED"):
                if mid in self.missions and self.missions[mid]["status"] in ("IN_PROGRESS", "ASSIGNED"):
                    self.missions[mid]["status"] = "REASSIGNED"
                    self.missions[mid]["assigned_agent_id"] = None
                    reassigned.append(mid)
                del self.task_leases[mid]

        return reassigned

    def complete_mission(self, mission_id):
        if mission_id in self.missions:
            m = self.missions[mission_id]
            m["status"] = "COMPLETED"
            aid = m.get("assigned_agent_id")
            if aid and aid in self.agents:
                agent = self.agents[aid]
                if agent.status == "ASSIGNED" and agent.connectivity == "CONNECTED":
                    agent.status = "AVAILABLE"
                    agent.current_mission = None
                    agent.planned_path = []
                    if m.get("target_position"):
                        agent.position = m["target_position"]
                    agent.record_event("MISSION_COMPLETED", {"mission_id": mission_id, "position": agent.position})
            if mission_id in self.task_leases:
                del self.task_leases[mission_id]

    def step_simulation(self):
        moved_agents = []
        completed_missions = []
        for aid, agent in self.agents.items():
            if agent.status == "ASSIGNED" and agent.connectivity == "CONNECTED" and agent.planned_path:
                prev_pos = agent.position
                if len(agent.planned_path) > 1:
                    agent.position = agent.planned_path[1]
                    agent.planned_path = agent.planned_path[1:]
                    agent.battery = max(0.0, round(agent.battery - 0.5, 2))
                    agent.record_event("AGENT_MOVED", {
                        "from_position": prev_pos,
                        "to_position": agent.position,
                        "remaining_path_length": len(agent.planned_path) - 1
                    })
                    moved_agents.append({
                        "agent_id": aid,
                        "previous_position": prev_pos,
                        "current_position": agent.position,
                        "battery": agent.battery,
                        "remaining_steps": len(agent.planned_path) - 1
                    })
                    if len(agent.planned_path) == 1:
                        mid = agent.current_mission
                        self.complete_mission(mid)
                        completed_missions.append(mid)
                else:
                    mid = agent.current_mission
                    self.complete_mission(mid)
                    completed_missions.append(mid)

        for aid, agent in self.agents.items():
            if agent.connectivity == "CONNECTED" and agent.event_buffer:
                self.synchronize_agent(aid)

        return {
            "step_status": "COMPLETED",
            "moved_agents": moved_agents,
            "completed_missions": completed_missions,
            "coordinate_frame": "SIMULATED_20X20_GRID",
            "active_missions_count": sum(1 for m in self.missions.values() if m["status"] in ("PENDING", "IN_PROGRESS", "ASSIGNED", "REASSIGNED")),
            "completed_missions_count": sum(1 for m in self.missions.values() if m["status"] == "COMPLETED"),
            "agents": [
                {
                    "agent_id": a.agent_id,
                    "agent_type": a.agent_type,
                    "capabilities": sorted(list(a.capabilities)),
                    "position": a.position,
                    "battery": a.battery,
                    "status": a.status,
                    "connectivity": a.connectivity,
                    "current_mission": a.current_mission,
                    "planned_path": a.planned_path,
                    "remaining_steps": max(0, len(a.planned_path) - 1)
                }
                for a in self.agents.values()
            ]
        }

    def simulate_agent_disconnect(self, agent_id):
        if agent_id in self.agents:
            a = self.agents[agent_id]
            a.connectivity = "DISCONNECTED"
            a.status = "DISCONNECTED"
            a.record_event("NETWORK_DISCONNECTED", {"position": a.position})

    def simulate_agent_reconnect(self, agent_id):
        if agent_id in self.agents:
            a = self.agents[agent_id]
            a.connectivity = "CONNECTED"
            a.status = "AVAILABLE" if not a.current_mission else "ASSIGNED"
            a.send_heartbeat()
            self.synchronize_agent(agent_id)

    def simulate_coordinator_failure(self):
        self.coordinator_active = False

    def simulate_coordinator_recovery(self):
        self.coordinator_active = True
        for aid in self.agents:
            if self.agents[aid].connectivity == "CONNECTED":
                self.synchronize_agent(aid)

    def synchronize_agent(self, agent_id):
        agent = self.agents.get(agent_id)
        if not agent:
            return 0
        synced_count = 0
        for ev in agent.event_buffer:
            eid = ev["event_id"]
            if eid not in self.seen_event_ids:
                self.seen_event_ids.add(eid)
                self.synchronized_event_log.append(ev)
                synced_count += 1
        agent.event_buffer.clear()
        return synced_count

    def get_swarm_snapshot(self):
        agents_data = []
        for a in self.agents.values():
            agents_data.append({
                "agent_id": a.agent_id,
                "agent_type": a.agent_type,
                "capabilities": list(a.capabilities),
                "position": a.position,
                "battery": a.battery,
                "connectivity": a.connectivity,
                "status": a.status,
                "current_mission": a.current_mission,
                "path_remaining": len(a.planned_path),
                "coordinate_frame": "SIMULATED_20X20_GRID"
            })
        return {
            "environment_mode": "SIMULATED_AGENT_NETWORK",
            "grid_dimensions": [self.planner.width, self.planner.height],
            "coordinator_status": "ONLINE" if self.coordinator_active else "OFFLINE",
            "active_missions_count": sum(1 for m in self.missions.values() if m["status"] == "IN_PROGRESS"),
            "completed_missions_count": sum(1 for m in self.missions.values() if m["status"] == "COMPLETED"),
            "synchronized_events_count": len(self.synchronized_event_log),
            "agents": agents_data
        }

def run_coordination_comparison(missions_to_run):
    t0 = time.time()
    swarm_static = SwarmCoordinator(lease_duration_sec=99999)
    for m in missions_to_run:
        swarm_static.add_mission(dict(m))
    static_alloc = swarm_static.allocate_missions(strategy="static")
    swarm_static.simulate_agent_disconnect("DRONE_AERIAL_1")
    static_completed = sum(1 for m in swarm_static.missions.values() if m["status"] == "IN_PROGRESS" and swarm_static.agents.get(m.get("assigned_agent_id", "")).connectivity == "CONNECTED")
    t_static = round(time.time() - t0, 3)

    t1 = time.time()
    swarm_adaptive = SwarmCoordinator(lease_duration_sec=30)
    for m in missions_to_run:
        swarm_adaptive.add_mission(dict(m))
    adaptive_alloc = swarm_adaptive.allocate_missions(strategy="adaptive")
    swarm_adaptive.simulate_agent_disconnect("DRONE_AERIAL_1")
    reassigned = swarm_adaptive.check_heartbeats_and_leases(timeout_sec=10)
    adaptive_reassigned = swarm_adaptive.allocate_missions(strategy="adaptive")
    swarm_adaptive.simulate_coordinator_failure()
    swarm_adaptive.agents["USV_RIVER_1"].record_event("OBSERVATION_RECORDED", {"water_speed_mps": 2.8})
    swarm_adaptive.simulate_coordinator_recovery()
    adaptive_completed = sum(1 for m in swarm_adaptive.missions.values() if m["status"] == "IN_PROGRESS" and swarm_adaptive.agents.get(m.get("assigned_agent_id", "")).connectivity == "CONNECTED")
    t_adaptive = round(time.time() - t1, 3)

    total_m = len(missions_to_run)
    return {
        "comparison_framework": "STATIC_VS_ADAPTIVE_SWARM_COORDINATION",
        "scenario_missions_count": total_m,
        "static_strategy": {
            "initial_missions_allocated": len(static_alloc),
            "reassigned_missions_allocated": 0,
            "missions_allocated": len(static_alloc),
            "reassignments_handled": 0,
            "simulated_task_coverage_rate_pct": round((static_completed / total_m) * 100.0 if total_m > 0 else 0.0, 1),
            "effective_coverage_rate_pct": round((static_completed / total_m) * 100.0 if total_m > 0 else 0.0, 1),
            "communication_overhead_events": len(swarm_static.synchronized_event_log),
            "coordinator_fault_tolerant": False,
            "runtime_sec": t_static
        },
        "adaptive_strategy": {
            "initial_missions_allocated": len(adaptive_alloc),
            "reassigned_missions_allocated": len(adaptive_reassigned),
            "missions_allocated": len(adaptive_alloc) + len(adaptive_reassigned),
            "reassignments_handled": len(reassigned),
            "simulated_task_coverage_rate_pct": round((adaptive_completed / total_m) * 100.0 if total_m > 0 else 0.0, 1),
            "effective_coverage_rate_pct": round((adaptive_completed / total_m) * 100.0 if total_m > 0 else 0.0, 1),
            "communication_overhead_events": len(swarm_adaptive.synchronized_event_log),
            "coordinator_fault_tolerant": True,
            "runtime_sec": t_adaptive
        },
        "performance_differential": {
            "simulated_coverage_improvement_pct": round(((adaptive_completed - static_completed) / max(1, total_m)) * 100.0, 1),
            "coverage_improvement_pct": round(((adaptive_completed - static_completed) / max(1, total_m)) * 100.0, 1),
            "fault_recovery_supported": True
        }
    }
