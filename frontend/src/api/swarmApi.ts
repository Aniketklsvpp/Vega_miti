import type {
  ApiResponse,
  CoordinatorState,
  FloodRiskAssessment,
  HydrologicalEvaluation,
  NetworkEventLog,
  SwarmAgent,
  SwarmBenchmarkComparison,
  SwarmMission,
} from '../types/swarm'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

let isUsingFallbackSimulation = false

let simulatedAgents: SwarmAgent[] = [
  {
    id: 'AG-01',
    name: 'Survey Quad-1',
    type: 'DRONE_SURVEY',
    position: { x: 28, y: 34, lat: 26.18, lng: 91.75 },
    targetPosition: { x: 35, y: 40 },
    batteryPct: 88,
    connectivity: 'CONNECTED',
    status: 'ON_MISSION',
    currentMissionId: 'MSN-801',
    leaseExpiresAt: new Date(Date.now() + 45000).toISOString(),
    latencyMs: 34,
    bufferedEventCount: 0,
  },
  {
    id: 'AG-02',
    name: 'Survey Quad-2',
    type: 'DRONE_SURVEY',
    position: { x: 62, y: 55, lat: 25.57, lng: 85.13 },
    targetPosition: { x: 58, y: 50 },
    batteryPct: 76,
    connectivity: 'CONNECTED',
    status: 'EN_ROUTE',
    currentMissionId: 'MSN-803',
    leaseExpiresAt: new Date(Date.now() + 82000).toISOString(),
    latencyMs: 42,
    bufferedEventCount: 0,
  },
  {
    id: 'AG-03',
    name: 'Bathymetry ROV-A',
    type: 'ROV_DEPTH',
    position: { x: 44, y: 68, lat: 21.15, lng: 79.08 },
    batteryPct: 92,
    connectivity: 'CONNECTED',
    status: 'IDLE',
    latencyMs: 58,
    bufferedEventCount: 0,
  },
  {
    id: 'AG-04',
    name: 'Bathymetry ROV-B',
    type: 'ROV_DEPTH',
    position: { x: 75, y: 24, lat: 27.48, lng: 94.91 },
    batteryPct: 61,
    connectivity: 'CONNECTED',
    status: 'ON_MISSION',
    currentMissionId: 'MSN-802',
    leaseExpiresAt: new Date(Date.now() + 28000).toISOString(),
    latencyMs: 71,
    bufferedEventCount: 0,
  },
  {
    id: 'AG-05',
    name: 'Hydrometric Unit 5',
    type: 'GROUND_SENSOR',
    position: { x: 36, y: 48, lat: 24.58, lng: 88.27 },
    batteryPct: 95,
    connectivity: 'CONNECTED',
    status: 'ON_MISSION',
    currentMissionId: 'MSN-804',
    leaseExpiresAt: new Date(Date.now() + 115000).toISOString(),
    latencyMs: 19,
    bufferedEventCount: 0,
  },
  {
    id: 'AG-06',
    name: 'Tactical Mesh Relay',
    type: 'RELAY_NODE',
    position: { x: 50, y: 46, lat: 25.00, lng: 88.00 },
    batteryPct: 83,
    connectivity: 'CONNECTED',
    status: 'IDLE',
    latencyMs: 12,
    bufferedEventCount: 0,
  },
]

let simulatedCoordinator: CoordinatorState = {
  status: 'HEALTHY',
  activeAgents: 6,
  disconnectedAgents: 0,
  bufferedEventsCount: 0,
  lastSyncTimestamp: new Date().toISOString(),
  heartbeatIntervalMs: 2000,
}

