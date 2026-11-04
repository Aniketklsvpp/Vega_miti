import React, { useMemo } from 'react'
import type { EnrichedStation, ModelResults } from '../types/data'
import { MetricCards } from '../components/trust/MetricCards'
import { PerStationTable } from '../components/trust/PerStationTable'
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, ShieldCheck } from 'lucide-react'

interface ModelTrustViewProps {
  results: ModelResults
  stations: EnrichedStation[]
  onSelectStation: (id: string) => void
}

export const ModelTrustView: React.FC<ModelTrustViewProps> = ({ results, stations, onSelectStation }) => {
  const weakestStation = useMemo(() => {
    if (!results.per_station || results.per_station.length === 0) return null
    return [...results.per_station].sort((a, b) => a.r2 - b.r2)[0]
  }, [results.per_station])

  const weakestStationMeta = useMemo(() => {
    if (!weakestStation) return null
    return stations.find((s) => s.station_id === weakestStation.station_id)
  }, [weakestStation, stations])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-[#FAF6EE] border border-[#DDD1BF] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#EAE1D2] text-[#2F7F8F]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1F2A33] tracking-tight">Model Trust & Generalization Audit</h2>
            <p className="text-xs text-[#526573]">
              Model: <span className="text-[#1F2A33] font-bold">{results.model_name}</span> &middot; Strategy:{' '}
              <span className="text-[#526573]">{results.validation_strategy}</span>
            </p>
          </div>
        </div>
        <div className="text-right text-[11px] font-mono text-[#526573]">
          Generated: {new Date(results.generated_at).toLocaleString()}
        </div>
      </div>

      <MetricCards results={results} />

      {weakestStation && (
        <div className="p-5 rounded-xl bg-[#FAF6EE] border border-[#B8893B]/40 text-[#1F2A33] space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#B8893B] text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-[#B8893B]" />
              <span>Identified Prediction Weakness & Residual Diagnosis</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EAE1D2] text-[#B8893B] border border-[#B8893B]/30 font-bold">
              HONEST EVALUATION
            </span>
          </div>
          <div className="text-xs text-[#1F2A33] leading-relaxed">
            The model exhibits elevated residual variance at <b className="text-[#B8893B] font-mono">{weakestStation.station_id}</b>
            {weakestStationMeta ? ` (${weakestStationMeta.station_name})` : ''} with R² dropping to <b className="text-[#B8893B] font-mono">{weakestStation.r2.toFixed(3)}</b> and RMSE of <b className="text-[#B8893B] font-mono">{weakestStation.rmse.toFixed(1)} cfs</b>.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3 rounded-lg bg-[#F3EBDD] border border-[#DDD1BF] space-y-1">
              <span className="text-[#526573] uppercase text-[10px] font-semibold">Hydrological Stress Factor:</span>
              <p className="text-[#1F2A33] text-[11px]">
                High-gradient headwater runoff response. Fast-rising hydrograph peaks suffer minor time-lag smoothing compared to downstream trunk streams.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[#F3EBDD] border border-[#DDD1BF] space-y-1">
              <span className="text-[#526573] uppercase text-[10px] font-semibold">Recommended Mitigation:</span>
              <p className="text-[#1F2A33] text-[11px]">
                Incorporate sub-daily precipitation intensity and catchment slope indices in future retraining iterations.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#DDD1BF] text-xs space-y-2 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-[#1F2A33]">
            <CheckCircle2 className="w-4 h-4 text-[#2F7F8F]" />
            <span>Strict Spatial Validation</span>
          </div>
          <p className="text-[#526573] leading-relaxed">
            Evaluated on held-out stations unseen during parameter fitting to measure genuine out-of-sample transferability.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#D8432B]/30 text-xs space-y-2 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-[#D8432B]">
            <AlertTriangle className="w-4 h-4 text-[#D8432B]" />
            <span>Extreme Flow Calibration (30%)</span>
          </div>
          <p className="text-[#526573] leading-relaxed">
            {results.extreme.threshold_definition}. Penalized via 30% official weighting to guard against under-predicting flood crests.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#DDD1BF] text-xs space-y-2 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-[#1F2A33]">
            <Info className="w-4 h-4 text-[#2F7F8F]" />
            <span>Generalization Limits</span>
          </div>
          <p className="text-[#526573] leading-relaxed">
            Physics-guided ML model calibrated strictly against USGS observational datasets; India catchment inference is a conceptual prototype.
          </p>
        </div>
      </div>

      <PerStationTable results={results} stations={stations} onSelectStation={onSelectStation} />
    </div>
  )
}
