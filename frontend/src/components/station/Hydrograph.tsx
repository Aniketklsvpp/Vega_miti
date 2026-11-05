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
  const isYamuna =
    stationId.includes('YMN') ||
    stationName.toLowerCase().includes('yamuna') ||
    stationId === 'IND-BR-01'

  const chartData = [
    ...validationRows.map((r) => ({
      date: r.date,
      type: 'validation',
      actual: r.actual != null && !isNaN(r.actual) ? r.actual : null,
      predicted: r.predicted != null && !isNaN(r.predicted) ? r.predicted : null,
      futurePrediction: null as number | null,
    })),
    ...predictionRows.map((r) => ({
      date: r.date,
      type: 'prediction',
      actual: null as number | null,
      predicted: null as number | null,
      futurePrediction:
        r.discharge_cfs != null && !isNaN(r.discharge_cfs) ? r.discharge_cfs : null,
    })),
  ]

  const unitStr = isYamuna ? ' m MSL' : ' cfs'

  // Custom polished tooltip matching River Catchment Map design
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md border border-black/10 rounded-xl p-3.5 shadow-xl text-xs space-y-2 min-w-[220px]">
          <div className="flex items-center justify-between border-b border-black/10 pb-1.5 font-mono text-[11px] text-black/60">
            <span className="font-bold text-black">{label}</span>
            <span className="font-semibold">{isYamuna ? 'CWC Gauge' : 'USGS NWIS'}</span>
          </div>

          <div className="space-y-1.5">
            {payload.map((entry: any, i: number) => {
              if (entry.value == null) return null
              return (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-black/70 font-medium">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    {entry.name}:
                  </span>
                  <span className="font-bold font-mono text-black">
                    {Number(entry.value).toFixed(isYamuna ? 2 : 1)}
                    {unitStr}
                  </span>
                </div>
              )
            })}
          </div>

          {isYamuna && payload[0]?.value != null && (
            <div className="text-[10.5px] font-semibold text-black/70 pt-1.5 border-t border-black/10">
              {Number(payload[0].value) >= 208.66 ? (
                <span className="text-[#991B1B] font-bold">★ All-Time 2023 Crest Breached</span>
              ) : Number(payload[0].value) >= 205.33 ? (
                <span className="text-[#D9531E] font-bold">⚠ Danger Level Exceeded (Evacuation)</span>
              ) : Number(payload[0].value) >= 204.5 ? (
                <span className="text-[#D97745] font-bold">⚡ Warning Mark Exceeded</span>
              ) : (
                <span className="text-emerald-700 font-bold">✔ Below Statutory Warning Mark</span>
              )}
            </div>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
      {/* Top Station Hydrograph Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#2563EB] bg-[#2563EB]/10 px-2 py-0.5 rounded border border-[#2563EB]/25 uppercase">
              {stationId}
            </span>
            {isDemo && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/5 text-black/70 border border-black/10">
                DEMO DATA
              </span>
            )}
            {isYamuna && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/25">
                STAGE GAUGE (METRES MSL)
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight mt-1 select-none">
            {stationName}
          </h2>
        </div>

        {isYamuna ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-mono font-bold shadow-2xs">
              Danger: <b>205.33 m</b>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-mono font-bold shadow-2xs">
              Warning: <b>204.50 m</b>
            </div>
          </div>
        ) : (
          extremeThreshold && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#D9531E]/10 border border-[#D9531E]/30 text-[#D9531E] text-xs font-mono font-bold shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D9531E] animate-pulse" />
              <span>
                Extreme Cutoff (P90): <b>{extremeThreshold.toFixed(1)} cfs</b>
              </span>
            </div>
          )
        )}
      </div>

      {/* Large Hydrograph Visualization */}
      <div className="h-[500px] sm:h-[540px] w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 25 }}>
            <defs>
              {/* Subtle Area Gradient for Dark Navy Observed Discharge */}
              <linearGradient id="observedNavyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0F172A" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#0F172A" stopOpacity={0.0} />
              </linearGradient>

              {/* Subtle Area Gradient for Forecast Horizon */}
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D97745" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#D97745" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#64748B"
              tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'monospace' }}
              tickLine={{ stroke: '#E2E8F0' }}
              axisLine={{ stroke: '#E2E8F0' }}
            />
            <YAxis
              stroke="#64748B"
              tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'monospace' }}
              tickLine={{ stroke: '#E2E8F0' }}
              axisLine={{ stroke: '#E2E8F0' }}
              unit={unitStr}
              domain={isYamuna ? [200, 210] : ['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={40}
              wrapperStyle={{ fontSize: '12px', color: '#0F172A', fontWeight: 700 }}
            />

            {/* Yamuna Statutory Threshold Reference Lines */}
            {isYamuna && (
              <>
                <ReferenceLine
                  y={204.5}
                  stroke="#D97745"
                  strokeDasharray="4 4"
                  strokeWidth={1.8}
                  label={{
                    value: 'Warning (204.50m)',
                    fill: '#D97745',
                    position: 'top',
                    fontSize: 10.5,
                    fontWeight: 700,
                  }}
                />
                <ReferenceLine
                  y={205.33}
                  stroke="#D9531E"
                  strokeDasharray="4 4"
                  strokeWidth={2.2}
                  label={{
                    value: 'Danger (205.33m)',
                    fill: '#D9531E',
                    position: 'top',
                    fontSize: 10.5,
                    fontWeight: 800,
                  }}
                />
                <ReferenceLine
                  y={207.49}
                  stroke="#7C3AED"
                  strokeDasharray="3 3"
                  strokeWidth={1.8}
                  label={{
                    value: '1978 Record (207.49m)',
                    fill: '#7C3AED',
                    position: 'top',
                    fontSize: 10.5,
                    fontWeight: 700,
                  }}
                />
                <ReferenceLine
                  y={208.66}
                  stroke="#991B1B"
                  strokeWidth={2.5}
                  label={{
                    value: '2023 Peak Crest (208.66m)',
                    fill: '#991B1B',
                    position: 'top',
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                />
              </>
            )}

            {!isYamuna && extremeThreshold && (
              <ReferenceLine
                y={extremeThreshold}
                stroke="#D9531E"
                strokeDasharray="4 4"
                strokeWidth={2.2}
                label={{
                  value: `Extreme Cutoff (${extremeThreshold.toFixed(1)} cfs)`,
                  fill: '#D9531E',
                  position: 'top',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              />
            )}

            {/* 1. Observed Discharge: Dark Navy Curve with Subtle Area Fill */}
            <Area
              type="monotone"
              dataKey="actual"
              name={isYamuna ? 'Observed Stage Level' : 'Observed Discharge'}
              stroke="#0F172A"
              strokeWidth={3}
              fill="url(#observedNavyGrad)"
              connectNulls={false}
              isAnimationActive={true}
              animationDuration={1200}
              animationEasing="ease-out"
            />

            {/* 2. Backtest Predictions: Distinct Blue/Teal Dashed Curve */}
            <Line
              type="monotone"
              dataKey="predicted"
              name={isYamuna ? 'Backtest Hydrograph' : 'Backtest (Prediction)'}
              stroke="#2563EB"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={true}
              animationDuration={1200}
              animationEasing="ease-out"
            />

            {/* 3. Forecast Horizon Estimates: Warm Ochre with Smooth Markers */}
            <Line
              type="monotone"
              dataKey="futurePrediction"
              name="Forecast Horizon Estimate"
              stroke="#D97745"
              strokeWidth={3}
              dot={{ r: 4.5, fill: '#D97745', stroke: '#FFFFFF', strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={true}
              animationDuration={1200}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Graph Legend & Data Indicators */}
      <div className="text-xs text-black/60 text-center flex flex-wrap items-center justify-center gap-6 pt-3 border-t border-black/10">
        <span className="flex items-center gap-1.5 font-bold text-[#0F172A]">
          <span className="w-4 h-1 bg-[#0F172A] rounded-full inline-block" /> Observed Discharge &mdash; Solid Dark Navy
        </span>
        <span className="flex items-center gap-1.5 font-bold text-[#2563EB]">
          <span className="w-4 h-0.5 bg-[#2563EB] inline-block border-b-2 border-dashed border-[#2563EB]" /> Backtest Prediction &mdash; Dashed Blue
        </span>
        <span className="flex items-center gap-1.5 font-bold text-[#D97745]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#D97745] inline-block" /> Forecast Horizon &mdash; Warm Ochre
        </span>
        {isYamuna ? (
          <span className="text-[#D9531E] font-bold flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-[#D9531E] inline-block border-b-2 border-dashed border-[#D9531E]" /> Statutory CWC Warning/Danger Lines
          </span>
        ) : (
          extremeThreshold && (
            <span className="text-[#D9531E] font-bold flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-[#D9531E] inline-block border-b-2 border-dotted border-[#D9531E]" /> Extreme Cutoff (P90)
            </span>
          )
        )}
      </div>
    </div>
  )
}

export default Hydrograph
