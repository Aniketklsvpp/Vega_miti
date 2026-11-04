import React from 'react'
import type { EnrichedStation, ModelResults } from '../types/data'
import { MetricCards } from '../components/trust/MetricCards'
import { PerStationTable } from '../components/trust/PerStationTable'
import { CheckCircle2, Info, ShieldCheck } from 'lucide-react'

interface ModelTrustViewProps {
  results: ModelResults
  stations: EnrichedStation[]
  onSelectStation: (id: string) => void
}

export const ModelTrustView: React.FC<ModelTrustViewProps> = ({ results, stations, onSelectStation }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 tracking-tight">Scientific Model Integrity & Trust</h2>
            <p className="text-xs text-slate-400 font-mono">
              Model: <span className="text-cyan-400 font-bold">{results.model_name}</span> | Strategy:{' '}
              <span className="text-slate-300">{results.validation_strategy}</span>
            </p>
          </div>
        </div>
        <div className="text-right text-[11px] font-mono text-slate-500">
          Generated: {new Date(results.generated_at).toLocaleString()}
        </div>
      </div>

      <MetricCards results={results} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center gap-2 font-mono font-bold text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Generalization Protocol</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Evaluated on held-out stations unseen during parameter fitting to measure genuine out-of-sample transferability.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-rose-900/30 text-xs space-y-2">
          <div className="flex items-center gap-2 font-mono font-bold text-rose-300">
            <Info className="w-4 h-4 text-rose-400" />
            <span>Extreme Flow Calibration</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            {results.extreme.threshold_definition}. Penalized via 30% metric weighting to guard against under-predicting flood peaks.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center gap-2 font-mono font-bold text-slate-200">
            <Info className="w-4 h-4 text-sky-400" />
            <span>Evaluation Weighting</span>
          </div>
          <p className="text-slate-400 leading-relaxed font-mono">
            Score = (0.40 × RMSE) + (0.30 × Extreme_RMSE) + (0.20 × MAE) + (0.10 × (1 - R²))
          </p>
        </div>
      </div>

      <PerStationTable results={results} stations={stations} onSelectStation={onSelectStation} />
    </div>
  )
}

