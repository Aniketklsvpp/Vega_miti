import React, { useState, useEffect } from 'react'
import {
  Clock,
  Filter,
  PlusCircle,
  RefreshCw,
  Search,
  Target,
} from 'lucide-react'
import { SwarmApi } from '../api/swarmApi'
import type { MissionPriority, MissionStatus, SwarmMission } from '../types/swarm'

export const MissionControlView: React.FC = () => {
  const [missions, setMissions] = useState<SwarmMission[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [newTitle, setNewTitle] = useState('')
  const [newStation, setNewStation] = useState('Guwahati Hydrometric Reach')
  const [newType, setNewType] = useState<SwarmMission['type']>('GAUGE_VERIFY')
  const [newPriority, setNewPriority] = useState<MissionPriority>('HIGH')
  const [newDetails, setNewDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    const res = await SwarmApi.getSwarmState()
    if (res.status === 'success') {
      setMissions(res.data.missions)
    }
  }

  useEffect(() => {
    loadData()
    const timer = setInterval(() => {
      loadData()
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setIsSubmitting(true)
    try {
      await SwarmApi.dispatchMission({
        title: newTitle,
        stationName: newStation,
        stationId: 'IND-MANUAL-01',
        type: newType,
        priority: newPriority,
        details: newDetails || 'Manually allocated emergency surveillance directive.',
      })
      await loadData()
      setIsModalOpen(false)
      setNewTitle('')
      setNewDetails('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredMissions = missions.filter((m) => {
    if (priorityFilter !== 'ALL' && m.priority !== priorityFilter) return false
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase()
      return (
        m.id.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.stationName.toLowerCase().includes(q) ||
        (m.assignedAgentId && m.assignedAgentId.toLowerCase().includes(q))
      )
    }
    return true
  })

  const getPriorityBadge = (priority: MissionPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-[#C94C55]/10 text-[#C94C55] border-[#C94C55]/30'
      case 'HIGH':
        return 'bg-[#D97745]/10 text-[#D97745] border-[#D97745]/30'
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      default:
        return 'bg-[#EAF0F3] text-[#647786] border-[#DCE4E9]'
    }
  }

  const getStatusBadge = (status: MissionStatus) => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'bg-[#28A6A1]/10 text-[#28A6A1] border-[#28A6A1]/30 animate-pulse'
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'ASSIGNED':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'EXPIRED':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'REASSIGNED':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#DCE4E9] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#EAF0F3] border border-[#DCE4E9] flex items-center justify-center text-[#19364A]">
            <Target className="w-5 h-5 text-[#28A6A1]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#19364A]">Mission Control & Task Leases</h2>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] border border-[#DCE4E9]">
                PHASE C &middot; P1
              </span>
            </div>
            <p className="text-xs text-[#647786]">
              Autonomous task allocation, bounded lease durations, priority queues, and dynamic failover reassignment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#19364A] hover:bg-[#28A6A1] text-white text-xs font-bold shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Deploy Custom Mission</span>
          </button>
          <button
            onClick={loadData}
            title="Refresh missions"
            className="p-2 rounded-lg bg-[#F5F7F8] hover:bg-[#EAF0F3] border border-[#DCE4E9] text-[#19364A] transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#DCE4E9] shadow-xs">
          <span className="text-xs text-[#647786] block">Total In Queue</span>
          <span className="text-2xl font-black text-[#19364A] font-mono mt-1 block">{missions.length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#DCE4E9] shadow-xs">
          <span className="text-xs text-[#647786] block">In Progress</span>
          <span className="text-2xl font-black text-[#28A6A1] font-mono mt-1 block">
            {missions.filter((m) => m.status === 'IN_PROGRESS').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#DCE4E9] shadow-xs">
          <span className="text-xs text-[#647786] block">Critical Tasks</span>
          <span className="text-2xl font-black text-[#C94C55] font-mono mt-1 block">
            {missions.filter((m) => m.priority === 'CRITICAL').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#DCE4E9] shadow-xs">
          <span className="text-xs text-[#647786] block">Reassigned Failovers</span>
          <span className="text-2xl font-black text-purple-600 font-mono mt-1 block">
            {missions.filter((m) => m.status === 'REASSIGNED').length}
          </span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-[#DCE4E9] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#DCE4E9]">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#28A6A1]" />
            <span className="text-xs font-bold text-[#19364A]">Mission Filters</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#647786] absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search missions, stations, agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-[#F5F7F8] border border-[#DCE4E9] rounded-lg text-[#19364A] focus:outline-hidden focus:ring-1 focus:ring-[#28A6A1] w-56"
              />
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#F5F7F8] border border-[#DCE4E9] rounded-lg text-[#19364A] font-medium"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#F5F7F8] border border-[#DCE4E9] rounded-lg text-[#19364A] font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="REASSIGNED">Reassigned</option>
              <option value="EXPIRED">Expired</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DCE4E9] text-[11px] font-bold text-[#647786] uppercase tracking-wider">
                <th className="py-2.5 px-3">Mission ID</th>
                <th className="py-2.5 px-3">Objective & Details</th>
                <th className="py-2.5 px-3">Station / Target</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Assigned Agent</th>
                <th className="py-2.5 px-3">Task Lease Timer</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4E9] text-xs">
              {filteredMissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#647786]">
                    No missions match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredMissions.map((mission) => {
                  return (
                    <tr key={mission.id} className="hover:bg-[#F5F7F8]/80 transition">
                      <td className="py-3 px-3 font-mono font-bold text-[#19364A]">
                        {mission.id}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#19364A]">{mission.title}</div>
                        <div className="text-[11px] text-[#647786] mt-0.5 line-clamp-1 max-w-xs" title={mission.details}>
                          {mission.details}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-[#19364A]">{mission.stationName}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getPriorityBadge(mission.priority)}`}>
                          {mission.priority}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {mission.assignedAgentId ? (
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#EAF0F3] border border-[#DCE4E9] text-[#19364A]">
                            {mission.assignedAgentId}
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-600 italic">Unassigned (Pending)</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {mission.remainingLeaseSec > 0 ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-[#19364A]">
                            <Clock className="w-3.5 h-3.5 text-[#28A6A1]" />
                            <span>{mission.remainingLeaseSec}s remaining</span>
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] text-[#C94C55]">Lease Expired</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getStatusBadge(mission.status)}`}>
                          {mission.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#DCE4E9] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE4E9]">
              <h3 className="font-bold text-base text-[#19364A]">Deploy Custom Swarm Mission</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-xs text-[#647786] hover:text-[#19364A] font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMission} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#19364A] block mb-1">Mission Objective Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Optical Verification of Embankment 4"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F7F8] border border-[#DCE4E9] rounded-lg text-[#19364A] focus:outline-hidden focus:ring-1 focus:ring-[#28A6A1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#19364A] block mb-1">Target Station / Basin</label>
                  <input
                    type="text"
                    value={newStation}
                    onChange={(e) => setNewStation(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F7F8] border border-[#DCE4E9] rounded-lg text-[#19364A]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#19364A] block mb-1">Mission Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#F5F7F8] border border-[#DCE4E9] rounded-lg text-[#19364A]"
                  >
                    <option value="GAUGE_VERIFY">Gauge Verification</option>
                    <option value="WATERWAY_SURVEY">Bathymetry / Cross-section</option>
                    <option value="COMM_RELAY">Communication Relay</option>
                    <option value="SURFACE_EVAL">Surface Velocity</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#19364A] block mb-1">Task Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#F5F7F8] border border-[#DCE4E9] rounded-lg text-[#19364A]"
                >
                  <option value="CRITICAL">Critical (Immediate Preemption)</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#19364A] block mb-1">Technical Directive Details</label>
                <textarea
                  rows={3}
                  placeholder="Specific instructions for sensor telemetry verification..."
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F7F8] border border-[#DCE4E9] rounded-lg text-[#19364A] focus:outline-hidden focus:ring-1 focus:ring-[#28A6A1]"
                />
              </div>

              <div className="pt-3 border-t border-[#DCE4E9] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#DCE4E9] text-[#647786] hover:bg-[#F5F7F8] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#19364A] hover:bg-[#28A6A1] text-white font-bold transition shadow-xs"
                >
                  {isSubmitting ? 'Dispatching...' : 'Confirm & Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
