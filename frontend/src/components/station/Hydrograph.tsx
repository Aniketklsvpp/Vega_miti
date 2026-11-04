import React from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'
import type { PredictionRow, ValidationPredictionRow } from '../../types/data'

interface HydrographProps {
  stationName: string
  stationId: string
  validationRows: ValidationPredictionRow[]
  predictionRows: PredictionRow[]
  extremeThreshold?: number
}

export const Hydrograph: React.FC<HydrographProps> = ({
  stationName,
  stationId,
  validationRows,
  predictionRows,
  extremeThreshold,
}) => {
  const chartData = [
    ...validationRows.map((r) => ({
      date: r.date,
      type: 'validation',
      actual: r.actual,
      predicted: r.predicted,
      futurePrediction: null as number | null,
    })),
    ...predictionRows.map((r) => ({
      date: r.date,
      type: 'forecast',
      actual: null as number | null,
      predicted: null as number | null,
      futurePrediction: r.discharge_cfs,
    })),
  ]

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">{stationId}</span>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">{stationName}</h2>
        </div>
        {extremeThreshold && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Extreme Flow Cutoff: <b>{extremeThreshold.toFixed(1)} cfs</b></span>
          </div>
        )}
      </div>

      <div className="h-[420px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 15, right: 25, left: 0, bottom: 25 }}>
            <defs>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
              tickLine={{ stroke: '#334155' }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
              tickLine={{ stroke: '#334155' }}
              unit=" cfs"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '12px',
                fontFamily: 'ui-monospace, monospace',
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
            />

            {extremeThreshold && (
              <ReferenceLine
                y={extremeThreshold}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{
                  value: `Extreme Cutoff (${extremeThreshold} cfs)`,
                  fill: '#f43f5e',
                  position: 'top',
                  fontSize: 11,
                  fontFamily: 'ui-monospace, monospace',
                }}
              />
            )}

            <Area
              type="monotone"
              dataKey="actual"
              name="Historical Actual (cfs)"
              stroke="#a855f7"
              strokeWidth={2}
              fill="url(#actualGrad)"
              connectNulls={false}
            />

            <Line
              type="monotone"
              dataKey="predicted"
              name="Validation Estimate (cfs)"
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={false}
              connectNulls={false}
            />

            <Area
              type="monotone"
              dataKey="futurePrediction"
              name="Target Forecast (cfs)"
              stroke="#06b6d4"
              strokeWidth={2.5}
              fill="url(#forecastGrad)"
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[11px] text-slate-500 font-mono text-center flex items-center justify-center gap-6">
        <span>🟣 Historical Validation Actuals</span>
        <span>🔵 Model Estimates</span>
        <span className="text-rose-400">🔴 Top 10% Extreme Event Threshold</span>
      </div>
    </div>
  )
}
