import React, { useState, useEffect } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Gauge,
  Layers,
  Radio,
  Send,
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
import { SwarmApi } from '../api/swarmApi'
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
          bg: 'bg-[#C94C55]/10 border-[#C94C55]/30 text-[#C94C55]',
          label: 'CRITICAL HIGH FLOW',
          icon: <AlertTriangle className="w-4 h-4 text-[#C94C55]" />,
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
          bg: 'bg-amber-50 border-amber-200 text-amber-700',
          label: 'HYDROLOGICAL WATCH',
          icon: <Radio className="w-4 h-4 text-amber-600" />,
          desc: 'Moderate rise in basin outflow. Catchment saturation index increasing.',
        }
      default:
        return {
          bg: 'bg-[#28A6A1]/10 border-[#28A6A1]/30 text-[#28A6A1]',
          label: 'NORMAL DISCHARGE',
          icon: <CheckCircle2 className="w-4 h-4 text-[#28A6A1]" />,
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#DCE4E9] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#EAF0F3] border border-[#DCE4E9] flex items-center justify-center text-[#19364A]">
            <Gauge className="w-5 h-5 text-[#28A6A1]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#19364A]">Flood Intelligence Dashboard</h2>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] border border-[#DCE4E9]">
                PHASE A &middot; P0
              </span>
            </div>
            <p className="text-xs text-[#647786]">
              Real-time hydrological estimation, documented flood threshold monitoring, and anomaly detection.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-[#647786]">Monitoring Station:</label>
          <select
            value={selectedStationId}
            onChange={(e) => onSelectStation(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#F5F7F8] border border-[#DCE4E9] text-[#19364A] focus:outline-hidden focus:ring-1 focus:ring-[#28A6A1]"
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
        <div className="bg-white p-12 rounded-xl border border-[#DCE4E9] text-center text-xs text-[#647786]">
          Loading station telemetry & model inference...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-[#DCE4E9] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#DCE4E9]">
                  <span className="text-xs font-bold text-[#647786] uppercase tracking-wider">Station Metadata</span>
                  <span className="text-[11px] font-mono text-[#28A6A1] bg-[#28A6A1]/10 px-2 py-0.5 rounded border border-[#28A6A1]/20">
                    {riskData.stationId}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-[#19364A] mt-3">{riskData.stationName}</h3>
                <div className="mt-2 space-y-1.5 text-xs text-[#647786]">
                  <div className="flex justify-between">
                    <span>River Reach:</span>
                    <span className="font-semibold text-[#19364A]">{riskData.riverName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>State / Territory:</span>
                    <span className="font-semibold text-[#19364A]">{riskData.state}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Coordinates:</span>
                    <span className="font-mono text-[#19364A]">
                      {riskData.latitude.toFixed(2)}°N, {riskData.longitude.toFixed(2)}°E
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#DCE4E9]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#647786]">Data Quality:</span>
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-[#28A6A1]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {riskData.dataQuality.status} ({100 - riskData.dataQuality.missingPct}% complete)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#647786] mt-1">
                  <span>Last Sensor Read:</span>
                  <span>{new Date(riskData.dataQuality.lastSensorRead).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#DCE4E9] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#DCE4E9]">
                  <span className="text-xs font-bold text-[#647786] uppercase tracking-wider">Discharge Status</span>
                  <span className="text-[11px] text-[#647786]">Unit: cfs (ft³/s)</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="p-3 rounded-lg bg-[#F5F7F8] border border-[#DCE4E9]">
                    <span className="text-[11px] text-[#647786] block">Observed Outflow</span>
                    <span className="text-2xl font-black text-[#19364A] font-mono">
                      {riskData.currentDischarge.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[#647786] block mt-0.5">Hydrometric Gauge</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#28A6A1]/10 border border-[#28A6A1]/20">
                    <span className="text-[11px] text-[#28A6A1] font-semibold block">Predicted Peak</span>
                    <span className="text-2xl font-black text-[#19364A] font-mono">
                      {riskData.predictedDischarge.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[#28A6A1] block mt-0.5">+24h Horizon Forecast</span>
                  </div>
                </div>

                <div className="mt-3 p-2.5 rounded-lg bg-[#F5F7F8] border border-[#DCE4E9] text-xs">
                  <div className="flex justify-between items-center text-[#647786]">
                    <span>90% Prediction Range:</span>
                    <span className="font-mono font-bold text-[#19364A]">
                      {riskData.confidenceInterval.lower.toLocaleString()} –{' '}
                      {riskData.confidenceInterval.upper.toLocaleString()} cfs
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-[#647786]">
                  <span>Threshold Reference:</span>
                  <span className="font-bold font-mono text-[#C94C55]">
                    {riskData.thresholdValue.toLocaleString()} cfs
                  </span>
                </div>
                <div className="text-[11px] text-[#647786] flex items-center justify-between mt-0.5">
                  <span className="truncate max-w-[200px]" title={riskData.thresholdSource}>
                    {riskData.thresholdSource}
                  </span>
                  {riskData.isProvisionalThreshold && (
                    <span className="text-[10px] font-bold text-[#D97745] bg-[#D97745]/10 px-1.5 py-0.2 rounded border border-[#D97745]/30">
                      PROVISIONAL
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#DCE4E9] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#DCE4E9]">
                  <span className="text-xs font-bold text-[#647786] uppercase tracking-wider">Flood Risk Classification</span>
                  <span className="text-[11px] font-mono text-[#647786]">ISO/CWC Standard</span>
                </div>

                <div className={`mt-3 p-3.5 rounded-xl border flex items-start gap-3 ${riskBadge.bg}`}>
                  <div className="mt-0.5">{riskBadge.icon}</div>
                  <div>
                    <h4 className="font-extrabold text-sm tracking-tight">{riskBadge.label}</h4>
                    <p className="text-xs mt-1 leading-relaxed opacity-90">{riskBadge.desc}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-[#647786]">
                  <div className="flex justify-between">
                    <span>Validation RMSE:</span>
                    <span className="font-mono font-bold text-[#19364A]">{riskData.metrics.rmse} cfs</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Validation R²:</span>
                    <span className="font-mono font-bold text-[#19364A]">{riskData.metrics.r2}</span>
                  </div>
                  {riskData.metrics.nse && (
                    <div className="flex justify-between">
                      <span>Nash-Sutcliffe Efficiency (NSE):</span>
                      <span className="font-mono font-bold text-[#28A6A1]">{riskData.metrics.nse}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#DCE4E9]">
                <button
                  onClick={handleDispatchSwarm}
                  disabled={dispatchStatus !== null}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                    riskData.riskLevel === 'CRITICAL' || riskData.riskLevel === 'WARNING'
                      ? 'bg-[#C94C55] hover:bg-[#a9363f] text-white shadow-xs'
                      : 'bg-[#19364A] hover:bg-[#28A6A1] text-white shadow-xs'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{dispatchStatus || 'Dispatch Swarm Verification Mission'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-[#DCE4E9] shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#DCE4E9]">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#28A6A1]" />
                  <span className="text-xs font-bold text-[#19364A]">Discharge Hydrograph & Horizon Forecast</span>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5 text-[#19364A]">
                    <span className="w-3 h-0.5 bg-[#19364A] inline-block"></span> Observed
                  </span>
                  <span className="flex items-center gap-1.5 text-[#28A6A1]">
                    <span className="w-3 h-0.5 bg-[#28A6A1] inline-block border-b border-dashed"></span> Model Prediction
                  </span>
                  <span className="flex items-center gap-1.5 text-[#C94C55]">
                    <span className="w-3 h-0.5 bg-[#C94C55] inline-block"></span> Provisional P95 Threshold
                  </span>
                </div>
              </div>

              <div className="h-64 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="predArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#28A6A1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#28A6A1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EAF0F3" />
                    <XAxis dataKey="time" stroke="#647786" fontSize={11} />
                    <YAxis stroke="#647786" fontSize={11} domain={['dataMin - 5000', 'dataMax + 8000']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #DCE4E9',
                        borderRadius: '8px',
                        fontSize: '11px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                      }}
                    />
                    <ReferenceLine
                      y={riskData.thresholdValue}
                      stroke="#C94C55"
                      strokeDasharray="4 4"
                      label={{ value: 'Provisional P95 Threshold', fill: '#C94C55', fontSize: 10, position: 'insideTopRight' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="predicted"
                      stroke="#28A6A1"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#predArea)"
                      name="Predicted cfs"
                    />
                    <Area
                      type="monotone"
                      dataKey="observed"
                      stroke="#19364A"
                      strokeWidth={2.5}
                      fillOpacity={0}
                      name="Observed cfs"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-[#647786] pt-2 border-t border-[#DCE4E9]">
                <span>Historical lookback window: 24h &bull; Forecast window: +24h</span>
                <span>Values rendered from hydrological validation runs and live telemetry</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#DCE4E9] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-[#DCE4E9]">
                  <Cpu className="w-4 h-4 text-[#19364A]" />
                  <span className="text-xs font-bold text-[#19364A]">Model & Inference Topology</span>
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-[#647786] block">Model Architecture</span>
                    <p className="text-xs font-bold text-[#19364A] mt-0.5">{riskData.modelConfig.modelType}</p>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-[#647786] block">Temporal Lookback & Horizon</span>
                    <p className="text-xs font-mono font-bold text-[#19364A] mt-0.5">
                      {riskData.modelConfig.featureLookbackDays} Days Past Window &rarr; +{riskData.modelConfig.targetHorizonHours}h Target
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-[#647786] block">Training Baseline</span>
                    <p className="text-xs font-mono text-[#647786] mt-0.5">{riskData.modelConfig.trainingDataRange}</p>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-[#647786] block">Exogenous Weather Telemetry</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] font-medium border border-[#DCE4E9]">
                        ERA5 Precipitation
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] font-medium border border-[#DCE4E9]">
                        Soil Moisture P20
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] font-medium border border-[#DCE4E9]">
                        Upstream Gauge Lag
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-[#EAF0F3]/60 border border-[#DCE4E9] text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[#19364A]">
                  <Layers className="w-3.5 h-3.5 text-[#28A6A1]" />
                  <span>Swarm Autonomous Link</span>
                </div>
                <p className="text-[11px] text-[#647786] mt-1">
                  Elevated risk triggers automated drone sensor deployment to verify embankment integrity.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
