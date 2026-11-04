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
    <div className="bg-white border border-[#DCE4E9] rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DCE4E9] pb-4">
        <div>
          <span className="text-xs font-mono font-bold text-[#28A6A1] uppercase">{stationId}</span>
          <h2 className="text-xl font-bold text-[#19364A] tracking-tight">{stationName}</h2>
        </div>
        {extremeThreshold && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FFF1F2] border border-[#FECDD3] text-[#C94C55] text-xs font-mono font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#C94C55]" />
            <span>Extreme Flow Cutoff: <b>{extremeThreshold.toFixed(1)} cfs</b></span>
          </div>
        )}
      </div>

      <div className="h-[420px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 25 }}>
            <defs>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#19364A" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#19364A" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#647786"
              tick={{ fill: '#647786', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}
              tickLine={{ stroke: '#CBD5E1' }}
            />
            <YAxis
              stroke="#647786"
              tick={{ fill: '#647786', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}
              tickLine={{ stroke: '#CBD5E1' }}
              unit=" cfs"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#DCE4E9',
                borderRadius: '8px',
                color: '#19364A',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ fontSize: '12px', color: '#19364A' }}
            />

            {extremeThreshold && (
              <ReferenceLine
                y={extremeThreshold}
                stroke="#C94C55"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{
                  value: `Extreme Cutoff (${extremeThreshold} cfs)`,
                  fill: '#C94C55',
                  position: 'top',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            )}

            <Area
              type="monotone"
              dataKey="actual"
              name="Historical (observed)"
              stroke="#19364A"
              strokeWidth={2.5}
              fill="url(#actualGrad)"
              connectNulls={false}
            />

            <Line
              type="monotone"
              dataKey="predicted"
              name="Backtest (validation prediction)"
              stroke="#28A6A1"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
            />

            <Line
              type="monotone"
              dataKey="futurePrediction"
              name="Test-period prediction"
              stroke="#D97745"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#D97745', stroke: '#FFFFFF', strokeWidth: 1.5 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-[#647786] text-center flex flex-wrap items-center justify-center gap-6 pt-1">
        <span>— Solid Navy: Historical observed</span>
        <span>--- Dashed Teal: Backtest validation prediction</span>
        <span>-●- Dotted Ochre: Test-period prediction</span>
        <span className="text-[#C94C55] font-semibold">--- Red: Top 10% Extreme cutoff</span>
      </div>
    </div>
  )
}
