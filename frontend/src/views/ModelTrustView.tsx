import React from 'react'
import type { EnrichedStation, ModelResults } from '../types/data'
import { MetricCards } from '../components/trust/MetricCards'
import { PerStationTable } from '../components/trust/PerStationTable'
import { ShieldCheck } from 'lucide-react'

interface ModelTrustViewProps {
  results: ModelResults
  stations: EnrichedStation[]
  onSelectStation: (id: string) => void
}

export const ModelTrustView: React.FC<ModelTrustViewProps> = ({ results, stations, onSelectStation }) => {
  return (
    <div className="space-y-8 w-full max-w-7xl mx-auto">
      {/* Prominent Centered Editorial Page Heading matching River Catchment Map */}
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <h1 className="font-black italic uppercase tracking-tighter text-4xl sm:text-5xl lg:text-6xl text-black leading-none select-none">
          MODEL TRUST &amp; GENERALIZATION AUDIT.
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
          Spatial held-out catchment validation, empirical residual analysis and extreme flood stress test audit
        </p>
      </div>

      {/* Model Metadata Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-black/10 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-0.5 rounded-lg border border-[#2563EB]/25 uppercase">
                MODEL TRUST AUDIT
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/5 text-black border border-black/10 uppercase">
                VERIFIED EVALUATION
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight mt-1 select-none">
              {results.model_name}
            </h2>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-black/60 mt-0.5">
              <span>Strategy: <b className="text-black">{results.validation_strategy}</b></span>
            </div>
          </div>
        </div>

        <div className="text-left sm:text-right text-xs font-mono text-black/60 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/10">
          <span className="block text-[10px] uppercase font-bold tracking-wider text-black/40">Audit Generation Timestamp</span>
          <span className="font-bold text-black">{new Date(results.generated_at).toLocaleString()}</span>
        </div>
      </div>

      {/* Four Evaluation Metric Cards */}
      <MetricCards results={results} />

      {/* Station-Level Generalization Performance Table */}
      <PerStationTable results={results} stations={stations} onSelectStation={onSelectStation} />
    </div>
  )
}

export default ModelTrustView
