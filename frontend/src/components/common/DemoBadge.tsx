import React from 'react'
import { AlertTriangle, Database } from 'lucide-react'
import type { RegionType } from '../../types/data'

interface DemoBadgeProps {
  isDemo: boolean
  isPrototype: boolean
  region: RegionType
}

export const DemoBadge: React.FC<DemoBadgeProps> = ({ isDemo, isPrototype, region }) => {
  return (
    <div className="flex items-center gap-2">
      {isDemo ? (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#F7F0E3] text-[#B8893B] border border-[#B8893B]/30 shadow-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-[#B8893B]" />
          <span>DEMO DATA</span>
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#E8F2F4] text-[#2F7F8F] border border-[#2F7F8F]/30 shadow-xs">
          <Database className="w-3.5 h-3.5 text-[#2F7F8F]" />
          <span>LIVE OUTPUTS</span>
        </div>
      )}

      {isPrototype && (
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#FAF6EE] text-[#B8893B] border border-[#B8893B]/30 font-bold">
          PROTOTYPE
        </span>
      )}

      <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#EAE1D2] text-[#1F2A33] border border-[#DDD1BF]">
        Region: <b className="text-[#2F7F8F] uppercase">{region}</b>
      </span>
    </div>
  )
}
