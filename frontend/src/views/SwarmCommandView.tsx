import React, { useState, useEffect } from 'react'
import {
  AlertCircle,
  Battery,
  Compass,
  Cpu,
  Layers,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { SwarmApi } from '../api/swarmApi'
import type { CoordinatorState, SwarmAgent, SwarmMission } from '../types/swarm'

interface SwarmCommandViewProps {
  onNavigateToMissions?: () => void
  onNavigateToResilience?: () => void
}

export const SwarmCommandView: React.FC<SwarmCommandViewProps> = ({
  onNavigateToMissions,
  onNavigateToResilience,
}) => {
  const [agents, setAgents] = useState<SwarmAgent[]>([])
  const [coordinator, setCoordinator] = useState<CoordinatorState | null>(null)
  const [missions, setMissions] = useState<SwarmMission[]>([])
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  const refreshData = async () => {
    const res = await SwarmApi.getSwarmState()
    if (res.status === 'success') {
      setAgents(res.data.agents)
      setCoordinator(res.data.coordinator)
      setMissions(res.data.missions)
    }
  }

  useEffect(() => {
    refreshData()
    const timer = setInterval(() => {
      refreshData()
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  const handleToggleDisconnect = async (agent: SwarmAgent) => {
    setActionInProgress(agent.id)
    try {
      if (agent.connectivity === 'CONNECTED') {
        await SwarmApi.disconnectAgent(agent.id)
      } else {
        await SwarmApi.reconnectAgent(agent.id)
      }
      await refreshData()
    } finally {
      setActionInProgress(null)
    }
  }

  const getAgentTypeBadge = (type: string) => {
    switch (type) {
      case 'DRONE_SURVEY':
        return { label: 'Aerial Drone', color: 'bg-sky-50 text-sky-700 border-sky-200' }
      case 'ROV_DEPTH':
        return { label: 'Bathymetry ROV', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
      case 'GROUND_SENSOR':
        return { label: 'Hydrometer Node', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      case 'RELAY_NODE':
        return { label: 'Mesh Relay', color: 'bg-purple-50 text-purple-700 border-purple-200' }
      default:
        return { label: type, color: 'bg-gray-50 text-gray-700 border-gray-200' }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ON_MISSION':
        return { label: 'ON MISSION', color: 'bg-[#28A6A1]/10 text-[#28A6A1] border-[#28A6A1]/30 animate-pulse' }
      case 'EN_ROUTE':
        return { label: 'EN ROUTE', color: 'bg-blue-50 text-blue-600 border-blue-200' }
      case 'IDLE':
        return { label: 'STANDBY / IDLE', color: 'bg-gray-100 text-[#647786] border-[#DCE4E9]' }
      case 'FAULT':
        return { label: 'FAULT / UNREACHABLE', color: 'bg-[#C94C55]/10 text-[#C94C55] border-[#C94C55]/30' }
      default:
        return { label: status, color: 'bg-gray-50 text-gray-600 border-gray-200' }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#DCE4E9] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#EAF0F3] border border-[#DCE4E9] flex items-center justify-center text-[#19364A]">
            <Layers className="w-5 h-5 text-[#28A6A1]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#19364A]">Swarm Command Center</h2>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] border border-[#DCE4E9]">
                PHASE B &middot; P0
              </span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                DIGITAL MULTI-AGENT SIMULATION
              </span>
            </div>
            <p className="text-xs text-[#647786]">
              Real-time telemetry, mesh connectivity, and lease monitoring for 6 simulated autonomous agents.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {coordinator && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold ${
                coordinator.status === 'HEALTHY'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current"></span>
              <span>COORDINATOR: {coordinator.status}</span>
            </div>
          )}

          <button
            onClick={refreshData}
            title="Poll telemetry state"
            className="p-2 rounded-lg bg-[#F5F7F8] hover:bg-[#EAF0F3] border border-[#DCE4E9] text-[#19364A] transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Digital Simulation Environment Notice:</span> All agent tracking, battery
          gauges, and spatial telemetry represent a synthetic in-silico multi-agent simulation testbed designed to
          verify distributed coordination algorithms under communication disruptions.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-[#DCE4E9] shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE4E9]">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#28A6A1]" />
              <span className="text-xs font-bold text-[#19364A]">2D Mesh Topology & Agent Simulation Grid</span>
            </div>
            <span className="text-[11px] font-mono text-[#647786]">Coordinate Space: 100 &times; 100</span>
          </div>

          <div className="relative w-full h-80 mt-4 bg-[#F5F7F8] rounded-xl border border-[#DCE4E9] overflow-hidden flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#DCE4E9" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {agents.map((agent, i) => {
                if (agent.connectivity === 'DISCONNECTED') return null
                const other = agents[(i + 1) % agents.length]
                if (other.connectivity === 'DISCONNECTED') return null
                return (
                  <line
                    key={`link-${agent.id}-${other.id}`}
                    x1={`${agent.position.x}%`}
                    y1={`${agent.position.y}%`}
                    x2={`${other.position.x}%`}
                    y2={`${other.position.y}%`}
                    stroke="#28A6A1"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    strokeOpacity="0.5"
                  />
                )
              })}

              {agents.map((agent) => {
                if (!agent.targetPosition || agent.connectivity === 'DISCONNECTED') return null
                return (
                  <line
                    key={`route-${agent.id}`}
                    x1={`${agent.position.x}%`}
                    y1={`${agent.position.y}%`}
                    x2={`${agent.targetPosition.x}%`}
                    y2={`${agent.targetPosition.y}%`}
                    stroke="#398DB5"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeOpacity="0.8"
                  />
                )
              })}
            </svg>

            <div
              className="absolute z-10 p-1.5 rounded-lg bg-[#19364A] text-white shadow-md text-[10px] font-mono flex items-center gap-1 border border-[#19364A]/40"
              style={{ left: '48%', top: '48%', transform: 'translate(-50%, -50%)' }}
            >
              <Cpu className="w-3.5 h-3.5 text-[#28A6A1]" />
              <span>COORDINATOR</span>
            </div>

            {agents.map((agent) => {
              const isDisconnected = agent.connectivity === 'DISCONNECTED'
              return (
                <div
                  key={agent.id}
                  className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 cursor-pointer group`}
                  style={{ left: `${agent.position.x}%`, top: `${agent.position.y}%` }}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-[10px] font-bold border-2 shadow-sm transition ${
                      isDisconnected
                        ? 'bg-rose-100 border-[#C94C55] text-[#C94C55]'
                        : agent.status === 'ON_MISSION'
                          ? 'bg-[#28A6A1] border-white text-white ring-2 ring-[#28A6A1]/40'
                          : 'bg-white border-[#19364A] text-[#19364A]'
                    }`}
                  >
                    {agent.id.replace('AG-0', '')}
                  </div>

                  <div className="absolute left-1/2 -translate-x-1/2 top-8 whitespace-nowrap bg-[#19364A] text-white text-[10px] font-mono px-2 py-0.5 rounded shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition z-30">
                    {agent.name} &bull; {agent.status} &bull; {agent.batteryPct}%
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#647786] pt-3 border-t border-[#DCE4E9]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#28A6A1]"></span> On Mission
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white border border-[#19364A]"></span> Standby
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-100 border border-[#C94C55]"></span> Disconnected
              </span>
            </div>
            <span className="font-mono text-[11px]">Dynamic A* Waypoints Active</span>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#DCE4E9] shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE4E9]">
              <span className="text-xs font-bold text-[#19364A]">Swarm Fleet Status Summary</span>
              <span className="text-[11px] font-mono font-bold text-[#28A6A1]">{agents.length} AGENTS ONLINE</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <button
                onClick={() => onNavigateToMissions && onNavigateToMissions()}
                className="p-2.5 rounded-lg bg-[#F5F7F8] hover:bg-[#EAF0F3] border border-[#DCE4E9] text-center transition cursor-pointer"
                title="View in Mission Control"
              >
                <span className="text-[10px] text-[#647786] block">Active Missions</span>
                <span className="text-lg font-black text-[#19364A] font-mono">
                  {missions.filter((m) => m.status === 'IN_PROGRESS').length}
                </span>
              </button>
              <div className="p-2.5 rounded-lg bg-[#F5F7F8] border border-[#DCE4E9] text-center">
                <span className="text-[10px] text-[#647786] block">Connected</span>
                <span className="text-lg font-black text-emerald-600 font-mono">
                  {agents.filter((a) => a.connectivity === 'CONNECTED').length} / {agents.length}
                </span>
              </div>
              <button
                onClick={() => onNavigateToResilience && onNavigateToResilience()}
                className="p-2.5 rounded-lg bg-[#F5F7F8] hover:bg-rose-50 border border-[#DCE4E9] text-center transition cursor-pointer"
                title="View in Network Resilience"
              >
                <span className="text-[10px] text-[#647786] block">Disconnected</span>
                <span className="text-lg font-black text-[#C94C55] font-mono">
                  {agents.filter((a) => a.connectivity === 'DISCONNECTED').length}
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {agents.map((agent) => {
              const typeBadge = getAgentTypeBadge(agent.type)
              const statusBadge = getStatusBadge(agent.status)
              const isDisconnected = agent.connectivity === 'DISCONNECTED'
              const assignedMission = missions.find((m) => m.id === agent.currentMissionId)

              return (
                <div
                  key={agent.id}
                  className={`bg-white p-3.5 rounded-xl border transition ${
                    isDisconnected
                      ? 'border-[#C94C55]/40 bg-rose-50/20'
                      : 'border-[#DCE4E9] hover:border-[#28A6A1]/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-[#19364A] px-1.5 py-0.5 rounded bg-[#EAF0F3] border border-[#DCE4E9]">
                        {agent.id}
                      </span>
                      <span className="text-xs font-bold text-[#19364A]">{agent.name}</span>
                    </div>

                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${typeBadge.color}`}>
                      {typeBadge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2.5 text-xs text-[#647786]">
                    <div className="flex items-center gap-1.5">
                      <Battery className="w-3.5 h-3.5 text-[#19364A]" />
                      <span>Battery:</span>
                      <span
                        className={`font-mono font-bold ${
                          agent.batteryPct > 70
                            ? 'text-emerald-600'
                            : agent.batteryPct > 35
                              ? 'text-amber-600'
                              : 'text-rose-600'
                        }`}
                      >
                        {agent.batteryPct}%
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isDisconnected ? (
                        <>
                          <WifiOff className="w-3.5 h-3.5 text-[#C94C55]" />
                          <span className="font-bold text-[#C94C55]">LINK DOWN</span>
                        </>
                      ) : (
                        <>
                          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-mono text-[#19364A]">{agent.latencyMs}ms</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-[#DCE4E9]/80 flex items-center justify-between gap-2">
                    <div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                      {assignedMission && (
                        <span className="text-[11px] text-[#647786] block mt-1 truncate max-w-[200px]" title={assignedMission.title}>
                          Mission: {assignedMission.id} &bull; {assignedMission.title}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleToggleDisconnect(agent)}
                      disabled={actionInProgress === agent.id}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition ${
                        isDisconnected
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                          : 'bg-white hover:bg-rose-50 text-[#C94C55] border-[#C94C55]/30'
                      }`}
                      title={isDisconnected ? 'Restore agent link' : 'Simulate signal loss / drop'}
                    >
                      {actionInProgress === agent.id
                        ? 'Syncing...'
                        : isDisconnected
                          ? 'Reconnect'
                          : 'Disconnect'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
