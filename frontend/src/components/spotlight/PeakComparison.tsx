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
          label: `${row.date} (${row.station_id})`,
        }
      })
  }, [validationRows, stationNameMap])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-white border border-[#DCE4E9] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#EAF0F3] text-[#28A6A1]">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#19364A] tracking-tight">Peak Event Validation Audit</h2>
            <p className="text-xs text-[#647786]">Comparing top historical peak discharge events against model estimates</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#F3E8FF] text-[#7E22CE] border border-[#E9D5FF] shadow-xs">
          <AlertCircle className="w-3.5 h-3.5 text-[#7E22CE]" />
          <span>HISTORICAL VALIDATION DATA ONLY</span>
        </div>
      </div>

      <div className="bg-white border border-[#DCE4E9] rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-[#19364A] tracking-tight uppercase">
          Top 8 Highest Observed Discharge Days (Actual vs Predicted)
        </h3>

        <div className="h-[360px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topPeakRows} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#647786"
                tick={{ fill: '#647786', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}
              />
              <YAxis
                stroke="#647786"
                tick={{ fill: '#647786', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}
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
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', color: '#19364A' }} />
              <Bar dataKey="actual" name="Historical Observed (cfs)" fill="#19364A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="predicted" name="Model Estimate (cfs)" fill="#28A6A1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-[#DCE4E9] rounded-2xl p-6 shadow-xs">
        <h3 className="text-sm font-bold text-[#19364A] tracking-tight uppercase mb-4">
          Peak Event Residual Audit Log
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#DCE4E9] text-[#647786] uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Station</th>
                <th className="py-2.5 px-3 text-right">Actual (cfs)</th>
                <th className="py-2.5 px-3 text-right">Predicted (cfs)</th>
                <th className="py-2.5 px-3 text-right">Residual Error</th>
                <th className="py-2.5 px-3 text-right">% Error</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE4E9]">
              {topPeakRows.map((row) => (
                <tr key={`${row.station_id}-${row.date}`} className="hover:bg-[#F5F7F8] transition">
                  <td className="py-3 px-3 font-semibold text-[#19364A]">{row.date}</td>
                  <td className="py-3 px-3">
                    <div className="font-mono font-bold text-[#28A6A1]">{row.station_id}</div>
                    <div className="text-[11px] text-[#647786]">{row.stationName}</div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-[#19364A]">{row.actual.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-[#28A6A1]">{row.predicted.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right font-mono text-[#19364A]">
                    {row.residual > 0 ? `+${row.residual.toFixed(1)}` : row.residual.toFixed(1)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                        Math.abs(Number(row.pctError)) < 10
                          ? 'bg-[#E6F4F1] text-[#28A6A1] border border-[#BCE5DD]'
                          : 'bg-[#FFF7ED] text-[#D97745] border border-[#FFEDD5]'
                      }`}
                    >
                      {row.pctError}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => onSelectStation(row.station_id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#EAF0F3] hover:bg-[#DCE4E9] text-[#19364A] text-xs font-semibold transition"
                    >
                      View <ArrowUpRight className="w-3.5 h-3.5 text-[#28A6A1]" />
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