let simulatedMissions: SwarmMission[] = [
  {
    id: 'MSN-801',
    title: 'Brahmaputra Crest Verification',
    stationId: 'IND-BR-01',
    stationName: 'Guwahati Outflow',
    type: 'GAUGE_VERIFY',
    priority: 'CRITICAL',
    status: 'IN_PROGRESS',
    assignedAgentId: 'AG-01',
    leaseDurationSec: 60,
    remainingLeaseSec: 42,
    createdAt: new Date(Date.now() - 34000).toISOString(),
    updatedAt: new Date().toISOString(),
    details: 'Discharge prediction exceeded provisional P95 threshold (+32%). Verify gauge telemetry with optical aerial survey.',
  },
  {
    id: 'MSN-802',
    title: 'Dibrugarh Embankment Bathymetry',
    stationId: 'IND-BR-03',
    stationName: 'Dibrugarh Reach',
    type: 'WATERWAY_SURVEY',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assignedAgentId: 'AG-04',
    leaseDurationSec: 90,
    remainingLeaseSec: 28,
    createdAt: new Date(Date.now() - 72000).toISOString(),
    updatedAt: new Date().toISOString(),
    details: 'Sonar cross-section profiling to detect bed scour near structural spurs.',
  },
  {
    id: 'MSN-803',
    title: 'Ganges Middle Basin Survey',
    stationId: 'IND-GA-02',
    stationName: 'Patna Confluence',
    type: 'SURFACE_EVAL',
    priority: 'MEDIUM',
    status: 'ASSIGNED',
    assignedAgentId: 'AG-02',
    leaseDurationSec: 120,
    remainingLeaseSec: 82,
    createdAt: new Date(Date.now() - 20000).toISOString(),
    updatedAt: new Date().toISOString(),
    details: 'Assess surface velocity profile before scheduled monsoon crest arrival.',
  },
  {
    id: 'MSN-804',
    title: 'Farakka Barrage Comm Tether',
    stationId: 'IND-GA-05',
    stationName: 'Farakka Feeder',
    type: 'COMM_RELAY',
    priority: 'LOW',
    status: 'IN_PROGRESS',
    assignedAgentId: 'AG-05',
    leaseDurationSec: 180,
    remainingLeaseSec: 115,
    createdAt: new Date(Date.now() - 65000).toISOString(),
    updatedAt: new Date().toISOString(),
    details: 'Maintain telemetry backhaul between downstream hydrometers and uplink relay.',
  },
]

let simulatedLogs: NetworkEventLog[] = [
  {
    id: 'EVT-101',
    timestamp: new Date(Date.now() - 95000).toISOString(),
    type: 'SYNC_RESTORED',
    severity: 'info',
    message: 'Central Coordinator initialized mesh topology with 6 active agents.',
  },
  {
    id: 'EVT-102',
    timestamp: new Date(Date.now() - 34000).toISOString(),
    type: 'REASSIGNED',
    severity: 'info',
    message: 'Task lease MSN-801 issued to AG-01 for 60 seconds.',
    agentId: 'AG-01',
    missionId: 'MSN-801',
  },
]

async function requestEnvelope<T>(url: string, options?: RequestInit, fallbackData?: () => T): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }
    const json = (await res.json()) as ApiResponse<T>
    isUsingFallbackSimulation = false
    return json
  } catch (err) {
    if (fallbackData) {
      isUsingFallbackSimulation = true
      return {
        status: 'success',
        data: fallbackData(),
        error: null,
      }
    }
    return {
      status: 'error',
      data: null as unknown as T,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown communication error',
      },
    }
  }
}

