import React from 'react'
import type { ModelResults } from '../../types/data'
import { Award, Flame, Gauge, Target } from 'lucide-react'

export const MetricCards: React.FC<{ results: ModelResults }> = ({ results }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* 1. Overall RMSE */}
      <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-black/25 transition">
        <div className="flex items-center justify-between text-black/60 mb-1.5">
          <span className="text-[11px] font-bold font-mono uppercase tracking-wider">Overall RMSE</span>
          <Target className="w-4 h-4 text-[#2563EB]" />
        </div>
        <div className="text-3xl sm:text-4xl font-black font-mono text-black mt-1 tracking-tight">
          {results.overall.rmse.toFixed(2)}
        </div>
        <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between text-xs">
          <span className="text-black/50 font-medium">Root Mean Square Error</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-black/5 text-black font-mono font-bold border border-black/10 text-[10.5px]">
            Weight: 40%
          </span>
        </div>
      </div>

      {/* 2. Extreme-Event RMSE */}
      <div className="bg-white border border-[#D9531E]/30 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-[#D9531E]/60 transition">
        <div className="flex items-center justify-between text-[#D9531E] mb-1.5">
          <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-[#D9531E]">
            Extreme-Event RMSE
          </span>
          <Flame className="w-4 h-4 text-[#D9531E]" />
        </div>
        <div className="text-3xl sm:text-4xl font-black font-mono text-[#D9531E] mt-1 tracking-tight">
          {results.extreme.rmse.toFixed(2)}
        </div>
        <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between text-xs">
          <span className="text-black/50 font-medium">Top 10% events</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-[#D9531E]/10 text-[#D9531E] font-mono font-bold border border-[#D9531E]/25 text-[10.5px]">
            Weight: 30%
          </span>
        </div>
      </div>

      {/* 3. Overall MAE */}
      <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-black/25 transition">
        <div className="flex items-center justify-between text-black/60 mb-1.5">
          <span className="text-[11px] font-bold font-mono uppercase tracking-wider">Overall MAE</span>
          <Gauge className="w-4 h-4 text-[#2563EB]" />
        </div>
        <div className="text-3xl sm:text-4xl font-black font-mono text-black mt-1 tracking-tight">
          {results.overall.mae.toFixed(2)}
        </div>
        <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between text-xs">
          <span className="text-black/50 font-medium">Mean Absolute Error</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-black/5 text-black font-mono font-bold border border-black/10 text-[10.5px]">
            Weight: 20%
          </span>
        </div>
      </div>

      {/* 4. R² Coefficient */}
      <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-black/25 transition">
        <div className="flex items-center justify-between text-black/60 mb-1.5">
          <span className="text-[11px] font-bold font-mono uppercase tracking-wider">R² Coefficient</span>
          <Award className="w-4 h-4 text-[#2563EB]" />
        </div>
        <div className="text-3xl sm:text-4xl font-black font-mono text-black mt-1 tracking-tight">
          {results.overall.r2.toFixed(3)}
        </div>
        <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between text-xs">
          <span className="text-black/50 font-medium">Goodness of Fit</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-black/5 text-black font-mono font-bold border border-black/10 text-[10.5px]">
            Weight: 10%
          </span>
        </div>
      </div>
    </div>
  )
}

export default MetricCards
