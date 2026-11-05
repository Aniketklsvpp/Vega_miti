import urllib.request
import json

BASE = "http://127.0.0.1:8000"

def get(path):
    req = urllib.request.Request(f"{BASE}{path}")
    return json.loads(urllib.request.urlopen(req).read().decode("utf-8"))

def post(path, data=None):
    payload = json.dumps(data or {}).encode("utf-8")
    req = urllib.request.Request(f"{BASE}{path}", data=payload, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read().decode("utf-8"))

def test_live_backend_health():
    res = get("/api/health")
    assert res["status"] == "success"
    assert res["data"]["status"] == "HEALTHY"

def test_live_stations_list():
    res = get("/api/stations")
    assert res["status"] == "success"
    assert res["data"]["total_stations"] > 0
    assert len(res["data"]["stations"]) > 0

def test_live_station_risk():
    res = get("/api/risk/01570500")
    assert res["status"] == "success"
    assert res["data"]["station_id"] == "01570500"
    assert "risk_level" in res["data"]
    assert "discharge_cfs" in res["data"]

def test_live_swarm_cycle():
    # 1. Reset
    r_reset = post("/api/swarm/reset")
    assert r_reset["status"] == "success"
    assert r_reset["data"]["simulation_state"] == "NORMAL"

    # 2. Status
    r_stat = get("/api/swarm/status")
    assert r_stat["status"] == "success"
    assert r_stat["data"]["total_agents"] == 6

    # 3. Agents
    r_agents = get("/api/swarm/agents")
    assert r_agents["status"] == "success"
    assert len(r_agents["data"]) == 6

    # 4. Activate
    r_act = post("/api/swarm/activate", {})
    assert r_act["status"] == "success"
    assert r_act["data"]["activation_state"] == "CRITICAL"
    assert r_act["data"]["missions_generated"] > 0

    # 5. Step
    r_step = post("/api/swarm/step", {"steps": 1})
    assert r_step["status"] == "success"

    # 6. Fail agent
    r_fail = post("/api/swarm/agents/DRONE_AERIAL_1/fail")
    assert r_fail["status"] == "success"
    assert r_fail["data"]["status"] == "DISCONNECTED"

    # 7. Reconnect agent
    r_rec = post("/api/swarm/agent/reconnect", {"agent_id": "DRONE_AERIAL_1"})
    assert r_rec["status"] == "success"
    assert r_rec["data"]["status"] == "CONNECTED"

    # 8. Reset back
    post("/api/swarm/reset")

def test_live_evaluation():
    r_hydro = get("/api/evaluation/hydrology?config=A")
    assert r_hydro["status"] == "success"
    assert "forecast_skill_pooled" in r_hydro["data"]

    r_swarm = post("/api/swarm/evaluate/compare")
    assert r_swarm["status"] == "success"
    assert "static_strategy" in r_swarm["data"]
    assert "adaptive_strategy" in r_swarm["data"]

def test_live_historical_replay():
    r_events = get("/api/swarm/replay/events")
    assert r_events["status"] == "success"
    assert len(r_events["data"]) >= 2

    r_run = post("/api/swarm/replay/run", {"event_id": "EVENT-IN-YAMUNA-2023"})
    assert r_run["status"] == "success"
    assert len(r_run["data"]["timeline_frames"]) > 0

if __name__ == '__main__':
    test_live_backend_health()
    print("[OK] Backend Health passed")
    test_live_stations_list()
    print("[OK] Stations List passed")
    test_live_station_risk()
    print("[OK] Station Risk passed")
    test_live_swarm_cycle()
    print("[OK] Swarm Cycle passed")
    test_live_evaluation()
    print("[OK] Evaluation passed")
    test_live_historical_replay()
    print("[OK] Historical Replay passed")
    print("ALL LIVE INTEGRATION TESTS PASSED 100%!")
