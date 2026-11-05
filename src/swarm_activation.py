import uuid

class SwarmActivationEngine:
    def __init__(self):
        self.current_state = "NORMAL"

    def evaluate_activation(self, risk_assessment_list):
        critical_count = 0
        warning_count = 0
        watch_count = 0

        for r in risk_assessment_list:
            q_status = r.get("data_quality_status", r.get("evidence_quality", "VALID_OBSERVATION"))
            if q_status not in ("VALID", "VALID_OBSERVATION", "HIGH"):
                continue
            lvl = r.get("risk_level", "NORMAL")
            if lvl in ("UNKNOWN", "INSUFFICIENT_DATA"):
                continue
            is_prov = r.get("is_provisional", False)
            if is_prov and lvl in ("CRITICAL", "WARNING"):
                watch_count += 1
            elif lvl == "CRITICAL":
                critical_count += 1
            elif lvl == "WARNING":
                warning_count += 1
            elif lvl == "WATCH":
                watch_count += 1

        prev_state = self.current_state
        if critical_count > 0:
            new_state = "CRITICAL"
        elif warning_count > 0:
            new_state = "WARNING"
        elif watch_count > 0:
            new_state = "WATCH"
        elif self.current_state in ("CRITICAL", "WARNING", "WATCH"):
            new_state = "RISK_REDUCTION"
        else:
            new_state = "NORMAL"

        self.current_state = new_state
        missions = self._generate_missions(risk_assessment_list, new_state)

        return {
            "previous_state": prev_state,
            "current_state": new_state,
            "critical_stations": critical_count,
            "warning_stations": warning_count,
            "watch_stations": watch_count,
            "active_missions_generated": len(missions),
            "missions": missions
        }

    def _generate_missions(self, assessments, state):
        missions = []
        if state == "NORMAL":
            return missions

        for assess in assessments:
            level = assess.get("risk_level", "NORMAL")
            if level in ("UNKNOWN", "INSUFFICIENT_DATA", "NORMAL"):
                continue
            st_id = str(assess.get("station_id", "UNKNOWN"))
            discharge = assess.get("discharge_cfs", assess.get("predicted_discharge_cfs"))
            q_status = assess.get("data_quality_status", assess.get("evidence_quality", "VALID_OBSERVATION"))
            if q_status not in ("VALID", "VALID_OBSERVATION", "HIGH"):
                continue

            is_prov = assess.get("is_provisional", False)
            if is_prov and level in ("CRITICAL", "WARNING"):
                level = "WATCH"

            if level == "CRITICAL":
                missions.append({
                    "mission_id": f"MSN-{uuid.uuid4().hex[:6].upper()}",
                    "mission_type": "EMERGENCY_CREST_VERIFICATION",
                    "priority": 1,
                    "target_station_id": st_id,
                    "station_id": st_id,
                    "discharge_cfs": discharge,
                    "risk_level": level,
                    "data_quality_status": q_status,
                    "is_simulated": True,
                    "coordinate_frame": "SIMULATED_20X20_GRID",
                    "target_position": self._station_to_grid(st_id),
                    "required_capabilities": ["AERIAL_OBSERVATION", "VERIFICATION"],
                    "estimated_duration_sec": 120,
                    "status": "PENDING"
                })
                missions.append({
                    "mission_id": f"MSN-{uuid.uuid4().hex[:6].upper()}",
                    "mission_type": "DOWNSTREAM_SURVEILLANCE",
                    "priority": 2,
                    "target_station_id": st_id,
                    "station_id": st_id,
                    "discharge_cfs": discharge,
                    "risk_level": level,
                    "data_quality_status": q_status,
                    "is_simulated": True,
                    "coordinate_frame": "SIMULATED_20X20_GRID",
                    "target_position": (self._station_to_grid(st_id)[0] + 1, self._station_to_grid(st_id)[1] + 1),
                    "required_capabilities": ["TERRAIN_RECON", "AREA_SURVEILLANCE"],
                    "estimated_duration_sec": 180,
                    "status": "PENDING"
                })
            elif level == "WARNING":
                missions.append({
                    "mission_id": f"MSN-{uuid.uuid4().hex[:6].upper()}",
                    "mission_type": "SURFACE_FLOW_MONITORING",
                    "priority": 2,
                    "target_station_id": st_id,
                    "station_id": st_id,
                    "discharge_cfs": discharge,
                    "risk_level": level,
                    "data_quality_status": q_status,
                    "is_simulated": True,
                    "coordinate_frame": "SIMULATED_20X20_GRID",
                    "target_position": self._station_to_grid(st_id),
                    "required_capabilities": ["RIVER_MONITORING"],
                    "estimated_duration_sec": 150,
                    "status": "PENDING"
                })
                missions.append({
                    "mission_id": f"MSN-{uuid.uuid4().hex[:6].upper()}",
                    "mission_type": "NETWORK_RELAY_BRIDGE",
                    "priority": 2,
                    "target_station_id": st_id,
                    "station_id": st_id,
                    "discharge_cfs": discharge,
                    "risk_level": level,
                    "data_quality_status": q_status,
                    "is_simulated": True,
                    "coordinate_frame": "SIMULATED_20X20_GRID",
                    "target_position": (self._station_to_grid(st_id)[0] - 1, self._station_to_grid(st_id)[1]),
                    "required_capabilities": ["DATA_RELAY"],
                    "estimated_duration_sec": 240,
                    "status": "PENDING"
                })
            elif level == "WATCH":
                missions.append({
                    "mission_id": f"MSN-{uuid.uuid4().hex[:6].upper()}",
                    "mission_type": "PREVENTIVE_RECONNAISSANCE",
                    "priority": 3,
                    "target_station_id": st_id,
                    "station_id": st_id,
                    "discharge_cfs": discharge,
                    "risk_level": level,
                    "data_quality_status": q_status,
                    "is_simulated": True,
                    "coordinate_frame": "SIMULATED_20X20_GRID",
                    "target_position": self._station_to_grid(st_id),
                    "required_capabilities": ["AERIAL_OBSERVATION"],
                    "estimated_duration_sec": 90,
                    "status": "PENDING"
                })

        return missions

    def _station_to_grid(self, station_id):
        import hashlib
        digest = hashlib.md5(str(station_id).encode("utf-8")).hexdigest()
        h_val = int(digest[:8], 16)
        x = (h_val % 14) + 3
        y = ((h_val // 14) % 14) + 3
        obstacles = {(7, 8), (7, 9), (7, 10), (14, 12), (14, 13), (14, 14)}
        while (x, y) in obstacles or (x + 1, y + 1) in obstacles or (x - 1, y) in obstacles:
            x = (x + 1) % 18 + 1
            y = (y + 1) % 18 + 1
        return (x, y)
