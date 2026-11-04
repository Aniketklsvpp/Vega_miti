import React, { useState, useEffect } from 'react'
import {
  AlertOctagon,
  CheckCircle,
  History,
  Network,
  RefreshCw,
  Server,
  ServerOff,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react'
import { SwarmApi } from '../api/swarmApi'
import type { CoordinatorState, NetworkEventLog, SwarmAgent } from '../types/swarm'

export const NetworkResilienceView: React.FC = () => {
  const [coordinator, setCoordinator] = useState<CoordinatorState | null>(null)
  const [agents, setAgents] = useState<SwarmAgent[]>([])
  const [eventLogs, setEventLogs] = useState<NetworkEventLog[]>([])
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  const loadData = async () => {
    const [stateRes, logRes] = await Promise.all([
      SwarmApi.getSwarmState(),
      SwarmApi.getNetworkEventLogs(),
    ])
    if (stateRes.status === 'success') {
      setCoordinator(stateRes.data.coordinator)
      setAgents(stateRes.data.agents)
    }
    if (logRes.status === 'success') {
      setEventLogs(logRes.data)
    }
  }

  useEffect(() => {
    loadData()
    const timer = setInterval(() => {
      loadData()
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  const handleDisconnectRandom = async () => {
    const connected = agents.filter((a) => a.connectivity === 'CONNECTED')
    if (connected.length === 0) {
      setFeedbackMsg('All agents are already disconnected.')
      return
    }
    const target = connected[Math.floor(Math.random() * connected.length)]
    setActiveAction(`disconnect-${target.id}`)
    try {
      await SwarmApi.disconnectAgent(target.id)
      setFeedbackMsg(`Signal loss injected for ${target.name} (${target.id}). Tasks auto-reassigned.`)
      await loadData()
    } finally {
      setActiveAction(null)
    }
  }

  const handleFailCoordinator = async () => {
    setActiveAction('fail-coord')
    try {
      await SwarmApi.failCoordinator()
      setFeedbackMsg('CENTRAL COORDINATOR FAULT INJECTED. Mesh transitioned to decentralized fallback.')
      await loadData()
    } finally {
      setActiveAction(null)
    }
  }

  const handleRestoreNetwork = async () => {
    setActiveAction('restore-net')
    try {
      await SwarmApi.restoreNetwork()
      setFeedbackMsg('Network links & Central Coordinator restored. Buffered events synchronized.')
      await loadData()
    } finally {
      setActiveAction(null)
    }
  }

  const getSeverityBadge = (sev: NetworkEventLog['severity']) => {
    switch (sev) {
      case 'critical':
        return 'bg-[#C94C55]/10 text-[#C94C55] border-[#C94C55]/30'
      case 'warning':
        return 'bg-[#D97745]/10 text-[#D97745] border-[#D97745]/30'
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#DCE4E9] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#EAF0F3] border border-[#DCE4E9] flex items-center justify-center text-[#19364A]">
            <Network className="w-5 h-5 text-[#28A6A1]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#19364A]">Network Resilience & Fault Injection</h2>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] border border-[#DCE4E9]">
                PHASE D &middot; P1
              </span>
            </div>
            <p className="text-xs text-[#647786]">
              Distributed consensus, partition recovery, event buffering, and autonomous task lease failover.
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          title="Refresh network state"
          className="p-2 rounded-lg bg-[#F5F7F8] hover:bg-[#EAF0F3] border border-[#DCE4E9] text-[#19364A] transition self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
          <span className="font-semibold">{feedbackMsg}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-blue-700 hover:text-blue-900 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-[#DCE4E9] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE4E9]">
              <span className="text-xs font-bold text-[#647786] uppercase tracking-wider">Coordinator Node Health</span>
              <span className="text-[11px] font-mono text-[#647786]">Port 8000 Mesh Gateway</span>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                  coordinator?.status === 'HEALTHY'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse'
                }`}
              >
                {coordinator?.status === 'HEALTHY' ? <Server className="w-6 h-6" /> : <ServerOff className="w-6 h-6" />}
              </div>
              <div>
                <span className="text-xs text-[#647786] block">Consensus State</span>
                <span
                  className={`text-lg font-black font-mono ${
                    coordinator?.status === 'HEALTHY' ? 'text-emerald-700' : 'text-[#C94C55]'
                  }`}
                >
                  {coordinator?.status || 'UNKNOWN'}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-[#647786]">
              <div className="flex justify-between">
                <span>Heartbeat Interval:</span>
                <span className="font-mono font-bold text-[#19364A]">{coordinator?.heartbeatIntervalMs || 2000}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Active Consensus Quorum:</span>
                <span className="font-mono font-bold text-[#19364A]">
                  {coordinator?.activeAgents || 0} / {agents.length} nodes
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Vector Clock Sync:</span>
                <span className="font-mono text-[#647786]">
                  {coordinator ? new Date(coordinator.lastSyncTimestamp).toLocaleTimeString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#DCE4E9] text-xs text-[#647786]">
            {coordinator?.status === 'HEALTHY' ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Centralized dispatching operational
              </span>
            ) : (
              <span className="text-[#C94C55] font-bold flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" /> Partitioned: Agents using local lease rules
              </span>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-[#DCE4E9] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE4E9]">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#D97745]" />
                <span className="text-xs font-bold text-[#19364A]">Interactive Fault Injection Matrix</span>
              </div>
              <span className="text-[11px] text-[#647786]">Real Backend API Calls</span>
            </div>

            <p className="text-xs text-[#647786] mt-3">
              Trigger real-world network anomalies to verify autonomous failover behavior, bounded lease expiration,
              and peer-to-peer event buffering.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <button
                onClick={handleDisconnectRandom}
                disabled={activeAction !== null}
                className="p-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100/80 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <WifiOff className="w-4 h-4 text-[#C94C55]" />
                  <span className="text-[10px] font-mono text-rose-700 font-bold">NODE FAULT</span>
                </div>
                <h4 className="text-xs font-bold text-[#C94C55] mt-2">Disconnect Agent</h4>
                <p className="text-[11px] text-[#647786] mt-0.5">
                  Cuts radio telemetry on a random agent. Triggers automatic lease re-assignment.
                </p>
              </button>

              <button
                onClick={handleFailCoordinator}
                disabled={activeAction !== null || coordinator?.status === 'FAILED'}
                className="p-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100/80 text-left transition disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <ServerOff className="w-4 h-4 text-amber-700" />
                  <span className="text-[10px] font-mono text-amber-700 font-bold">SPLIT BRAIN</span>
                </div>
                <h4 className="text-xs font-bold text-amber-800 mt-2">Fail Coordinator</h4>
                <p className="text-[11px] text-[#647786] mt-0.5">
                  Takes central coordinator offline. Forces mesh to decentralized local consensus.
                </p>
              </button>

              <button
                onClick={handleRestoreNetwork}
                disabled={activeAction !== null}
                className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <Wifi className="w-4 h-4 text-emerald-700" />
                  <span className="text-[10px] font-mono text-emerald-700 font-bold">HEAL MESH</span>
                </div>
                <h4 className="text-xs font-bold text-emerald-800 mt-2">Restore Network</h4>
                <p className="text-[11px] text-[#647786] mt-0.5">
                  Re-establishes all links, flushes event buffers, and synchronizes clocks.
                </p>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#DCE4E9] flex items-center justify-between text-xs text-[#647786]">
            <span>Current Disconnected Nodes: {agents.filter((a) => a.connectivity === 'DISCONNECTED').length}</span>
            <span>Total Buffered Packets: {agents.reduce((acc, a) => acc + a.bufferedEventCount, 0)} packets</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-[#DCE4E9] shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE4E9]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#28A6A1]" />
            <span className="text-xs font-bold text-[#19364A]">Resilience Event Stream & Sync Audit Log</span>
          </div>
          <span className="text-[11px] font-mono text-[#647786]">{eventLogs.length} Events Recorded</span>
        </div>

        <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
          {eventLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#647786]">No network disruption events recorded yet.</div>
          ) : (
            eventLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg border border-[#DCE4E9] bg-[#F5F7F8] flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border mt-0.5 ${getSeverityBadge(
                      log.severity
                    )}`}
                  >
                    {log.type}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-[#19364A]">{log.message}</p>
                    <div className="flex items-center gap-3 text-[11px] text-[#647786] mt-0.5 font-mono">
                      <span>ID: {log.id}</span>
                      {log.agentId && <span>Agent: {log.agentId}</span>}
                      {log.missionId && <span>Mission: {log.missionId}</span>}
                    </div>
                  </div>
                </div>

                <span className="text-[11px] text-[#647786] font-mono whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
