import React, { useState, useEffect } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Radio,
  Send,
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
import { SwarmApi } from '../api/swarmApi'
import StatsCounter from '../components/ui/stats-counter'
import type { FloodRiskAssessment, FloodRiskLevel } from '../types/swarm'
import type { EnrichedStation } from '../types/data'

interface FloodIntelligenceViewProps {
  stations: EnrichedStation[]
  selectedStationId: string
  onSelectStation: (id: string) => void
  onNavigateToSwarm?: () => void
}

export const FloodIntelligenceView: React.FC<FloodIntelligenceViewProps> = ({
  stations,
  selectedStationId,
  onSelectStation,
  onNavigateToSwarm,
}) => {
  const [riskData, setRiskData] = useState<FloodRiskAssessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null)

  const activeStation = stations.find((s) => s.station_id === selectedStationId) || stations[0]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    SwarmApi.getFloodRisk(activeStation.station_id, {
      name: activeStation.station_name,
      river: activeStation.river_name,
      state: activeStation.state,
      lat: activeStation.latitude,
      lng: activeStation.longitude,
    }).then((res) => {
      if (!cancelled && res.status === 'success') {
        setRiskData(res.data)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [activeStation])

  const handleDispatchSwarm = async () => {
    if (!riskData) return
    setDispatchStatus('Dispatching swarm agent...')
    const res = await SwarmApi.dispatchMission({
      title: `Tactical Reconnaissance — ${riskData.stationName}`,
      stationId: riskData.stationId,
      stationName: riskData.stationName,
      type: 'GAUGE_VERIFY',
      priority: riskData.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      details: `Autonomous verification mission dispatched. Current discharge ${riskData.predictedDischarge} cfs exceeds ${riskData.thresholdSource}.`,
    })
    if (res.status === 'success') {
      setDispatchStatus(`Mission ${res.data.id} Dispatched!`)
      setTimeout(() => {
        setDispatchStatus(null)
        if (onNavigateToSwarm) onNavigateToSwarm()
      }, 1200)
    }
  }

  const getRiskBadge = (level: FloodRiskLevel) => {
    switch (level) {
      case 'CRITICAL':
        return {
          bg: 'bg-[#D9531E]/10 border-[#D9531E]/30 text-[#D9531E]',
          label: 'CRITICAL HIGH FLOW',
          icon: <AlertTriangle className="w-4 h-4 text-[#D9531E]" />,
          desc: 'Current discharge significantly exceeds historical 95th percentile. Embankment overtopping risk.',
        }
      case 'WARNING':
        return {
          bg: 'bg-[#D97745]/10 border-[#D97745]/30 text-[#D97745]',
          label: 'ELEVATED FLOOD WARNING',
          icon: <AlertTriangle className="w-4 h-4 text-[#D97745]" />,
          desc: 'Discharge approaching peak threshold. Active monitoring and drone reconnaissance advised.',
        }
      case 'WATCH':
        return {
          bg: 'bg-amber-50 border-amber-300 text-amber-900',
          label: 'HYDROLOGICAL WATCH',
          icon: <Radio className="w-4 h-4 text-amber-600" />,
          desc: 'Moderate rise in basin outflow. Catchment saturation index increasing.',
        }
      default:
        return {
          bg: 'bg-[#2563EB]/10 border-[#2563EB]/25 text-[#2563EB]',
          label: 'NORMAL DISCHARGE',
          icon: <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />,
          desc: 'Discharge within seasonal baseline variance. Sensor telemetry stable.',
        }
    }
  }

  const chartData = [
    { time: 'T-18h', observed: 28400, predicted: 28200 },
    { time: 'T-12h', observed: 31200, predicted: 30900 },
    { time: 'T-6h', observed: 37500, predicted: 36800 },
    { time: 'Now', observed: riskData?.currentDischarge || 47800, predicted: riskData?.predictedDischarge || 51200 },
    { time: 'T+6h', predicted: Math.round((riskData?.predictedDischarge || 51200) * 1.08) },
    { time: 'T+12h', predicted: Math.round((riskData?.predictedDischarge || 51200) * 1.14) },
    { time: 'T+24h', predicted: Math.round((riskData?.predictedDischarge || 51200) * 0.98) },
  ]

  const riskBadge = riskData ? getRiskBadge(riskData.riskLevel) : getRiskBadge('NORMAL')

  return (
    <div className="space-y-8 w-full max-w-7xl mx-auto">
      {/* Prominent Centered Editorial Page Heading matching Reference Image */}
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <h1 className="font-black italic uppercase tracking-tighter text-4xl sm:text-5xl lg:text-6xl text-black leading-none select-none sm:whitespace-nowrap">
          FLOOD INTELLIGENCE DASHBOARD.
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
          Real-time hydrological estimation, documented flood threshold monitoring, and anomaly detection
        </p>
      </div>

      {/* Top Station Selector & Sub-Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-black/10 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20">
            <Gauge className="w-6 h-6 text-[#2563EB]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-0.5 rounded-lg border border-[#2563EB]/25 uppercase">
                INTELLIGENCE ENGINE
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/5 text-black border border-black/10 uppercase">
                PHASE A &middot; P0
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight mt-1 select-none">
              Hydrological Threshold &amp; Anomaly Telemetry
            </h2>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-black/10">
          <label className="text-xs font-mono font-bold uppercase text-black/60">Monitoring Station:</label>
          <select
            value={selectedStationId}
            onChange={(e) => onSelectStation(e.target.value)}
            className="bg-white border border-black/15 text-black text-xs font-bold rounded-xl px-4 py-2.5 focus:outline-hidden focus:border-[#2563EB] shadow-xs cursor-pointer max-w-md truncate"
          >
            {stations.map((s) => (
              <option key={s.station_id} value={s.station_id}>
                {s.station_name} ({s.river_name || s.station_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading || !riskData ? (
        <div className="bg-white p-12 rounded-2xl border border-black/10 text-center text-xs font-mono text-black/60 shadow-xs">
          Loading station telemetry & model inference...
        </div>
      ) : (
        <>
          {riskData.riskBasisDiscrepancy === 'MISMATCH' && (
            <div className="p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-xs text-amber-950 flex items-start gap-3.5 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-black font-mono uppercase tracking-wider text-amber-800 text-xs">
                    Discrepancy Detected (MISMATCH)
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300">
                    RISK ENGINE ALERT
                  </span>
                </div>
                <p className="leading-relaxed">
                  Observed in-situ risk basis evaluates to <b className="text-amber-950">{riskData.observedRiskLevel || 'NORMAL'}</b> ({riskData.currentDischarge.toLocaleString()} cfs), whereas model forecast predicts <b className="text-amber-950">{riskData.predictedRiskLevel || 'NORMAL'}</b> ({riskData.predictedDischarge.toLocaleString()} cfs).
                  This discrepancy triggers autonomous verification mission dispatch to inspect river gauge telemetry.
                </p>
              </div>
            </div>
          )}

          {(activeStation.station_id.includes('YMN') ||
            activeStation.station_name.toLowerCase().includes('yamuna') ||
            activeStation.station_id === 'IND-BR-01') && (
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-950 flex items-start gap-3 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] mt-1 shrink-0 animate-pulse" />
              <div className="leading-relaxed">
                <span className="font-black text-sky-900 uppercase tracking-wide mr-1.5">Yamuna Delhi ORB Site:</span>
                Statutory stage metric is metres above Mean Sea Level (m MSL). In-situ Delhi velocity is unmetered. Hathnikund Barrage discharge releases (~359,000 cfs) originate 228 km upstream in Haryana (~48-72h hydraulic transit time) and are not local Delhi discharge.
              </div>
            </div>
          )}

          {/* Three Main Intelligence Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Station Metadata */}
            <div className="bg-white p-6 rounded-2xl border border-black/10 shadow-xs flex flex-col justify-between hover:border-black/25 transition">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-black/10">
                  <span className="text-[11px] font-bold font-mono text-black/60 uppercase tracking-wider">
                    Station Metadata
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-0.5 rounded border border-[#2563EB]/25">
                    {riskData.stationId}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-black mt-3.5 select-none">
                  {riskData.stationName}
                </h3>
                <div className="mt-3 space-y-2 text-xs sm:text-sm text-black/70">
                  <div className="flex justify-between items-center py-1 border-b border-black/5">
                    <span className="text-black/50">River Reach:</span>
                    <span className="font-bold text-black">{riskData.riverName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/5">
                    <span className="text-black/50">State / Territory:</span>
                    <span className="font-bold text-black">{riskData.state}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-black/50">Coordinates:</span>
                    <span className="font-mono font-bold text-black">
                      {riskData.latitude.toFixed(2)}°N, {riskData.longitude.toFixed(2)}°E
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-black/10">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-black/50 font-medium">Data Quality:</span>
                  <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[#2563EB]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {riskData.dataQuality.status} ({100 - riskData.dataQuality.missingPct}% complete)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-black/50 font-mono mt-1.5">
                  <span>Last Sensor Read:</span>
                  <span className="text-black font-semibold">
                    {new Date(riskData.dataQuality.lastSensorRead).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Discharge Status */}
            <div className="bg-white p-6 rounded-2xl border border-black/10 shadow-xs flex flex-col justify-between hover:border-black/25 transition">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-black/10">
                  <span className="text-[11px] font-bold font-mono text-black/60 uppercase tracking-wider">
                    Discharge Status
                  </span>
                  <span className="text-[11px] font-mono font-bold text-black/50">Unit: cfs (ft³/s)</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3.5">
                  <div className="p-4 rounded-xl bg-black/[0.02] border border-black/10">
                    <span className="text-[11px] font-mono font-bold text-black/60 block uppercase">
                      Observed Outflow
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-black font-mono mt-1 block">
                      <StatsCounter value={riskData.currentDischarge} decimals={0} />
                    </span>
                    <span className="text-[10.5px] text-black/50 font-medium block mt-1">Hydrometric Gauge</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#2563EB]/5 border border-[#2563EB]/20">
                    <span className="text-[11px] font-mono font-bold text-[#2563EB] block uppercase">
                      Predicted Peak
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-[#2563EB] font-mono mt-1 block">
                      <StatsCounter value={riskData.predictedDischarge} decimals={0} />
                    </span>
                    <span className="text-[10.5px] text-[#2563EB]/70 font-medium block mt-1">+24h Horizon Forecast</span>
                  </div>
                </div>

                <div className="mt-3.5 p-3 rounded-xl bg-black/[0.02] border border-black/10 text-xs">
                  <div className="flex justify-between items-center text-black/70">
                    <span className="font-medium text-black/50">90% Prediction Range:</span>
                    <span className="font-mono font-bold text-black">
                      <StatsCounter value={riskData.confidenceInterval.lower} decimals={0} /> –{' '}
                      <StatsCounter value={riskData.confidenceInterval.upper} decimals={0} /> cfs
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-black/10">
                <div className="flex items-center justify-between text-xs text-black/60">
                  <span className="font-medium text-black/50">Threshold Reference:</span>
                  <span className="font-extrabold font-mono text-[#D9531E]">
                    <StatsCounter value={riskData.thresholdValue} decimals={0} /> cfs
                  </span>
                </div>
                <div className="text-[11px] text-black/50 flex items-center justify-between mt-1">
                  <span className="truncate max-w-[200px]" title={riskData.thresholdSource}>
                    {riskData.thresholdSource}
                  </span>
                  {riskData.isProvisionalThreshold && (
                    <span className="text-[10px] font-mono font-bold text-[#D97745] bg-[#D97745]/10 px-2 py-0.5 rounded border border-[#D97745]/30">
                      PROVISIONAL
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Flood Risk Classification */}
            <div className="bg-white p-6 rounded-2xl border border-black/10 shadow-xs flex flex-col justify-between hover:border-black/25 transition">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-black/10">
                  <span className="text-[11px] font-bold font-mono text-black/60 uppercase tracking-wider">
                    Flood Risk Classification
                  </span>
                  <span className="text-[11px] font-mono font-bold text-black/50">ISO/CWC Standard</span>
                </div>

                <div className={`mt-3.5 p-4 rounded-xl border flex items-start gap-3.5 ${riskBadge.bg}`}>
                  <div className="mt-0.5">{riskBadge.icon}</div>
                  <div>
                    <h4 className="font-black text-sm tracking-tight">{riskBadge.label}</h4>
                    <p className="text-xs mt-1 leading-relaxed opacity-90">{riskBadge.desc}</p>
                  </div>
                </div>

                <div className="mt-3.5 space-y-2 text-xs text-black/70">
                  <div className="flex justify-between py-1 border-b border-black/5">
                    <span className="text-black/50 font-medium">Validation RMSE:</span>
                    <span className="font-mono font-bold text-black">{riskData.metrics.rmse} cfs</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-black/5">
                    <span className="text-black/50 font-medium">Validation R²:</span>
                    <span className="font-mono font-bold text-black">{riskData.metrics.r2}</span>
                  </div>
                  {riskData.metrics.nse && (
                    <div className="flex justify-between py-1">
                      <span className="text-black/50 font-medium">Nash-Sutcliffe Efficiency (NSE):</span>
                      <span className="font-mono font-bold text-[#2563EB]">{riskData.metrics.nse}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-black/10">
                <button
                  onClick={handleDispatchSwarm}
                  disabled={dispatchStatus !== null}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-2 transition cursor-pointer shadow-xs ${
                    riskData.riskLevel === 'CRITICAL' || riskData.riskLevel === 'WARNING'
                      ? 'bg-[#D9531E] hover:bg-[#b83812] text-white'
                      : 'bg-black hover:bg-black/80 text-white'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{dispatchStatus || 'Dispatch Verification Drone'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Large Hydrograph Hydrodynamics Chart */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-black/10 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/10">
              <div>
                <span className="text-[11px] font-bold font-mono text-black/50 uppercase tracking-wider">
                  Hydrograph Hydrodynamics
                </span>
                <h4 className="text-xl sm:text-2xl font-black text-black tracking-tight mt-0.5 select-none">
                  Temporal Outflow: Observed vs Model Inference
                </h4>
              </div>
              <div className="flex items-center gap-5 text-xs">
                <span className="flex items-center gap-1.5 font-bold text-[#0F172A]">
                  <span className="w-3.5 h-1 bg-[#0F172A] rounded-full inline-block"></span> Observed (In-situ)
                </span>
                <span className="flex items-center gap-1.5 font-bold text-[#2563EB]">
                  <span className="w-3.5 h-0.5 bg-[#2563EB] inline-block border-b-2 border-dashed border-[#2563EB]"></span> Model Horizon
                </span>
                <span className="flex items-center gap-1.5 font-bold text-[#D9531E]">
                  <span className="w-3.5 h-0.5 bg-[#D9531E] inline-block border-b-2 border-dashed border-[#D9531E]"></span> Critical Threshold
                </span>
              </div>
            </div>

            <div className="h-72 sm:h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="obsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F172A" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#0F172A" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="#64748B"
                    tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'monospace' }}
                    tickLine={{ stroke: '#E2E8F0' }}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#64748B"
                    tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'monospace' }}
                    tickLine={{ stroke: '#E2E8F0' }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    unit=" cfs"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderColor: 'rgba(0, 0, 0, 0.1)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <ReferenceLine
                    y={riskData.thresholdValue}
                    stroke="#D9531E"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{
                      value: `CRITICAL THRESHOLD (${riskData.thresholdValue} cfs)`,
                      fill: '#D9531E',
                      fontSize: 10.5,
                      fontWeight: 800,
                      position: 'insideTopRight',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="observed"
                    stroke="#0F172A"
                    strokeWidth={3}
                    fill="url(#obsGrad)"
                    isAnimationActive={true}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                  <Area
                    type="monotone"
                    dataKey="predicted"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    fill="url(#predGrad)"
                    isAnimationActive={true}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default FloodIntelligenceView
