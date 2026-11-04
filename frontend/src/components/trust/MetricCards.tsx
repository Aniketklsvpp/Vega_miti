import React from 'react'
import type { ModelResults } from '../../types/data'
import { Award, Flame, Gauge, Target } from 'lucide-react'

export const MetricCards: React.FC<{ results: ModelResults }> = ({ results }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-[#526573] mb-2">
          <span className="text-xs font-mono uppercase font-semibold">Overall RMSE</span>
          <Target className="w-4 h-4 text-[#2F7F8F]" />
        </div>
        <div className="text-3xl font-extrabold text-[#1F2A33] font-mono">
          {results.overall.rmse.toFixed(2)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-[#526573]">Root Mean Square Error</span>
          <span className="px-2 py-0.5 rounded bg-[#EAE1D2] text-[#1F2A33] font-mono font-bold border border-[#DDD1BF]">
            Weight: 40%
          </span>
        </div>
      </div>

      <div className="bg-[#FAF6EE] border border-[#D8432B]/30 rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-[#D8432B] mb-2">
          <span className="text-xs font-mono uppercase font-semibold">Extreme-Event RMSE</span>
          <Flame className="w-4 h-4 text-[#D8432B]" />
        </div>
        <div className="text-3xl font-extrabold text-[#D8432B] font-mono">
          {results.extreme.rmse.toFixed(2)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-[#526573]">Top 10% events</span>
          <span className="px-2 py-0.5 rounded bg-[#FBECE9] text-[#D8432B] font-mono font-bold border border-[#D8432B]/30">
            Weight: 30%
          </span>
        </div>
      </div>

      <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-[#526573] mb-2">
          <span className="text-xs font-mono uppercase font-semibold">Overall MAE</span>
          <Gauge className="w-4 h-4 text-[#2F7F8F]" />
        </div>
        <div className="text-3xl font-extrabold text-[#1F2A33] font-mono">
          {results.overall.mae.toFixed(2)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-[#526573]">Mean Absolute Error</span>
          <span className="px-2 py-0.5 rounded bg-[#EAE1D2] text-[#1F2A33] font-mono font-bold border border-[#DDD1BF]">
            Weight: 20%
          </span>
        </div>
      </div>

      <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-[#526573] mb-2">
          <span className="text-xs font-mono uppercase font-semibold">R² Coefficient</span>
          <Award className="w-4 h-4 text-[#B8893B]" />
        </div>
        <div className="text-3xl font-extrabold text-[#1F2A33] font-mono">
          {results.overall.r2.toFixed(3)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-[#526573]">Goodness of Fit</span>
          <span className="px-2 py-0.5 rounded bg-[#EAE1D2] text-[#1F2A33] font-mono font-bold border border-[#DDD1BF]">
            Weight: 10%
          </span>
        </div>
      </div>
    </div>
  )
}
