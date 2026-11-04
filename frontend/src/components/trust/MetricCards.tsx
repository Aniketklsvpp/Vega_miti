import React from 'react'
import type { ModelResults } from '../../types/data'
import { Award, Flame, Gauge, Target } from 'lucide-react'

export const MetricCards: React.FC<{ results: ModelResults }> = ({ results }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-mono uppercase tracking-wider font-semibold">Overall RMSE</span>
          <Target className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="text-3xl font-extrabold text-slate-100 font-mono">
          {results.overall.rmse.toFixed(2)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">Root Mean Square Error</span>
          <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/50 font-mono font-bold">
            Weight: 40%
          </span>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-rose-900/40 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-mono uppercase tracking-wider font-semibold text-rose-300">Extreme-Event RMSE</span>
          <Flame className="w-4 h-4 text-rose-400" />
        </div>
        <div className="text-3xl font-extrabold text-rose-400 font-mono">
          {results.extreme.rmse.toFixed(2)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">Top 10% events</span>
          <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800/50 font-mono font-bold">
            Weight: 30%
          </span>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-mono uppercase tracking-wider font-semibold">Overall MAE</span>
          <Gauge className="w-4 h-4 text-sky-400" />
        </div>
        <div className="text-3xl font-extrabold text-slate-100 font-mono">
          {results.overall.mae.toFixed(2)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">Mean Absolute Error</span>
          <span className="px-2 py-0.5 rounded bg-sky-950/60 text-sky-400 border border-sky-800/50 font-mono font-bold">
            Weight: 20%
          </span>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-mono uppercase tracking-wider font-semibold">R² Coefficient</span>
          <Award className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="text-3xl font-extrabold text-indigo-300 font-mono">
          {results.overall.r2.toFixed(3)}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">Coefficient of Determination</span>
          <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800/50 font-mono font-bold">
            Weight: 10%
          </span>
        </div>
      </div>
    </div>
  )
}

