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
  isDemo?: boolean
}

export const Hydrograph: React.FC<HydrographProps> = ({
  stationName,
  stationId,
  validationRows,
  predictionRows,
  extremeThreshold,
  isDemo = true,
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
      type: 'prediction',
      actual: null as number | null,
      predicted: null as number | null,
      futurePrediction: r.discharge_cfs,
    })),
  ]

  return (
    <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DDD1BF] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#2F7F8F] uppercase">{stationId}</span>
            {isDemo && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#B8893B]/15 text-[#B8893B] border border-[#B8893B]/30">
                DEMO DATA
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-[#1F2A33] tracking-tight mt-0.5">{stationName}</h2>
        </div>
        {extremeThreshold && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#D8432B]/10 border border-[#D8432B]/30 text-[#D8432B] text-xs font-mono font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#D8432B]" />
            <span>Extreme Flow Cutoff (P90): <b>{extremeThreshold.toFixed(1)} cfs</b></span>
          </div>
        )}
      </div>

      <div className="h-[420px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 25 }}>
            <defs>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1F2A33" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1F2A33" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#EAE1D2" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#526573"
              tick={{ fill: '#526573', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}
              tickLine={{ stroke: '#DDD1BF' }}
            />
            <YAxis
              stroke="#526573"
              tick={{ fill: '#526573', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}
              tickLine={{ stroke: '#DDD1BF' }}
              unit=" cfs"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FAF6EE',
                borderColor: '#DDD1BF',
                borderRadius: '8px',
                color: '#1F2A33',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ fontSize: '12px', color: '#1F2A33' }}
            />

            {extremeThreshold && (
              <ReferenceLine
                y={extremeThreshold}
                stroke="#D8432B"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{
                  value: `Extreme Cutoff (${extremeThreshold} cfs)`,
                  fill: '#D8432B',
                  position: 'top',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            )}

            {/* Historical (observed) = solid ink */}
            <Area
              type="monotone"
              dataKey="actual"
              name="Historical (observed)"
              stroke="#1F2A33"
              strokeWidth={2.5}
              fill="url(#actualGrad)"
              connectNulls={false}
            />

            {/* Backtest (validation prediction) = dashed teal */}
            <Line
              type="monotone"
              dataKey="predicted"
              name="Backtest (validation prediction)"
              stroke="#2F7F8F"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
            />

            {/* Test-period prediction = ochre with markers */}
            <Line
              type="monotone"
              dataKey="futurePrediction"
              name="Test-period prediction"
              stroke="#B8893B"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#B8893B', stroke: '#FAF6EE', strokeWidth: 1.5 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-[#526573] text-center flex flex-wrap items-center justify-center gap-6 pt-1 border-t border-[#DDD1BF]/60">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-3.5 h-0.5 bg-[#1F2A33] inline-block" /> Historical (observed) &mdash; Solid Ink
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-3.5 h-0.5 bg-[#2F7F8F] inline-block border-b border-dashed" /> Backtest (validation prediction) &mdash; Dashed Teal
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-3.5 h-0.5 bg-[#B8893B] inline-block" /> Test-period prediction &mdash; Ochre with markers
        </span>
        {extremeThreshold && (
          <span className="text-[#D8432B] font-semibold flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 bg-[#D8432B] inline-block border-b border-dotted" /> Extreme vermilion cutoff
          </span>
        )}
      </div>
    </div>
  )
}
