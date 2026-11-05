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
  TrendingUp,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import StatsCounter from '../components/ui/stats-counter'

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

const DEFAULT_CATALOG: CatalogEvent[] = [
  {
    event_id: 'EVENT-IN-YAMUNA-2023',
    title: 'July 2023 Yamuna River Mega-Flood (Delhi NCR & Haryana, India)',
    country: 'India',
    state_or_region: 'National Capital Territory of Delhi / Haryana',
    river: 'Yamuna River (Upper Yamuna Basin)',
    start_date: '2023-07-07',
    end_date: '2023-07-18',
    peak_date: '2023-07-13',
    timezone: 'IST (UTC+05:30)',
    measurement_units: {
      river_stage: 'metres above Mean Sea Level (m MSL)',
      upstream_discharge_release: 'cubic feet per second (cfs)',
      precipitation: 'millimetres (mm)',
    },
    primary_station_id: 'YMN-DEL-ORB-01',
    primary_station_name: 'Old Railway Bridge (ORB), Delhi',
    latitude: 28.663,
    longitude: 77.234,
    total_days: 12,
    is_partial_record: true,
    completeness_status: 'PARTIAL_STAGE_ONLY_RECORD',
    regulatory_disclaimer:
      'Old Railway Bridge (ORB) Delhi is a stage-only monitoring gauge without continuous in-situ velocity/discharge streamflow metering. Upstream discharge is measured 228 km upstream at Hathnikund Barrage, Haryana. VEGA-MITI visualizes river stage and upstream barrage release separately and does not assert instantaneous causal confluence.',
    data_provenance: {},
  },
  {
    event_id: 'EVENT-US-SUSQUEHANNA-2023',
    title: 'September 2023 Susquehanna Basin Runoff Surge (Pennsylvania, USA)',
    country: 'USA',
    state_or_region: 'Pennsylvania',
    river: 'Susquehanna River',
    start_date: '2023-09-08',
    end_date: '2023-09-19',
    peak_date: '2023-09-13',
    timezone: 'EDT (UTC-04:00)',
    measurement_units: {
      streamflow_discharge: 'cubic feet per second (cfs)',
      gauge_height: 'feet (ft)',
      precipitation: 'inches (in)',
    },
    primary_station_id: '01570500',
    primary_station_name: 'Susquehanna River at Harrisburg, PA',
    latitude: 40.252,
    longitude: -76.883,
    total_days: 12,
    is_partial_record: false,
    completeness_status: 'COMPLETE_USGS_RECORD',
    regulatory_disclaimer:
      'Official USGS hydrometric streamgage data with continuous in-situ stage-discharge rating curve velocity measurements.',
    data_provenance: {},
  },
]