export const SwarmApi = {
  isFallbackActive(): boolean {
    return isUsingFallbackSimulation
  },

  async getFloodRisk(stationId: string, stationMeta?: { name?: string; river?: string; state?: string; lat?: number; lng?: number }): Promise<ApiResponse<FloodRiskAssessment>> {
    return requestEnvelope<FloodRiskAssessment>(`/risk?station_id=${stationId}`, undefined, () => {
      const isCritical = stationId.includes('BR-01') || stationId.includes('01413038')
      const isWarning = stationId.includes('GA-02') || stationId.includes('01413500')
      const riskLevel = isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'NORMAL'
      const thresholdVal = 42500

      return {
        stationId,
        stationName: stationMeta?.name || 'Guwahati Hydrometric Reach',
        riverName: stationMeta?.river || 'Brahmaputra River',
        state: stationMeta?.state || 'Assam',
        latitude: stationMeta?.lat || 26.18,
        longitude: stationMeta?.lng || 91.75,
        currentDischarge: isCritical ? 47800 : isWarning ? 38900 : 18200,
        predictedDischarge: isCritical ? 51200 : isWarning ? 40500 : 19100,
        confidenceInterval: {
          lower: isCritical ? 48200 : 16900,
          upper: isCritical ? 54800 : 21400,
        },
        riskLevel,
        thresholdValue: thresholdVal,
        thresholdSource: 'USGS / CWC Hydrological 95th Percentile Reference',
        isProvisionalThreshold: true,
        dataQuality: {
          status: 'VALIDATED',
          missingPct: 0.8,
          anomalyDetected: false,
          lastSensorRead: new Date(Date.now() - 15 * 60000).toISOString(),
        },
        modelConfig: {
          modelType: 'Physics-Guided Gradient Boosted Trees + Residual LSTM',
          featureLookbackDays: 7,
          targetHorizonHours: 24,
          trainingDataRange: '2018-01-01 to 2023-12-31',
        },
        metrics: {
          rmse: 142.6,
          mae: 98.4,
          r2: 0.912,
          nse: 0.887,
        },
      }
    })
  },

  async getSwarmState(): Promise<ApiResponse<{ agents: SwarmAgent[]; coordinator: CoordinatorState; missions: SwarmMission[] }>> {
    return requestEnvelope('/swarm/state', undefined, () => {
      simulatedMissions = simulatedMissions.map((m) => {
        if (m.status === 'IN_PROGRESS' && m.remainingLeaseSec > 0) {
          const next = Math.max(0, m.remainingLeaseSec - 1)
          if (next === 0) {
            simulatedLogs.unshift({
              id: `EVT-${Date.now()}`,
              timestamp: new Date().toISOString(),
              type: 'LEASE_EXPIRED',
              severity: 'warning',
              message: `Task lease expired for ${m.id}. Initiating autonomous lease reassignment.`,
              missionId: m.id,
            })
            return { ...m, remainingLeaseSec: 0, status: 'EXPIRED' }
          }
          return { ...m, remainingLeaseSec: next }
        }
        return m
      })

      const activeCount = simulatedAgents.filter((a) => a.connectivity === 'CONNECTED').length
      simulatedCoordinator.activeAgents = activeCount
      simulatedCoordinator.disconnectedAgents = simulatedAgents.length - activeCount

      return {
        agents: [...simulatedAgents],
        coordinator: { ...simulatedCoordinator },
        missions: [...simulatedMissions],
      }
    })
  },

  async disconnectAgent(agentId: string): Promise<ApiResponse<SwarmAgent>> {
    return requestEnvelope<SwarmAgent>(
      '/swarm/agent/disconnect',
      { method: 'POST', body: JSON.stringify({ agent_id: agentId }) },
      () => {
        const agent = simulatedAgents.find((a) => a.id === agentId)
        if (agent) {
          agent.connectivity = 'DISCONNECTED'
          agent.status = 'FAULT'
          agent.bufferedEventCount = 12

          const affectedMission = simulatedMissions.find((m) => m.assignedAgentId === agentId && m.status === 'IN_PROGRESS')
          if (affectedMission) {
            affectedMission.status = 'REASSIGNED'
            const candidate = simulatedAgents.find((a) => a.id !== agentId && a.connectivity === 'CONNECTED' && a.status === 'IDLE')
            if (candidate) {
              affectedMission.assignedAgentId = candidate.id
              affectedMission.status = 'IN_PROGRESS'
              affectedMission.remainingLeaseSec = 60
              candidate.status = 'ON_MISSION'
              candidate.currentMissionId = affectedMission.id
              simulatedLogs.unshift({
                id: `EVT-${Date.now()}`,
                timestamp: new Date().toISOString(),
                type: 'REASSIGNED',
                severity: 'warning',
                message: `Agent ${agentId} disconnected. Autonomous lease reassignment transferred ${affectedMission.id} to ${candidate.id}.`,
                agentId: candidate.id,
                missionId: affectedMission.id,
              })
            }
          }

          simulatedLogs.unshift({
            id: `EVT-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'DISCONNECT',
            severity: 'critical',
            message: `Heartbeat lost for ${agent.name} (${agentId}). Link entered partitioned state.`,
            agentId,
          })
          return { ...agent }
        }
        throw new Error(`Agent ${agentId} not found`)
      }
    )
  },

  async reconnectAgent(agentId: string): Promise<ApiResponse<SwarmAgent>> {
    return requestEnvelope<SwarmAgent>(
      '/swarm/agent/reconnect',
      { method: 'POST', body: JSON.stringify({ agent_id: agentId }) },
      () => {
        const agent = simulatedAgents.find((a) => a.id === agentId)
        if (agent) {
          const flushedCount = agent.bufferedEventCount
          agent.connectivity = 'CONNECTED'
          agent.status = 'IDLE'
          agent.bufferedEventCount = 0

          simulatedLogs.unshift({
            id: `EVT-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'BUFFER_FLUSH',
            severity: 'info',
            message: `Agent ${agentId} reconnected. Flushed ${flushedCount} buffered telemetry packets with zero collision.`,
            agentId,
          })
          return { ...agent }
        }
        throw new Error(`Agent ${agentId} not found`)
      }
    )
  },

  async failCoordinator(): Promise<ApiResponse<CoordinatorState>> {
    return requestEnvelope<CoordinatorState>(
      '/swarm/coordinator/fail',
      { method: 'POST' },
      () => {
        simulatedCoordinator.status = 'FAILED'
        simulatedAgents.forEach((a) => {
          a.bufferedEventCount += 8
        })
        simulatedLogs.unshift({
          id: `EVT-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'COORDINATOR_FAIL',
          severity: 'critical',
          message: 'CENTRAL COORDINATOR FAULT INJECTED. Swarm transitioned to decentralized local consensus mode.',
        })
        return { ...simulatedCoordinator }
      }
    )
  },

  async restoreNetwork(): Promise<ApiResponse<CoordinatorState>> {
    return requestEnvelope<CoordinatorState>(
      '/swarm/network/restore',
      { method: 'POST' },
      () => {
        simulatedCoordinator.status = 'HEALTHY'
        simulatedAgents.forEach((a) => {
          a.connectivity = 'CONNECTED'
          a.bufferedEventCount = 0
          if (a.status === 'FAULT') a.status = 'IDLE'
        })
        simulatedCoordinator.activeAgents = 6
        simulatedCoordinator.disconnectedAgents = 0
        simulatedCoordinator.lastSyncTimestamp = new Date().toISOString()

        simulatedLogs.unshift({
          id: `EVT-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'SYNC_RESTORED',
          severity: 'info',
          message: 'Network and Coordinator fully restored. Vector clocks synchronized across all 6 agents.',
        })
        return { ...simulatedCoordinator }
      }
    )
  },

  async dispatchMission(mission: Partial<SwarmMission>): Promise<ApiResponse<SwarmMission>> {
    return requestEnvelope<SwarmMission>(
      '/swarm/mission/dispatch',
      { method: 'POST', body: JSON.stringify(mission) },
      () => {
        const availableAgent = simulatedAgents.find((a) => a.connectivity === 'CONNECTED' && a.status === 'IDLE')
        const newMission: SwarmMission = {
          id: `MSN-${Math.floor(100 + Math.random() * 900)}`,
          title: mission.title || 'Dynamic River Reach Reconnaissance',
          stationId: mission.stationId || 'IND-BR-01',
          stationName: mission.stationName || 'Guwahati Outflow',
          type: mission.type || 'GAUGE_VERIFY',
          priority: mission.priority || 'HIGH',
          status: availableAgent ? 'IN_PROGRESS' : 'PENDING',
          assignedAgentId: availableAgent ? availableAgent.id : undefined,
          leaseDurationSec: 60,
          remainingLeaseSec: 60,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          details: mission.details || 'Autonomously dispatched in response to elevated discharge anomaly.',
        }
        if (availableAgent) {
          availableAgent.status = 'ON_MISSION'
          availableAgent.currentMissionId = newMission.id
        }
        simulatedMissions.unshift(newMission)
        simulatedLogs.unshift({
          id: `EVT-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'REASSIGNED',
          severity: 'info',
          message: `Mission ${newMission.id} dispatched (${newMission.priority} priority) assigned to ${availableAgent ? availableAgent.name : 'Unassigned (Queue)'}.`,
          missionId: newMission.id,
          agentId: availableAgent?.id,
        })
        return newMission
      }
    )
  },

  async getNetworkEventLogs(): Promise<ApiResponse<NetworkEventLog[]>> {
    return requestEnvelope('/swarm/events', undefined, () => [...simulatedLogs])
  },

  async getHydrologicalEvaluation(): Promise<ApiResponse<HydrologicalEvaluation>> {
    return requestEnvelope('/evaluation/hydrology', undefined, () => ({
      overall: {
        mae: 87.4,
        rmse: 134.2,
        nse: 0.892,
        highFlowPrecision: 0.884,
        highFlowRecall: 0.867,
        f1Score: 0.875,
      },
      baselines: [
        { name: 'Persistent Flow Baseline (t-1)', rmse: 312.4, nse: 0.54, highFlowF1: 0.42 },
        { name: 'Standard Historical Mean (P50)', rmse: 448.9, nse: 0.28, highFlowF1: 0.18 },
        { name: 'Uncalibrated Hydrological Model', rmse: 245.1, nse: 0.71, highFlowF1: 0.63 },
        { name: 'DELTA-SWARM ML Hybrid (Our Model)', rmse: 134.2, nse: 0.892, highFlowF1: 0.875 },
      ],
      catchmentBreakdown: [
        { basin: 'Brahmaputra Upper Basin', stationCount: 8, rmse: 146.5, nse: 0.878, extremeError: 8.4 },
        { basin: 'Ganges Middle Reach', stationCount: 14, rmse: 122.1, nse: 0.908, extremeError: 6.2 },
        { basin: 'Godavari Coastal Plains', stationCount: 6, rmse: 138.9, nse: 0.882, extremeError: 7.9 },
        { basin: 'Mahanadi Delta', stationCount: 5, rmse: 118.4, nse: 0.914, extremeError: 5.7 },
      ],
      robustness: [
        { noiseLevel: 'Baseline (0% Synthetic Noise)', maeImpactPct: 0.0, nseRetentionPct: 100.0 },
        { noiseLevel: '+10% Rainfall Sensor Jitter', maeImpactPct: 4.8, nseRetentionPct: 97.4 },
        { noiseLevel: '20% Missing Sensor Telemetry', maeImpactPct: 9.3, nseRetentionPct: 93.1 },
        { noiseLevel: 'Extreme Cloud Cover Occlusion', maeImpactPct: 12.1, nseRetentionPct: 89.6 },
      ],
    }))
  },

  async getSwarmEvaluation(): Promise<ApiResponse<SwarmBenchmarkComparison>> {
    return requestEnvelope('/evaluation/swarm', undefined, () => ({
      staticStrategy: {
        strategy: 'STATIC',
        completionRatePct: 62.5,
        priorityCoveragePct: 58.0,
        duplicateAssignments: 4,
        reassignmentCount: 0,
        avgRecoveryTimeSec: 184.2,
        commsOverheadKbps: 14.8,
        unmonitoredHighRiskSec: 420,
      },
      adaptiveStrategy: {
        strategy: 'ADAPTIVE',
        completionRatePct: 95.8,
        priorityCoveragePct: 98.2,
        duplicateAssignments: 0,
        reassignmentCount: 7,
        avgRecoveryTimeSec: 8.6,
        commsOverheadKbps: 9.2,
        unmonitoredHighRiskSec: 24,
      },
      summaryAnalysis:
        'Under injected network partitions (3 node disconnects + 1 central coordinator outage), the Adaptive coordination engine achieved +33.3% higher mission completion and eliminated duplicate assignments using bounded task leases and local consensus routing.',
      scenarioDetails: {
        totalAgents: 6,
        simulatedDurationSec: 300,
        injectedDisconnections: 3,
        coordinatorPartitionCount: 1,
      },
    }))
  },
}
