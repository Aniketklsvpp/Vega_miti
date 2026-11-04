import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  History,
  AlertTriangle,
  Compass,
  ShieldCheck,
  FileText,
  Activity,
  Info,
  Droplet,
  Flame,
  Clock,
  Gauge,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface CatalogEvent {
  event_id: string
  title: string
  country: string
  state_or_region: string
  river: string
  start_date: string
  end_date: string
  peak_date: string
  timezone: string
  measurement_units: Record<string, string>
  primary_station_id: string
  primary_station_name: string
  latitude: number
  longitude: number
  total_days: number
  is_partial_record: boolean
  completeness_status: string
  regulatory_disclaimer: string
  data_provenance: Record<string, any>
}

interface ReplayStepFrame {
  step_index: number
  date: string
  timeline_phase: string
  observed_historical_state: {
    key_observation: string
    observation_timestamp: string
    publication_timestamp?: string
    rainfall_mm?: number
    rainfall_status?: string
    rainfall_source?: string
    water_level_m?: number | null
    water_level_status?: string
    water_level_source?: string
    upstream_release_cfs?: number | null
    upstream_release_cumec?: number | null
    upstream_release_status?: string
    upstream_release_source?: string
    in_situ_discharge_cfs?: number | null
    in_situ_discharge_status?: string
    discharge_cfs?: number | null
    discharge_status?: string
    discharge_source?: string
    discharge_semantics_clarification?: string
  }
  vega_miti_risk_assessment: {
    station_id: string
    date: string
    water_level_m?: number | null
    water_level_status?: string
    upstream_release_cfs?: number | null
    in_situ_discharge_cfs?: number | null
    discharge_cfs?: number | null
    rainfall_mm?: number
    risk_level: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'
    observed_risk_level?: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'
    predicted_risk_level?: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'
    risk_basis_discrepancy?: 'MISMATCH' | 'MATCH' | 'ALIGNED'
    discrepancy_explanation?: string
    evidence_quality: 'HIGH' | 'DEGRADED' | 'PROVISIONAL'
    data_quality_status: string
    evidence_quality_breakdown?: {
      individual_observation_confidence: string
      observation_confidence_basis: string
      record_completeness: string
      in_situ_discharge_availability: string
      spatial_rainfall_coverage: string
      overall_evidence_synthesis: string
    }
    completeness_status: string
    threshold_source: string
    is_provisional?: boolean
    statutory_reference_marks?: {
      warning_level_m?: number
      danger_level_m?: number
      prior_1978_record_m?: number
      historic_all_time_peak_m?: number
    }
    explanation?: string
    recommended_action?: string
    regulatory_disclaimer?: string
  }
  simulated_swarm_coordination?: {
    swarm_activation_state: string
    active_missions_count: number
    active_agent_allocations: {
      agent_id: string
      mission_id: string
      target_position: [number, number]
    }[]
    coordinator_status: string
  }
}

interface ReplayEventData {
  status: string
  event_id: string
  title: string
  country: string
  river: string
  timezone: string
  measurement_units: Record<string, string>
  geographic_context?: {
    latitude: number
    longitude: number
    primary_station_name: string
  }
  total_steps: number
  timeline_frames: ReplayStepFrame[]
}