export const HistoricalReplayView: React.FC = () => {
  const [catalog, setCatalog] = useState<CatalogEvent[]>(DEFAULT_CATALOG)
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
          if (active) {
            setCatalog(fallbackJson)
            return
          }
        }
      } catch {}
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

  const chartData = useMemo(() => {
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
        return 'bg-[#C94C55]/10 text-[#C94C55] border-[#C94C55]/30'
      case 'WARNING':
        return 'bg-[#D97745]/10 text-[#D97745] border-[#D97745]/30'
      case 'WATCH':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
  }

  // Check for risk discrepancy
  const riskAssessment = currentFrame?.vega_miti_risk_assessment
  const hasDiscrepancy =
    riskAssessment?.risk_basis_discrepancy === 'MISMATCH' ||
    (riskAssessment?.observed_risk_level &&
      riskAssessment?.predicted_risk_level &&
      riskAssessment.observed_risk_level !== riskAssessment.predicted_risk_level)

  // Custom Active Dot for Graphs highlighting current frame
  const renderActiveStageDot = (props: any) => {
    const { cx, cy, payload } = props
    if (!cx || !cy) return null
    const isCurrent = payload.index === currentStepIdx
    if (!isCurrent) {
      return (
        <circle cx={cx} cy={cy} r={3.5} fill="#FFFFFF" stroke="#2563EB" strokeWidth={1.5} />
      )
    }
    return (
      <g key={`stage-dot-${payload.index}`}>
        <circle cx={cx} cy={cy} r={10} fill="#2563EB" opacity={0.25} className="animate-ping" />
        <circle cx={cx} cy={cy} r={5.5} fill="#2563EB" stroke="#FFFFFF" strokeWidth={2} />
      </g>
    )
  }

  const renderActiveReleaseDot = (props: any) => {
    const { cx, cy, payload } = props
    if (!cx || !cy) return null
    const isCurrent = payload.index === currentStepIdx
    if (!isCurrent) {
      return (
        <circle cx={cx} cy={cy} r={3.5} fill="#FFFFFF" stroke="#D97745" strokeWidth={1.5} />
      )
    }
    return (
      <g key={`release-dot-${payload.index}`}>
        <circle cx={cx} cy={cy} r={10} fill="#D97745" opacity={0.25} className="animate-ping" />
        <circle cx={cx} cy={cy} r={5.5} fill="#D97745" stroke="#FFFFFF" strokeWidth={2} />
      </g>
    )
  }

  // Custom modern tooltips
  const StageTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white/95 backdrop-blur-md border border-[#DCE4E9] rounded-xl p-3 shadow-xl text-xs space-y-1.5 font-sans z-50 min-w-[200px]">
          <div className="flex items-center justify-between gap-4 font-mono text-[11px] text-[#647786] border-b border-[#DCE4E9] pb-1">
            <span className="font-bold text-[#19364A]">{data.fullDate || label}</span>
            <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] border ${riskBadgeStyle(data.riskLevel)}`}>
              {data.riskLevel}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-0.5">
            <span className="text-[#647786] font-medium">{isYamuna ? 'River Stage:' : 'Streamflow:'}</span>
            <span className="font-bold font-mono text-[#19364A] text-sm">
              {data.waterLevel != null
                ? `${data.waterLevel.toFixed(2)} m MSL`
                : data.discharge != null
                ? `${data.discharge.toLocaleString()} cfs`
                : '—'}
            </span>
          </div>
          {isYamuna && data.waterLevel != null && (
            <div className="text-[10.5px] font-semibold text-[#647786] pt-1 border-t border-[#DCE4E9]/60 flex items-center gap-1">
              {data.waterLevel >= 208.66 ? (
                <span className="text-rose-700">★ All-Time Historical Crest Breached</span>
              ) : data.waterLevel >= 205.33 ? (
                <span className="text-[#C94C55]">⚠ CWC Danger Level Exceeded</span>
              ) : data.waterLevel >= 204.50 ? (
                <span className="text-[#D97745]">⚡ CWC Warning Mark Exceeded</span>
              ) : (
                <span className="text-emerald-700">✔ Below Statutory Warning Mark</span>
              )}
            </div>
          )}
        </div>
      )
    }
    return null
  }

  const ReleaseTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white/95 backdrop-blur-md border border-[#DCE4E9] rounded-xl p-3 shadow-xl text-xs space-y-1.5 font-sans z-50 min-w-[200px]">
          <div className="flex items-center justify-between gap-4 font-mono text-[11px] text-[#647786] border-b border-[#DCE4E9] pb-1">
            <span className="font-bold text-[#19364A]">{data.fullDate || label}</span>
            <span className="text-[#D97745] font-bold text-[10px] bg-[#D97745]/10 px-1.5 py-0.5 rounded border border-[#D97745]/20 font-mono">
              228 KM UPSTREAM
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-0.5">
            <span className="text-[#647786] font-medium">
              {isYamuna ? 'Hathnikund Outflow:' : 'Rainfall:'}
            </span>
            <span className="font-bold font-mono text-[#19364A] text-sm">
              {data.upstreamRelease != null
                ? `${data.upstreamRelease.toLocaleString()} cfs`
                : data.rainfall != null
                ? `${data.rainfall.toFixed(1)} mm`
                : '—'}
            </span>
          </div>
          {isYamuna && data.upstreamRelease != null && (
            <div className="text-[10.5px] font-semibold text-[#647786] pt-1 border-t border-[#DCE4E9]/60">
              {data.upstreamRelease >= 300000 ? (
                <span className="text-[#C94C55]">⚠ Critical Discharge Peak (&gt;300k cfs)</span>
              ) : data.upstreamRelease >= 100000 ? (
                <span className="text-[#D97745]">⚡ High Barrage Gate Release</span>
              ) : (
                <span className="text-slate-600">Standard Hydraulic Outflow</span>
              )}
            </div>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 font-sans text-[#19364A]">
      {/* Prominent Centered Editorial Page Heading matching Station Hydrograph Telemetry */}
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <h1 className="font-black italic uppercase tracking-tighter text-4xl sm:text-5xl lg:text-6xl text-black leading-none select-none sm:whitespace-nowrap">
          HISTORICAL EXTREME FLOOD REPLAY.
        </h1>

        {/* Blue Wave Accent Line matching Reference */}
        <div className="py-2.5">
          <svg
            className="w-24 h-4 text-[#2563EB]"
            viewBox="0 0 96 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 8C8 2 16 2 22 8C28 14 36 14 42 8C48 2 56 2 62 8C68 14 76 14 82 8C88 2 94 2 94 8"
              stroke="#2563EB"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <p className="text-sm font-medium text-black/75 max-w-2xl mx-auto leading-relaxed">
          Step-by-step chronological replay of verified historical flood events with separate stage, release, and risk classification
        </p>
      </div>

      {/* 1. Top Event Selector & Sub-Header Card */}
      <div className="bg-white border border-[#DCE4E9] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB] shadow-xs">
            <History className="w-5 h-5 text-[#2563EB]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-0.5 rounded-lg border border-[#2563EB]/25 uppercase">
                ISOLATED REPLAY ENGINE
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                SYNCHRONIZED BENCHMARK
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-[#19364A] tracking-tight mt-1 select-none">
              {eventData ? eventData.title : 'Historical Flood Event'}
            </h2>
          </div>
        </div>

        {/* Event Selector Dropdown */}
        <div className="flex items-center gap-2.5">
          <label className="text-xs font-semibold text-[#647786] whitespace-nowrap">Event Target:</label>
          <div className="relative">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-white border border-[#DCE4E9] text-xs font-bold rounded-xl px-3.5 py-2 text-[#19364A] focus:outline-hidden focus:border-[#2563EB] shadow-xs cursor-pointer max-w-xs truncate"
            >
              {catalog.map((cat) => (
                <option key={cat.event_id} value={cat.event_id}>
                  {cat.country === 'India' ? '🇮🇳' : '🇺🇸'} {cat.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="p-16 text-center bg-white border border-[#DCE4E9] rounded-2xl text-xs text-[#647786] font-mono shadow-xs">
          <Activity className="w-6 h-6 text-[#28A6A1] animate-spin mx-auto mb-2" />
          Loading historical telemetry, CWC/USGS bulletins, and synchronized replay frames...
        </div>
      )}

      {loadError && (
        <div className="p-5 bg-rose-50 border border-[#C94C55]/30 rounded-2xl text-xs text-[#C94C55] flex items-center gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 shrink-0 text-[#C94C55]" />
          <span className="font-medium">{loadError}</span>
        </div>
      )}

      {!loading && currentFrame && (
        <>
          {/* 2. Partial Record Specification Banner for India */}
          {isYamuna && (
            <div className="p-4 bg-white border-2 border-amber-300 rounded-2xl text-xs text-[#19364A] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-[#19364A]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97745] animate-pulse" />
                  <span className="tracking-wide">PARTIAL RECORD SPECIFICATION — STAGE-ONLY GAUGE REACH</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                    CWC YMN-DEL-ORB-01
                  </span>
                </div>
                <p className="text-[11.5px] text-[#647786] leading-relaxed">
                  Old Railway Bridge (ORB) Delhi is a <b>stage-only monitoring gauge</b> without continuous in-situ velocity/discharge streamflow metering. Upstream discharge is measured <b>228 km upstream at Hathnikund Barrage, Haryana</b>. VEGA-MITI visualizes river stage and upstream barrage release separately and does not assert instantaneous causal confluence.
                </p>
              </div>

              <button
                onClick={() => setShowProvenanceModal(true)}
                className="self-start md:self-auto shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#F5F7F8] hover:bg-[#EAF0F3] text-xs font-bold text-[#19364A] border border-[#DCE4E9] transition cursor-pointer shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-[#28A6A1]" />
                <span>Data Provenance Log</span>
              </button>
            </div>
          )}

          {/* 3. Risk Basis Discrepancy Alert Banner */}
          {hasDiscrepancy && (
            <div className="p-4 bg-rose-50/70 border-2 border-[#C94C55]/40 rounded-2xl shadow-xs text-xs text-[#19364A] flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#C94C55] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[#C94C55] uppercase tracking-wider text-[11px]">
                    Risk Basis Discrepancy Detected (MISMATCH)
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 text-[#C94C55] border border-[#C94C55]/20">
                    STAGE vs PREDICTED FLOW
                  </span>
                </div>
                <p className="text-xs text-[#19364A] leading-relaxed">
                  {riskAssessment?.discrepancy_explanation ||
                    `Observed flood level (${currentFrame.observed_historical_state.water_level_m} m MSL) reached CRITICAL severity breaching official statutory marks, while model precipitation-based estimation remained lower due to localized rainfall abatement. Flood surge arrived via upstream hydraulic wave propagation from Hathnikund Barrage releases.`}
                </p>
              </div>
            </div>
          )}

          {/* 4. Transport Player & Timeline Dock */}
          <div className="bg-white border border-[#DCE4E9] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#28A6A1]/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-[#28A6A1]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#19364A]">Replay Timeline Control</span>
                    <span className="text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded bg-[#F5F7F8] border border-[#DCE4E9] text-[#647786]">
                      Step {currentStepIdx + 1} of {eventData?.total_steps}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-[#28A6A1]">
                    {currentFrame.date} &bull; {currentFrame.timeline_phase}
                  </span>
                </div>
              </div>

              {/* Transport Buttons */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={resetPlayback}
                  className="p-2 rounded-xl bg-[#F5F7F8] hover:bg-[#EAF0F3] text-[#19364A] transition border border-[#DCE4E9] cursor-pointer shadow-2xs"
                  title="Reset to Beginning"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={stepBackward}
                  disabled={currentStepIdx === 0}
                  className="p-2 rounded-xl bg-[#F5F7F8] hover:bg-[#EAF0F3] disabled:opacity-40 text-[#19364A] transition border border-[#DCE4E9] cursor-pointer shadow-2xs"
                  title="Step Backward"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={togglePlay}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer ${
                    isPlaying
                      ? 'bg-[#D97745] hover:bg-[#c26535] text-white'
                      : 'bg-[#28A6A1] hover:bg-[#208b87] text-white'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play Replay</span>
                    </>
                  )}
                </button>
                <button
                  onClick={stepForward}
                  disabled={eventData ? currentStepIdx >= eventData.timeline_frames.length - 1 : true}
                  className="p-2 rounded-xl bg-[#F5F7F8] hover:bg-[#EAF0F3] disabled:opacity-40 text-[#19364A] transition border border-[#DCE4E9] cursor-pointer shadow-2xs"
                  title="Step Forward"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>

                {/* Speed toggle */}
                <select
                  value={playbackSpeedMs}
                  onChange={(e) => setPlaybackSpeedMs(Number(e.target.value))}
                  className="bg-[#F5F7F8] border border-[#DCE4E9] text-[#19364A] text-[11px] font-mono font-bold rounded-xl px-2.5 py-2 focus:outline-hidden cursor-pointer shadow-2xs"
                >
                  <option value={2400}>0.75x</option>
                  <option value={1800}>1.0x</option>
                  <option value={1000}>1.5x</option>
                  <option value={600}>2.5x</option>
                </select>
              </div>
            </div>

            {/* Scrubber Slider */}
            <div className="space-y-2 pt-2">
              <input
                type="range"
                min={0}
                max={eventData ? eventData.timeline_frames.length - 1 : 0}
                value={currentStepIdx}
                onChange={(e) => {
                  setIsPlaying(false)
                  setCurrentStepIdx(Number(e.target.value))
                }}
                className="w-full accent-[#28A6A1] h-2 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer"
              />

              {/* Step Date Indicators */}
              <div className="flex justify-between items-center text-[10.5px] font-mono">
                {eventData?.timeline_frames.map((frame, i) => {
                  const isCurrent = i === currentStepIdx
                  return (
                    <button
                      key={frame.date}
                      onClick={() => {
                        setIsPlaying(false)
                        setCurrentStepIdx(i)
                      }}
                      className={`cursor-pointer px-1.5 py-0.5 rounded transition ${
                        isCurrent
                          ? 'font-bold text-white bg-[#19364A] shadow-xs'
                          : 'text-[#647786] hover:text-[#19364A] hover:bg-[#F5F7F8]'
                      }`}
                    >
                      {frame.date.slice(5)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 5. Hydrological Telemetry Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Primary Gauge Metric */}
            <div className="bg-white border border-[#DCE4E9] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[#647786] mb-1">
                  <span className="text-[11px] font-bold font-mono uppercase tracking-wider">
                    {isYamuna ? 'Delhi Gauge Stage' : 'USGS NWIS Discharge'}
                  </span>
                  <Gauge className="w-4 h-4 text-[#28A6A1]" />
                </div>
                <div className="text-2xl font-black font-mono text-[#19364A] mt-1">
                  {isYamuna ? (
                    <StatsCounter
                      value={currentFrame.observed_historical_state.water_level_m}
                      decimals={2}
                      suffix=" m MSL"
                    />
                  ) : (
                    <StatsCounter
                      value={currentFrame.observed_historical_state.discharge_cfs}
                      decimals={0}
                      suffix=" cfs"
                    />
                  )}
                </div>
              </div>
              <div className="text-[11px] text-[#647786] mt-3 pt-2 border-t border-[#DCE4E9]/60 flex items-center justify-between">
                <span>
                  {isYamuna
                    ? currentFrame.observed_historical_state.water_level_m &&
                      currentFrame.observed_historical_state.water_level_m >= 205.33
                      ? 'Breached CWC Danger Level'
                      : 'Below CWC Danger Level'
                    : 'Verified Daily Streamflow'}
                </span>
                <span className="font-mono text-[10px] font-bold text-[#28A6A1] bg-[#28A6A1]/10 px-1.5 py-0.5 rounded border border-[#28A6A1]/20">
                  OBSERVED
                </span>
              </div>
            </div>

            {/* Card 2: Upstream Barrage Release or Rainfall */}
            <div className="bg-white border border-[#DCE4E9] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[#647786] mb-1">
                  <span className="text-[11px] font-bold font-mono uppercase tracking-wider">
                    {isYamuna ? 'Hathnikund Outflow (228km)' : '24h Basin Precipitation'}
                  </span>
                  <Droplet className="w-4 h-4 text-[#D97745]" />
                </div>
                <div className="text-2xl font-black font-mono text-[#19364A] mt-1">
                  {isYamuna ? (
                    <StatsCounter
                      value={currentFrame.observed_historical_state.upstream_release_cfs}
                      decimals={0}
                      suffix=" cfs"
                    />
                  ) : (
                    <StatsCounter
                      value={currentFrame.observed_historical_state.rainfall_mm}
                      decimals={1}
                      suffix=" mm"
                    />
                  )}
                </div>
              </div>
              <div className="text-[11px] text-[#647786] mt-3 pt-2 border-t border-[#DCE4E9]/60 flex items-center justify-between">
                <span>
                  {isYamuna
                    ? `Transit: ~48–72h (${currentFrame.observed_historical_state.upstream_release_cumec?.toFixed(0)} cumec)`
                    : 'NASA POWER Daily Rainfall'}
                </span>
                <span className="font-mono text-[10px] font-bold text-[#D97745] bg-[#D97745]/10 px-1.5 py-0.5 rounded border border-[#D97745]/20">
                  {isYamuna ? 'BARRAGE LOG' : 'METEO'}
                </span>
              </div>
            </div>

            {/* Card 3: In-Situ Streamflow Discharge Status */}
            <div className="bg-white border border-[#DCE4E9] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[#647786] mb-1">
                  <span className="text-[11px] font-bold font-mono uppercase tracking-wider">
                    In-Situ Continuous Discharge
                  </span>
                  <Activity className="w-4 h-4 text-[#28A6A1]" />
                </div>
                <div className="text-xl font-black font-mono text-[#19364A] mt-1">
                  {isYamuna ? (
                    <span className="text-xs font-mono font-bold text-[#647786] bg-[#F5F7F8] px-2.5 py-1 rounded-lg border border-[#DCE4E9] inline-block">
                      UNMETERED IN-SITU
                    </span>
                  ) : (
                    <StatsCounter
                      value={currentFrame.observed_historical_state.discharge_cfs}
                      decimals={0}
                      suffix=" cfs"
                    />
                  )}
                </div>
              </div>
              <div className="text-[11px] text-[#647786] mt-3 pt-2 border-t border-[#DCE4E9]/60">
                {isYamuna
                  ? 'Stage-only monitoring reach at ORB Delhi'
                  : 'Gauging datum verified'}
              </div>
            </div>

            {/* Card 4: Risk Classification Tier */}
            <div className="bg-white border border-[#DCE4E9] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[#647786] mb-1">
                  <span className="text-[11px] font-bold font-mono uppercase tracking-wider">
                    Evaluated Risk State
                  </span>
                  <Flame className="w-4 h-4 text-[#C94C55]" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${riskBadgeStyle(
                      currentFrame.vega_miti_risk_assessment.risk_level
                    )}`}
                  >
                    {currentFrame.vega_miti_risk_assessment.risk_level}
                  </span>
                  <span className="text-xs font-semibold text-[#647786]">
                    {currentFrame.timeline_phase}
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-[#647786] mt-3 pt-2 border-t border-[#DCE4E9]/60 truncate">
                {currentFrame.vega_miti_risk_assessment.recommended_action || 'Monitoring telemetry'}
              </div>
            </div>
          </div>

          {/* 6. Key Observation Ribbon */}
          <div className="p-3.5 rounded-xl bg-white border border-[#DCE4E9] text-xs text-[#19364A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#28A6A1] shrink-0" />
              <span className="font-bold">Historical Key Observation:</span>
              <span className="text-[#647786]">{currentFrame.observed_historical_state.key_observation}</span>
            </div>
            <div className="text-[11px] font-mono text-[#647786] shrink-0">
              Recorded at {currentFrame.observed_historical_state.observation_timestamp.slice(11, 16)} IST
            </div>
          </div>

          {/* 7. Animated Visual Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Yamuna River Stage (Delhi ORB) */}
            <div className="bg-white border border-[#DCE4E9] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DCE4E9]">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#19364A] flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{isYamuna ? 'Yamuna River Stage (Delhi ORB)' : 'USGS NWIS Streamflow Discharge'}</span>
                  </h3>
                  <span className="text-[11px] text-[#647786]">
                    {isYamuna ? 'Unit: metres above MSL' : 'Unit: cubic feet per second (cfs)'}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-[#F5F7F8] px-2 py-0.5 rounded border border-[#DCE4E9] text-[#19364A]">
                  {isYamuna ? 'CWC STATUTORY MARKS' : 'NWIS VERIFIED'}
                </span>
              </div>

              <div className="h-68 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="stageGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#8C9BA5"
                      fontSize={10.5}
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                    />
                    <YAxis
                      stroke="#8C9BA5"
                      fontSize={10.5}
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      domain={isYamuna ? [202.5, 210] : ['dataMin - 10000', 'dataMax + 20000']}
                    />
                    <Tooltip content={<StageTooltip />} />
                    {isYamuna && (
                      <>
                        <ReferenceLine
                          y={204.5}
                          stroke="#D97745"
                          strokeDasharray="4 4"
                          strokeWidth={1.2}
                          label={{ value: 'Warning 204.50m', fill: '#D97745', fontSize: 9.5, position: 'insideTopLeft' }}
                        />
                        <ReferenceLine
                          y={205.33}
                          stroke="#C94C55"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{ value: 'Danger 205.33m', fill: '#C94C55', fontSize: 9.5, position: 'insideTopLeft' }}
                        />
                        <ReferenceLine
                          y={207.49}
                          stroke="#8B5CF6"
                          strokeDasharray="3 3"
                          strokeWidth={1.2}
                          label={{ value: '1978 Record 207.49m', fill: '#8B5CF6', fontSize: 9.5, position: 'insideTopLeft' }}
                        />
                        <ReferenceLine
                          y={208.66}
                          stroke="#BE123C"
                          strokeWidth={1.8}
                          label={{ value: '2023 Crest 208.66m', fill: '#BE123C', fontSize: 9.5, position: 'insideTopLeft' }}
                        />
                      </>
                    )}
                    <Area
                      type="monotone"
                      dataKey={isYamuna ? 'waterLevel' : 'discharge'}
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      fill="url(#stageGradient)"
                      dot={renderActiveStageDot}
                      isAnimationActive={true}
                      animationDuration={900}
                      name={isYamuna ? 'Stage (m MSL)' : 'Discharge (cfs)'}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-2 border-t border-[#DCE4E9] text-[11px] text-[#647786] flex items-center justify-between">
                <span>Active Replay Point: <b className="text-[#19364A] font-mono">{currentFrame.date}</b></span>
                <span>Values logged from published government bulletins</span>
              </div>
            </div>

            {/* Chart 2: Upstream Release (Hathnikund Barrage) */}
            <div className="bg-white border border-[#DCE4E9] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DCE4E9]">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#19364A] flex items-center gap-1.5">
                    <Droplet className="w-3.5 h-3.5 text-[#D97745]" />
                    <span>{isYamuna ? 'Upstream Release — Hathnikund Barrage (Haryana)' : 'Basin Meteorology & Temperature'}</span>
                  </h3>
                  <span className="text-[11px] text-[#647786]">
                    {isYamuna ? 'Unit: cubic feet per second (cfs) — 228 km Upstream' : 'Unit: Rainfall (mm)'}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-[#F5F7F8] px-2 py-0.5 rounded border border-[#DCE4E9] text-[#19364A]">
                  {isYamuna ? 'SEPARATE SERIES' : 'METEO TELEMETRY'}
                </span>
              </div>

              <div className="h-68 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -5, bottom: 4 }}>
                    <defs>
                      <linearGradient id="releaseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D97745" stopOpacity={0.32} />
                        <stop offset="95%" stopColor="#D97745" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#8C9BA5"
                      fontSize={10.5}
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                    />
                    <YAxis
                      stroke="#8C9BA5"
                      fontSize={10.5}
                      tickLine={false}
                      axisLine={{ stroke: '#E2E8F0' }}
                      domain={isYamuna ? [0, 400000] : [0, 'dataMax + 10']}
                    />
                    <Tooltip content={<ReleaseTooltip />} />
                    {isYamuna && (
                      <ReferenceLine
                        y={300000}
                        stroke="#C94C55"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{ value: 'Critical Release >300,000 cfs', fill: '#C94C55', fontSize: 9.5, position: 'insideTopRight' }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey={isYamuna ? 'upstreamRelease' : 'rainfall'}
                      stroke="#D97745"
                      strokeWidth={2.5}
                      fill="url(#releaseGradient)"
                      dot={renderActiveReleaseDot}
                      isAnimationActive={true}
                      animationDuration={900}
                      name={isYamuna ? 'Hathnikund Release (cfs)' : 'Rainfall (mm)'}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-2 border-t border-[#DCE4E9] text-[11px] text-[#647786] flex items-center justify-between">
                <span>
                  {isYamuna
                    ? 'Logged by Department of Irrigation & Water Resources, Haryana'
                    : 'NASA POWER Daily Meteorological Records'}
                </span>
                <span>Peak Barrage Outflow: <b className="text-[#19364A] font-mono">359,000 cfs</b></span>
              </div>
            </div>
          </div>

          {/* 8. Synchronized Swarm Coordination Status */}
          {currentFrame.simulated_swarm_coordination && (
            <div className="bg-white border border-[#DCE4E9] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DCE4E9]">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#28A6A1]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#19364A]">
                    Synchronized Multi-Agent Swarm Status (Simulated Step Frame)
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#647786]">Activation State:</span>
                  <span className="px-2 py-0.5 rounded font-bold bg-[#19364A] text-white">
                    {currentFrame.simulated_swarm_coordination.swarm_activation_state}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="p-3.5 bg-[#F5F7F8] rounded-xl border border-[#DCE4E9] text-xs">
                  <span className="text-[#647786] block mb-1">Coordinator Heartbeat</span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-mono font-bold text-[#19364A]">
                      {currentFrame.simulated_swarm_coordination.coordinator_status}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-[#F5F7F8] rounded-xl border border-[#DCE4E9] text-xs">
                  <span className="text-[#647786] block mb-1">Active Deployed Missions</span>
                  <span className="font-mono font-bold text-lg text-[#19364A]">
                    <StatsCounter value={currentFrame.simulated_swarm_coordination.active_missions_count} decimals={0} /> Missions
                  </span>
                </div>

                <div className="p-3.5 bg-[#F5F7F8] rounded-xl border border-[#DCE4E9] text-xs">
                  <span className="text-[#647786] block mb-1">Allocated Agents</span>
                  <span className="font-mono font-bold text-[#28A6A1]">
                    <StatsCounter value={currentFrame.simulated_swarm_coordination.active_agent_allocations.length} decimals={0} /> Active Recon Links
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-[#647786] italic pt-1">
                Note: Agent movement and allocation are executed on the simulated 20×20 discrete Cartesian grid, triggered autonomously by risk escalation at each chronological step.
              </p>
            </div>
          )}
        </>
      )}

      {/* 9. Provenance & Methodology Modal */}
      {showProvenanceModal && currentEventMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#DCE4E9] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE4E9]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#28A6A1]" />
                <h3 className="text-base font-bold text-[#19364A]">
                  Hydrological Data Provenance & Source Registry
                </h3>
              </div>
              <button
                onClick={() => setShowProvenanceModal(false)}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#F5F7F8] hover:bg-[#EAF0F3] border border-[#DCE4E9] cursor-pointer text-[#19364A] transition"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#19364A]">
              <div className="p-3.5 bg-[#F5F7F8] rounded-xl border border-[#DCE4E9]">
                <h4 className="font-bold text-[#28A6A1] mb-1">1. River Water Level & Statutory Stages</h4>
                <p className="text-[#647786] leading-relaxed">
                  <b>Issuing Authority:</b> Central Water Commission (CWC), Ministry of Jal Shakti, Government of India.<br />
                  <b>Publication:</b> Daily River Stage Bulletin for Old Railway Bridge Delhi (Station Code: 004-MDELHI).<br />
                  <b>Statutory Reference:</b> Warning Level = 204.50 m MSL, Danger Level = 205.33 m MSL.
                </p>
              </div>

              <div className="p-3.5 bg-[#F5F7F8] rounded-xl border border-[#DCE4E9]">
                <h4 className="font-bold text-[#D97745] mb-1">2. Upstream Barrage Outflow Register</h4>
                <p className="text-[#647786] leading-relaxed">
                  <b>Issuing Authority:</b> Department of Irrigation and Water Resources, Government of Haryana.<br />
                  <b>Record:</b> Hathnikund Barrage Daily Inflow & Outflow Register (Yamunanagar Flood Control Room).<br />
                  <b>Hydraulic Transit:</b> 228 km upstream; approximate 48–72h transit window depending on baseflow.
                </p>
              </div>

              <div className="p-3.5 bg-[#F5F7F8] rounded-xl border border-[#DCE4E9]">
                <h4 className="font-bold text-[#19364A] mb-1">3. In-Situ Streamflow Velocity Status</h4>
                <p className="text-[#647786] leading-relaxed">
                  <b>Status:</b> <code className="bg-white px-1.5 py-0.5 rounded border border-[#DCE4E9]">UNMETERED_IN_SITU</code>. Continuous streamflow velocity is not metered at Old Railway Bridge Delhi. VEGA-MITI strictly refuses to manufacture synthetic hourly discharge values for unmetered stations.
                </p>
              </div>

              <div className="p-3.5 bg-[#F5F7F8] rounded-xl border border-[#DCE4E9]">
                <h4 className="font-bold text-[#19364A] mb-1">4. Statutory Disclaimer</h4>
                <p className="text-[#647786] leading-relaxed">
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
