import React from 'react'
import type { ModelResults } from '../../types/data'
import { Award, Flame, Gauge, Target } from 'lucide-react'

export const MetricCards: React.FC<{ results: ModelResults }> = ({ results }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white border border-[#DCE4E9] rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-[#647786] mb-2">
          <span className="text-xs font-mono uppercase font-semibold">Overall RMSE</span>
          <Target className="w-4 h-4 text-[#28A6A1]" />
        </div>
        <div className="text-3xl font-extrabold text-[#19364A] font-mono">
          {results.overall.rmse.toFixed(2)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-[#647786]">Root Mean Square Error</span>
          <span className="px-2 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] font-mono font-bold border border-[#DCE4E9]">
            Weight: 40%
          </span>
        </div>
      </div>

      <div className="bg-white border border-[#FECDD3] rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-[#C94C55] mb-2">
          <span className="text-xs font-mono uppercase font-semibold">Extreme-Event RMSE</span>
          <Flame className="w-4 h-4 text-[#C94C55]" />
        </div>
        <div className="text-3xl font-extrabold text-[#C94C55] font-mono">
          {results.extreme.rmse.toFixed(2)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-[#647786]">Top 10% events</span>
          <span className="px-2 py-0.5 rounded bg-[#FFF1F2] text-[#C94C55] font-mono font-bold border border-[#FECDD3]">
            Weight: 30%
          </span>
        </div>
      </div>

      <div className="bg-white border border-[#DCE4E9] rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-[#647786] mb-2">
          <span className="text-xs font-mono uppercase font-semibold">Overall MAE</span>
          <Gauge className="w-4 h-4 text-[#398DB5]" />
        </div>
        <div className="text-3xl font-extrabold text-[#19364A] font-mono">
          {results.overall.mae.toFixed(2)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-[#647786]">Mean Absolute Error</span>
          <span className="px-2 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] font-mono font-bold border border-[#DCE4E9]">
            Weight: 20%
          </span>
        </div>
      </div>

      <div className="bg-white border border-[#DCE4E9] rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-[#647786] mb-2">
          <span className="text-xs font-mono uppercase font-semibold">R² Coefficient</span>
          <Award className="w-4 h-4 text-[#28A6A1]" />
        </div>
        <div className="text-3xl font-extrabold text-[#19364A] font-mono">
          {results.overall.r2.toFixed(3)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-[#647786]">Goodness of Fit</span>
          <span className="px-2 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] font-mono font-bold border border-[#DCE4E9]">
            Weight: 10%
          </span>
        </div>
      </div>
    </div>
  )
}