export const HistoricalReplayView: React.FC = () => {
  const [catalog, setCatalog] = useState<CatalogEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('EVENT-IN-YAMUNA-2023')
  const [eventData, setEventData] = useState<ReplayEventData | null>(null)
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playbackSpeedMs, setPlaybackSpeedMs] = useState<number>(1800)
  const [showProvenanceModal, setShowProvenanceModal] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Fetch Catalog from Backend or Fallback
  useEffect(() => {
    let active = true
    async function loadCatalog() {
      try {
        const res = await fetch('/api/swarm/replay/events')
        if (res.ok) {
          const json = await res.json()
          if (active && json.data && json.data.length > 0) {
            setCatalog(json.data)
            return
          }
        }
      } catch {}

      // Static fallback
      try {
        const fallbackRes = await fetch('/data/swarm/historical_replay_catalog.json')
        if (fallbackRes.ok) {
          const fallbackJson = await fallbackRes.json()
          if (active) setCatalog(fallbackJson)
        }
      } catch {
        if (active) setLoadError('Failed to load historical replay catalog.')
      }
    }
    loadCatalog()
    return () => {
      active = false
    }
  }, [])

  // 2. Fetch Event Data when selectedEventId changes
  const loadEvent = useCallback(async (eventId: string) => {
    setLoading(true)
    setLoadError(null)
    setIsPlaying(false)

    // Try backend run endpoint first
    try {
      const res = await fetch('/api/swarm/replay/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, action: 'run' }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.data && json.data.timeline_frames) {
          setEventData(json.data)
          setCurrentStepIdx(0)
          setLoading(false)
          return
        }
      }
    } catch {}

    // Static local fallback
    try {
      const fileName =
        eventId === 'EVENT-IN-YAMUNA-2023'
          ? '/data/swarm/replay_yamuna_2023.json'
          : '/data/swarm/replay_susquehanna_2023.json'
      const fallbackRes = await fetch(fileName)
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json()
        setEventData(fallbackData)
        setCurrentStepIdx(0)
        setLoading(false)
        return
      }
    } catch {
      setLoadError(`Unable to load historical replay data for ${eventId}`)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadEvent(selectedEventId)
  }, [selectedEventId, loadEvent])

  // Current Step Frame
  const currentFrame = useMemo<ReplayStepFrame | null>(() => {
    if (!eventData || !eventData.timeline_frames || eventData.timeline_frames.length === 0) return null
    return eventData.timeline_frames[currentStepIdx] || eventData.timeline_frames[0]
  }, [eventData, currentStepIdx])

  const currentEventMeta = useMemo(() => {
    return catalog.find((c) => c.event_id === selectedEventId)
  }, [catalog, selectedEventId])

  // Playback timer
  useEffect(() => {
    if (!isPlaying || !eventData) return

    timerRef.current = setInterval(() => {
      setCurrentStepIdx((prev) => {
        if (prev >= eventData.timeline_frames.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, playbackSpeedMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, eventData, playbackSpeedMs])

  const togglePlay = () => setIsPlaying(!isPlaying)
  const stepForward = () => {
    setIsPlaying(false)
    if (eventData && currentStepIdx < eventData.timeline_frames.length - 1) {
      setCurrentStepIdx(currentStepIdx + 1)
    }
  }
  const stepBackward = () => {
    setIsPlaying(false)
    if (currentStepIdx > 0) {
      setCurrentStepIdx(currentStepIdx - 1)
    }
  }
  const resetPlayback = () => {
    setIsPlaying(false)
    setCurrentStepIdx(0)
  }

  // Pre-calculate full chart trends
  const isYamuna = selectedEventId === 'EVENT-IN-YAMUNA-2023'

  const stageChartData = useMemo(() => {
    if (!eventData) return []
    return eventData.timeline_frames.map((frame, idx) => ({
      index: idx,
      date: frame.date.slice(5),
      fullDate: frame.date,
      waterLevel: frame.observed_historical_state.water_level_m ?? null,
      upstreamRelease: frame.observed_historical_state.upstream_release_cfs ?? null,
      discharge: frame.observed_historical_state.discharge_cfs ?? null,
      rainfall: frame.observed_historical_state.rainfall_mm ?? 0,
      riskLevel: frame.vega_miti_risk_assessment.risk_level,
      isCurrent: idx === currentStepIdx,
    }))
  }, [eventData, currentStepIdx])

  const riskBadgeStyle = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-[#D8432B]/15 text-[#D8432B] border-[#D8432B]/40 animate-pulse'
      case 'WARNING':
        return 'bg-[#B8893B]/20 text-[#B8893B] border-[#B8893B]/50'
      case 'WATCH':
        return 'bg-amber-100/60 text-amber-800 border-amber-300'
      default:
        return 'bg-[#2F7F8F]/15 text-[#2F7F8F] border-[#2F7F8F]/30'
    }
  }

  // Check for risk discrepancy
  const riskAssessment = currentFrame?.vega_miti_risk_assessment
  const hasDiscrepancy =
    riskAssessment?.risk_basis_discrepancy === 'MISMATCH' ||
    (riskAssessment?.observed_risk_level &&
      riskAssessment?.predicted_risk_level &&
      riskAssessment.observed_risk_level !== riskAssessment.predicted_risk_level)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans text-[#1F2A33]">
      {/* Top Header Card */}
      <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1F2A33] text-[#FAF6EE] flex items-center justify-center shadow-xs">
            <History className="w-5 h-5 text-[#2F7F8F]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#1F2A33] tracking-tight">
                Historical Extreme Flood Replay
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#EAE1D2] text-[#526573] border border-[#DDD1BF]">
                ISOLATED REPLAY ENGINE
              </span>
            </div>
            <p className="text-xs text-[#526573] mt-0.5">
              Step-by-step chronological replay of verified historical flood events with separate stage, release, and risk classification.
            </p>
          </div>
        </div>

        {/* Event Selector Dropdown */}
        <div className="flex items-center gap-2.5">
          <label className="text-xs font-semibold text-[#526573] whitespace-nowrap">Event Target:</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-[#FAF6EE] border border-[#DDD1BF] text-xs font-bold rounded-xl px-3.5 py-2 text-[#1F2A33] focus:outline-hidden focus:border-[#2F7F8F] shadow-xs cursor-pointer max-w-xs truncate"
          >
            {catalog.map((cat) => (
              <option key={cat.event_id} value={cat.event_id}>
                {cat.country === 'India' ? '🇮🇳' : '🇺🇸'} {cat.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="p-16 text-center bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl text-xs text-[#526573] font-mono">
          <Activity className="w-6 h-6 text-[#2F7F8F] animate-spin mx-auto mb-2" />
          Loading historical telemetry, CWC/USGS bulletins, and synchronized replay frames...
        </div>
      )}

      {loadError && (
        <div className="p-6 bg-[#FBECE9] border border-[#D8432B]/30 rounded-2xl text-xs text-[#D8432B] flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {!loading && currentFrame && (
        <>
          {/* Partial Record Disclaimer Banner for India */}
          {isYamuna && (
            <div className="p-4 bg-[#FAF6EE] border-2 border-[#B8893B] rounded-2xl text-xs text-[#1F2A33] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-[#1F2A33]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#B8893B] animate-pulse" />
                  <span>PARTIAL RECORD SPECIFICATION — STAGE-ONLY GAUGE REACH</span>
                  <span className="text-[10px] font-mono font-bold bg-[#B8893B]/20 text-[#B8893B] px-2 py-0.5 rounded border border-[#B8893B]/30">
                    CWC YMN-DEL-ORB-01
                  </span>
                </div>
                <p className="text-[11.5px] text-[#526573] leading-relaxed">
                  Old Railway Bridge (ORB) Delhi is a <b>stage-only monitoring gauge</b> without continuous in-situ velocity/discharge streamflow metering. Upstream discharge is measured <b>228 km upstream at Hathnikund Barrage, Haryana</b>. VEGA-MITI visualizes river stage and upstream barrage release separately and does not assert instantaneous causal confluence.
                </p>
              </div>

              <button
                onClick={() => setShowProvenanceModal(true)}
                className="self-start md:self-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAE1D2] hover:bg-[#DDD1BF] text-xs font-semibold text-[#1F2A33] border border-[#DDD1BF] transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#2F7F8F]" />
                <span>Data Provenance Log</span>
              </button>
            </div>
          )}

          {/* Risk Basis Discrepancy Alert Banner */}
          {hasDiscrepancy && (
            <div className="p-4 bg-[#FBECE9] border-2 border-[#D8432B] rounded-2xl shadow-xs text-xs text-[#1F2A33] flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#D8432B] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#D8432B] uppercase tracking-wider text-[11px]">
                    Risk Basis Discrepancy Detected (MISMATCH)
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#D8432B]/20 text-[#D8432B]">
                    STAGE vs PREDICTED FLOW
                  </span>
                </div>
                <p className="text-xs text-[#1F2A33] leading-relaxed">
                  {riskAssessment?.discrepancy_explanation ||
                    `Observed flood level (${currentFrame.observed_historical_state.water_level_m} m MSL) reached CRITICAL severity breaching official statutory marks, while model precipitation-based estimation remained lower due to localized rainfall abatement. Flood surge arrived via upstream hydraulic wave propagation from Hathnikund Barrage releases.`}
                </p>
              </div>
            </div>
          )}

          {/* Transport Player Dock */}
          <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#2F7F8F]" />
                <span className="text-xs font-bold text-[#1F2A33]">Replay Timeline Control</span>
                <span className="text-[11px] font-mono text-[#526573]">
                  Step {currentStepIdx + 1} of {eventData?.total_steps} &bull; {currentFrame.date}
                </span>
              </div>

              {/* Transport Buttons */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={resetPlayback}
                  className="p-2 rounded-lg bg-[#EAE1D2] hover:bg-[#DDD1BF] text-[#1F2A33] transition border border-[#DDD1BF] cursor-pointer"
                  title="Reset to Beginning"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={stepBackward}
                  disabled={currentStepIdx === 0}
                  className="p-2 rounded-lg bg-[#EAE1D2] hover:bg-[#DDD1BF] disabled:opacity-40 text-[#1F2A33] transition border border-[#DDD1BF] cursor-pointer"
                  title="Step Backward"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={togglePlay}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer ${
                    isPlaying
                      ? 'bg-[#B8893B] text-white hover:bg-[#a6792f]'
                      : 'bg-[#2F7F8F] text-white hover:bg-[#256673]'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Play Replay</span>
                    </>
                  )}
                </button>
                <button
                  onClick={stepForward}
                  disabled={eventData ? currentStepIdx >= eventData.timeline_frames.length - 1 : true}
                  className="p-2 rounded-lg bg-[#EAE1D2] hover:bg-[#DDD1BF] disabled:opacity-40 text-[#1F2A33] transition border border-[#DDD1BF] cursor-pointer"
                  title="Step Forward"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>

                {/* Speed toggle */}
                <select
                  value={playbackSpeedMs}
                  onChange={(e) => setPlaybackSpeedMs(Number(e.target.value))}
                  className="bg-[#EAE1D2] border border-[#DDD1BF] text-[#1F2A33] text-[11px] font-mono font-bold rounded-lg px-2 py-1.5 focus:outline-hidden cursor-pointer"
                >
                  <option value={2400}>0.75x</option>
                  <option value={1800}>1.0x</option>
                  <option value={1000}>1.5x</option>
                  <option value={600}>2.5x</option>
                </select>
              </div>
            </div>

            {/* Scrubber Slider */}
            <div className="space-y-1.5 pt-2">
              <input
                type="range"
                min={0}
                max={eventData ? eventData.timeline_frames.length - 1 : 0}
                value={currentStepIdx}
                onChange={(e) => {
                  setIsPlaying(false)
                  setCurrentStepIdx(Number(e.target.value))
                }}
                className="w-full accent-[#2F7F8F] h-2 bg-[#EAE1D2] rounded-lg appearance-none cursor-pointer"
              />

              <div className="flex justify-between items-center text-[10px] font-mono text-[#526573]">
                {eventData?.timeline_frames.map((frame, i) => (
                  <button
                    key={frame.date}
                    onClick={() => {
                      setIsPlaying(false)
                      setCurrentStepIdx(i)
                    }}
                    className={`cursor-pointer transition ${
                      i === currentStepIdx
                        ? 'font-bold text-[#1F2A33] scale-110 underline decoration-[#2F7F8F] decoration-2'
                        : 'hover:text-[#1F2A33]'
                    }`}
                  >
                    {frame.date.slice(5)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Current Step Telemetry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Primary Gauge Metric */}
            <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-[#526573] mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider">
                  {isYamuna ? 'Delhi Gauge Stage' : 'USGS NWIS Discharge'}
                </span>
                <Gauge className="w-4 h-4 text-[#2F7F8F]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#1F2A33]">
                {isYamuna
                  ? `${currentFrame.observed_historical_state.water_level_m?.toFixed(2)} m MSL`
                  : `${currentFrame.observed_historical_state.discharge_cfs?.toLocaleString()} cfs`}
              </div>
              <div className="text-[11px] text-[#526573] mt-1 flex items-center justify-between">
                <span>
                  {isYamuna
                    ? currentFrame.observed_historical_state.water_level_m &&
                      currentFrame.observed_historical_state.water_level_m >= 205.33
                      ? 'Breached CWC Danger Level'
                      : 'Below CWC Danger Level'
                    : 'Verified Daily Streamflow'}
                </span>
                <span className="font-mono text-[10px] text-[#2F7F8F] bg-[#2F7F8F]/10 px-1.5 py-0.2 rounded">
                  OBSERVED
                </span>
              </div>
            </div>

            {/* 2. Upstream Barrage Release or Rainfall */}
            <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-[#526573] mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider">
                  {isYamuna ? 'Hathnikund Outflow (228km)' : '24h Basin Precipitation'}
                </span>
                <Droplet className="w-4 h-4 text-[#B8893B]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#1F2A33]">
                {isYamuna
                  ? `${currentFrame.observed_historical_state.upstream_release_cfs?.toLocaleString()} cfs`
                  : `${currentFrame.observed_historical_state.rainfall_mm?.toFixed(1)} mm`}
              </div>
              <div className="text-[11px] text-[#526573] mt-1 flex items-center justify-between">
                <span>
                  {isYamuna
                    ? `Transit: ~48–72h (${currentFrame.observed_historical_state.upstream_release_cumec?.toFixed(0)} cumec)`
                    : 'NASA POWER Daily Rainfall'}
                </span>
                <span className="font-mono text-[10px] text-[#B8893B] bg-[#B8893B]/10 px-1.5 py-0.2 rounded">
                  {isYamuna ? 'BARRAGE LOG' : 'METEO'}
                </span>
              </div>
            </div>

            {/* 3. In-Situ Streamflow Discharge Status */}
            <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-[#526573] mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider">
                  In-Situ Continuous Discharge
                </span>
                <Activity className="w-4 h-4 text-[#2F7F8F]" />
              </div>
              <div className="text-xl font-bold font-mono text-[#1F2A33]">
                {isYamuna ? (
                  <span className="text-[#526573] text-sm">UNMETERED IN-SITU</span>
                ) : (
                  `${currentFrame.observed_historical_state.discharge_cfs?.toLocaleString()} cfs`
                )}
              </div>
              <div className="text-[11px] text-[#526573] mt-1">
                {isYamuna
                  ? 'Stage-only monitoring reach at ORB Delhi'
                  : 'Gauging datum verified'}
              </div>
            </div>

            {/* 4. Risk Classification Tier */}
            <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-[#526573] mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider">
                  Evaluated Risk State
                </span>
                <Flame className="w-4 h-4 text-[#D8432B]" />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${riskBadgeStyle(
                    currentFrame.vega_miti_risk_assessment.risk_level
                  )}`}
                >
                  {currentFrame.vega_miti_risk_assessment.risk_level}
                </span>
                <span className="text-xs font-semibold text-[#526573]">
                  {currentFrame.timeline_phase}
                </span>
              </div>
              <div className="text-[11px] text-[#526573] mt-1 truncate">
                {currentFrame.vega_miti_risk_assessment.recommended_action || 'Monitoring telemetry'}
              </div>
            </div>
          </div>

          {/* Key Observation Strip */}
          <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#DDD1BF] text-xs text-[#1F2A33] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#2F7F8F] shrink-0" />
              <span className="font-semibold">Historical Key Observation:</span>
              <span className="text-[#526573]">{currentFrame.observed_historical_state.key_observation}</span>
            </div>
            <div className="text-[11px] font-mono text-[#526573] shrink-0">
              Recorded at {currentFrame.observed_historical_state.observation_timestamp.slice(11, 16)} IST
            </div>
          </div>

          {/* Visual Charts: Separate Stage & Barrage Release */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: River Stage (for Yamuna) or Streamflow (for US) */}
            <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DDD1BF]">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F2A33]">
                    {isYamuna ? 'Yamuna River Stage (Delhi ORB)' : 'USGS NWIS Streamflow Discharge'}
                  </h3>
                  <span className="text-[11px] text-[#526573]">
                    {isYamuna ? 'Unit: metres above MSL' : 'Unit: cubic feet per second (cfs)'}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-[#EAE1D2] px-2 py-0.5 rounded text-[#526573]">
                  {isYamuna ? 'CWC STATUTORY MARKS' : 'NWIS VERIFIED'}
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stageChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="stageGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2F7F8F" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#2F7F8F" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DDD1BF" opacity={0.6} />
                    <XAxis dataKey="date" stroke="#526573" fontSize={10} tickLine={false} />
                    <YAxis
                      stroke="#526573"
                      fontSize={10}
                      tickLine={false}
                      domain={isYamuna ? [202.5, 210] : ['dataMin - 10000', 'dataMax + 20000']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FAF6EE',
                        borderColor: '#DDD1BF',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#1F2A33',
                      }}
                    />
                    {isYamuna && (
                      <>
                        <ReferenceLine
                          y={204.5}
                          stroke="#B8893B"
                          strokeDasharray="4 4"
                          label={{ value: 'Warning 204.50m', fill: '#B8893B', fontSize: 9, position: 'insideTopLeft' }}
                        />
                        <ReferenceLine
                          y={205.33}
                          stroke="#D8432B"
                          strokeDasharray="4 4"
                          label={{ value: 'Danger 205.33m', fill: '#D8432B', fontSize: 9, position: 'insideTopLeft' }}
                        />
                        <ReferenceLine
                          y={207.49}
                          stroke="#7A49A5"
                          strokeDasharray="3 3"
                          label={{ value: '1978 Record 207.49m', fill: '#7A49A5', fontSize: 9, position: 'insideTopLeft' }}
                        />
                        <ReferenceLine
                          y={208.66}
                          stroke="#900C3F"
                          strokeWidth={1.5}
                          label={{ value: '2023 Crest 208.66m', fill: '#900C3F', fontSize: 9, position: 'insideTopLeft' }}
                        />
                      </>
                    )}
                    <Area
                      type="monotone"
                      dataKey={isYamuna ? 'waterLevel' : 'discharge'}
                      stroke="#2F7F8F"
                      strokeWidth={2.5}
                      fill="url(#stageGrad)"
                      name={isYamuna ? 'Stage (m MSL)' : 'Discharge (cfs)'}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-2 border-t border-[#DDD1BF]/60 text-[11px] text-[#526573] flex items-center justify-between">
                <span>Active Replay Point: <b>{currentFrame.date}</b></span>
                <span>Values logged from published government bulletins</span>
              </div>
            </div>

            {/* Chart 2: Upstream Barrage Release (for Yamuna) or Precipitation (for US) */}
            <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DDD1BF]">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F2A33]">
                    {isYamuna ? 'Upstream Release — Hathnikund Barrage (Haryana)' : 'Basin Meteorology & Temperature'}
                  </h3>
                  <span className="text-[11px] text-[#526573]">
                    {isYamuna ? 'Unit: cubic feet per second (cfs) — 228 km Upstream' : 'Unit: Rainfall (mm)'}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-[#EAE1D2] px-2 py-0.5 rounded text-[#526573]">
                  {isYamuna ? 'SEPARATE SERIES' : 'METEO TELEMETRY'}
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stageChartData} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DDD1BF" opacity={0.6} />
                    <XAxis dataKey="date" stroke="#526573" fontSize={10} tickLine={false} />
                    <YAxis
                      stroke="#526573"
                      fontSize={10}
                      tickLine={false}
                      domain={isYamuna ? [0, 400000] : [0, 'dataMax + 10']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FAF6EE',
                        borderColor: '#DDD1BF',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#1F2A33',
                      }}
                    />
                    {isYamuna && (
                      <ReferenceLine
                        y={300000}
                        stroke="#D8432B"
                        strokeDasharray="4 4"
                        label={{ value: 'Critical Release >300,000 cfs', fill: '#D8432B', fontSize: 9, position: 'insideTopRight' }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey={isYamuna ? 'upstreamRelease' : 'rainfall'}
                      stroke={isYamuna ? '#B8893B' : '#2F7F8F'}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#FAF6EE', strokeWidth: 2 }}
                      name={isYamuna ? 'Hathnikund Release (cfs)' : 'Rainfall (mm)'}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-2 border-t border-[#DDD1BF]/60 text-[11px] text-[#526573] flex items-center justify-between">
                <span>
                  {isYamuna
                    ? 'Logged by Department of Irrigation & Water Resources, Haryana'
                    : 'NASA POWER Daily Meteorological Records'}
                </span>
                <span>Peak Barrage Outflow: <b>359,000 cfs</b></span>
              </div>
            </div>
          </div>

          {/* Synchronized Swarm Coordination at Current Step */}
          {currentFrame.simulated_swarm_coordination && (
            <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DDD1BF]">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#2F7F8F]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F2A33]">
                    Synchronized Multi-Agent Swarm Status (Simulated Step Frame)
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#526573]">Activation State:</span>
                  <span className="px-2 py-0.5 rounded font-bold bg-[#1F2A33] text-[#FAF6EE]">
                    {currentFrame.simulated_swarm_coordination.swarm_activation_state}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="p-3 bg-[#EAE1D2]/60 rounded-xl border border-[#DDD1BF] text-xs">
                  <span className="text-[#526573] block mb-1">Coordinator Heartbeat</span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-mono font-bold text-[#1F2A33]">
                      {currentFrame.simulated_swarm_coordination.coordinator_status}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-[#EAE1D2]/60 rounded-xl border border-[#DDD1BF] text-xs">
                  <span className="text-[#526573] block mb-1">Active Deployed Missions</span>
                  <span className="font-mono font-bold text-lg text-[#1F2A33]">
                    {currentFrame.simulated_swarm_coordination.active_missions_count} Missions
                  </span>
                </div>

                <div className="p-3 bg-[#EAE1D2]/60 rounded-xl border border-[#DDD1BF] text-xs">
                  <span className="text-[#526573] block mb-1">Allocated Agents</span>
                  <span className="font-mono font-bold text-[#2F7F8F]">
                    {currentFrame.simulated_swarm_coordination.active_agent_allocations.length} Active Recon Links
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-[#526573] italic pt-1">
                Note: Agent movement and allocation are executed on the simulated 20×20 discrete Cartesian grid, triggered autonomously by risk escalation at each chronological step.
              </p>
            </div>
          )}
        </>
      )}

      {/* Provenance & Methodology Modal */}
      {showProvenanceModal && currentEventMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD1BF]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#2F7F8F]" />
                <h3 className="text-base font-bold text-[#1F2A33]">
                  Hydrological Data Provenance & Source Registry
                </h3>
              </div>
              <button
                onClick={() => setShowProvenanceModal(false)}
                className="text-xs font-bold px-2 py-1 rounded bg-[#EAE1D2] hover:bg-[#DDD1BF] cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#1F2A33]">
              <div className="p-3 bg-[#EAE1D2]/60 rounded-xl border border-[#DDD1BF]">
                <h4 className="font-bold text-[#2F7F8F] mb-1">1. River Water Level & Statutory Stages</h4>
                <p className="text-[#526573] leading-relaxed">
                  <b>Issuing Authority:</b> Central Water Commission (CWC), Ministry of Jal Shakti, Government of India.<br />
                  <b>Publication:</b> Daily River Stage Bulletin for Old Railway Bridge Delhi (Station Code: 004-MDELHI).<br />
                  <b>Statutory Reference:</b> Warning Level = 204.50 m MSL, Danger Level = 205.33 m MSL.
                </p>
              </div>

              <div className="p-3 bg-[#EAE1D2]/60 rounded-xl border border-[#DDD1BF]">
                <h4 className="font-bold text-[#B8893B] mb-1">2. Upstream Barrage Outflow Register</h4>
                <p className="text-[#526573] leading-relaxed">
                  <b>Issuing Authority:</b> Department of Irrigation and Water Resources, Government of Haryana.<br />
                  <b>Record:</b> Hathnikund Barrage Daily Inflow & Outflow Register (Yamunanagar Flood Control Room).<br />
                  <b>Hydraulic Transit:</b> 228 km upstream; approximate 48–72h transit window depending on baseflow.
                </p>
              </div>

              <div className="p-3 bg-[#EAE1D2]/60 rounded-xl border border-[#DDD1BF]">
                <h4 className="font-bold text-[#2F7F8F] mb-1">3. In-Situ Streamflow Velocity Status</h4>
                <p className="text-[#526573] leading-relaxed">
                  <b>Status:</b> <code>UNMETERED_IN_SITU</code>. Continuous streamflow velocity is not metered at Old Railway Bridge Delhi. VEGA-MITI strictly refuses to manufacture synthetic hourly discharge values for unmetered stations.
                </p>
              </div>

              <div className="p-3 bg-[#EAE1D2]/60 rounded-xl border border-[#DDD1BF]">
                <h4 className="font-bold text-[#1F2A33] mb-1">4. Statutory Disclaimer</h4>
                <p className="text-[#526573] leading-relaxed">
                  {currentEventMeta.regulatory_disclaimer}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HistoricalReplayView
