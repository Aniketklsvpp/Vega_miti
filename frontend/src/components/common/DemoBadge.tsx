import React from 'react'
import { AlertTriangle, Database, Info } from 'lucide-react'
import type { RegionType } from '../../types/data'

interface DemoBadgeProps {
  isDemo: boolean
  isPrototype: boolean
  region: RegionType
}

export const DemoBadge: React.FC<DemoBadgeProps> = ({ isDemo, isPrototype, region }) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {isDemo ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>DEMO DATA</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>LIVE OUTPUTS</span>
          </div>
        )}

        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          Region: <b className="text-cyan-400 uppercase">{region}</b>
        </span>
      </div>

      {isPrototype && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/70 border border-indigo-500/40 text-indigo-200 text-xs font-mono">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <b>Prototype region:</b> Concept demo, model trained on US data. Demo Stations 1–5 illustrative.
          </span>
        </div>
      )}
    </div>
  )
}
