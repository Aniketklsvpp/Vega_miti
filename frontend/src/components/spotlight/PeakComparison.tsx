import React, { useMemo } from 'react'
import type { EnrichedStation, ValidationPredictionRow } from '../../types/data'
import { AlertCircle, ArrowUpRight, BarChart2 } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'

interface PeakComparisonProps {
  validationRows: ValidationPredictionRow[]
  stations: EnrichedStation[]
  onSelectStation: (id: string) => void
}

export const PeakComparison: React.FC<PeakComparisonProps> = ({ validationRows, stations, onSelectStation }) => {
  const stationNameMap = useMemo(() => new Map(stations.map((s) => [s.station_id, s.station_name])), [stations])

  const topPeakRows = useMemo(() => {
    return [...validationRows]
      .sort((a, b) => b.actual - a.actual)
      .slice(0, 8)
      .map((row) => {
        const error = row.actual - row.predicted
        const pctError = ((error / row.actual) * 100).toFixed(1)
        const name = stationNameMap.get(row.station_id) || row.station_id
        return {
          ...row,
          stationName: name,
          residual: error,
          pctError,
          label: `${row.date} (${row.station_id.replace('STN_', '')})`,
        }
      })
  }, [validationRows, stationNameMap])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 tracking-tight">Peak Event Validation Audit</h2>
            <p className="text-xs text-slate-400">Comparing top historical peak discharge events against model estimates</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-purple-500/10 text-purple-300 border border-purple-500/30">
          <AlertCircle className="w-3.5 h-3.5 text-purple-400" />
          <span>HISTORICAL VALIDATION DATA ONLY</span>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-slate-200 tracking-tight font-mono uppercase">
          Top 8 Highest Observed Discharge Days (Actual vs Predicted)
        </h3>

        <div className="h-[360px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topPeakRows} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
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
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
              <Bar dataKey="actual" name="Historical Actual (cfs)" fill="#a855f7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="predicted" name="Model Estimate (cfs)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-bold text-slate-200 tracking-tight font-mono uppercase mb-4">
          Peak Event Residual Audit Log
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Station</th>
                <th className="py-2.5 px-3 text-right">Actual (cfs)</th>
                <th className="py-2.5 px-3 text-right">Predicted (cfs)</th>
                <th className="py-2.5 px-3 text-right">Residual Error</th>
                <th className="py-2.5 px-3 text-right">% Error</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {topPeakRows.map((row) => (
                <tr key={`${row.station_id}-${row.date}`} className="hover:bg-slate-800/50 transition">
                  <td className="py-3 px-3 font-semibold text-slate-200">{row.date}</td>
                  <td className="py-3 px-3 text-cyan-400">
                    <div>{row.station_id}</div>
                    <div className="text-[10px] text-slate-400 font-sans">{row.stationName}</div>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-purple-300">{row.actual.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right font-bold text-cyan-300">{row.predicted.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right text-slate-200">
                    {row.residual > 0 ? `+${row.residual.toFixed(1)}` : row.residual.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        Math.abs(Number(row.pctError)) < 10
                          ? 'bg-emerald-950/60 text-emerald-400'
                          : 'bg-amber-950/60 text-amber-400'
                      }`}
                    >
                      {row.pctError}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => onSelectStation(row.station_id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition"
                    >
                      View <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

