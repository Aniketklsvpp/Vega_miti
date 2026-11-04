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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {isDemo ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#FFF7ED] text-[#D97745] border border-[#FFEDD5] shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-[#D97745]" />
            <span>DEMO DATA</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#E6F4F1] text-[#28A6A1] border border-[#BCE5DD] shadow-xs">
            <Database className="w-3.5 h-3.5 text-[#28A6A1]" />
            <span>LIVE OUTPUTS</span>
          </div>
        )}

        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] border border-[#DCE4E9]">
          Region: <b className="text-[#28A6A1] uppercase">{region}</b>
        </span>
      </div>

      {isPrototype && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#EAF0F3] border border-[#DCE4E9] text-[#19364A] text-xs">
          <Info className="w-4 h-4 text-[#28A6A1] shrink-0" />
          <span>
            <b>Prototype region:</b> Concept demo, model trained on US data. Demo Stations 1–5 illustrative.
          </span>
        </div>
      )}
    </div>
  )
}
