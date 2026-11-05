export type FloodRiskLevel = 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'

export type AgentType = 'DRONE_SURVEY' | 'ROV_DEPTH' | 'GROUND_SENSOR' | 'RELAY_NODE'
export type AgentConnectivity = 'CONNECTED' | 'INTERMITTENT' | 'DISCONNECTED'
export type AgentStatus = 'IDLE' | 'EN_ROUTE' | 'ON_MISSION' | 'RETURNING' | 'FAULT'

export type MissionType = 'GAUGE_VERIFY' | 'WATERWAY_SURVEY' | 'COMM_RELAY' | 'SURFACE_EVAL'
export type MissionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type MissionStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REASSIGNED'

export interface ApiResponse<T> {
  status: 'success' | 'error'
  data: T
  error: { code: string; message: string } | null
}

export interface SwarmAgent {
  id: string
  name: string
  type: AgentType
  position: { x: number; y: number; lat: number; lng: number }
  targetPosition?: { x: number; y: number }
  batteryPct: number
  connectivity: AgentConnectivity
  status: AgentStatus
  currentMissionId?: string
  leaseExpiresAt?: string
  latencyMs: number
  bufferedEventCount: number
}

export interface SwarmMission {
  id: string
  title: string
  stationId: string
  stationName: string
  type: MissionType
  priority: MissionPriority
  status: MissionStatus
  assignedAgentId?: string
  leaseDurationSec: number
  remainingLeaseSec: number
  createdAt: string
  updatedAt: string
  details: string
}

export interface NetworkEventLog {
  id: string
  timestamp: string
  type: 'DISCONNECT' | 'HEARTBEAT_LOST' | 'COORDINATOR_FAIL' | 'LEASE_EXPIRED' | 'REASSIGNED' | 'SYNC_RESTORED' | 'BUFFER_FLUSH'
  severity: 'info' | 'warning' | 'critical'
  message: string
  agentId?: string
  missionId?: string
}

export interface CoordinatorState {
  status: 'HEALTHY' | 'DEGRADED' | 'FAILED'
  activeAgents: number
  disconnectedAgents: number
  bufferedEventsCount: number
  lastSyncTimestamp: string
  heartbeatIntervalMs: number
}

export interface FloodRiskAssessment {
  stationId: string
  stationName: string
  riverName: string
  state: string
  latitude: number
  longitude: number
  currentDischarge: number
  predictedDischarge: number
  confidenceInterval: {
    lower: number
    upper: number
  }
  riskLevel: FloodRiskLevel
  riskBasisDiscrepancy?: 'MATCH' | 'MISMATCH' | string
  observedRiskLevel?: FloodRiskLevel | string
  predictedRiskLevel?: FloodRiskLevel | string
  thresholdValue: number
  thresholdSource: string
  isProvisionalThreshold: boolean
  dataQuality: {
    status: 'HIGH' | 'VALIDATED' | 'PROVISIONAL' | 'ESTIMATED'
    missingPct: number
    anomalyDetected: boolean
    lastSensorRead: string
  }
  modelConfig: {
    modelType: string
    featureLookbackDays: number
    targetHorizonHours: number
    trainingDataRange: string
  }
  metrics: {
    rmse: number
    mae: number
    r2: number
    nse?: number
  }
}

export interface HydrologicalEvaluation {
  overall: {
    mae: number
    rmse: number
    nse: number
    highFlowPrecision: number
    highFlowRecall: number
    f1Score: number
  }
  baselines: {
    name: string
    rmse: number
    nse: number
    highFlowF1: number
  }[]
  catchmentBreakdown: {
    basin: string
    stationCount: number
    rmse: number
    nse: number
    extremeError: number
  }[]
  robustness: {
    noiseLevel: string
    maeImpactPct: number
    nseRetentionPct: number
  }[]
}

export interface SwarmBenchmarkMetricSet {
  strategy: 'STATIC' | 'ADAPTIVE'
  completionRatePct: number
  priorityCoveragePct: number
  duplicateAssignments: number
  reassignmentCount: number
  avgRecoveryTimeSec: number
  commsOverheadKbps: number
  unmonitoredHighRiskSec: number
}

export interface SwarmBenchmarkComparison {
  staticStrategy: SwarmBenchmarkMetricSet
  adaptiveStrategy: SwarmBenchmarkMetricSet
  summaryAnalysis: string
  scenarioDetails: {
    totalAgents: number
    simulatedDurationSec: number
    injectedDisconnections: number
    coordinatorPartitionCount: number
  }
}

