import React from 'react'
import type { EnrichedStation, ModelResults } from '../../types/data'
import { ArrowRight } from 'lucide-react'

interface PerStationTableProps {
  results: ModelResults
  stations: EnrichedStation[]
  onSelectStation: (id: string) => void
}

export const PerStationTable: React.FC<PerStationTableProps> = ({ results, stations, onSelectStation }) => {
  const stationNameMap = new Map(stations.map((s) => [s.station_id, s.station_name]))

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
      {/* Table Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 pb-5">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight select-none">
            Station-Level Generalization Performance
          </h3>
          <p className="text-xs sm:text-sm text-black/60 font-medium mt-0.5">
            Cross-catchment held-out validation metrics highlighting regional variance and prediction stress
          </p>
        </div>
        <div className="text-xs font-mono text-black/60">
          Strategy: <span className="text-[#2563EB] font-bold">{results.validation_strategy}</span>
        </div>
      </div>

      {/* Table with Clean Styling */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-black/10 text-black/50 uppercase font-mono text-[11px] font-bold tracking-wider">
              <th className="py-3.5 px-4">Station ID</th>
              <th className="py-3.5 px-4">Catchment Name</th>
              <th className="py-3.5 px-4 text-right">RMSE (cfs)</th>
              <th className="py-3.5 px-4 text-right">MAE (cfs)</th>
              <th className="py-3.5 px-4 text-right">R² Score</th>
              <th className="py-3.5 px-4 text-right">Extreme Cutoff</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-2 text-center sr-only">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {results.per_station.map((stn) => {
              const name = stationNameMap.get(stn.station_id) || 'Unknown Station'
              const isStrong = stn.r2 >= 0.88
              const isWeak = stn.r2 < 0.85

              return (
                <tr
                  key={stn.station_id}
                  onClick={() => onSelectStation(stn.station_id)}
                  className="hover:bg-black/[0.02] cursor-pointer transition group"
                >
                  <td className="py-4 px-4 font-mono font-bold text-[#2563EB]">
                    {stn.station_id}
                  </td>
                  <td className="py-4 px-4 font-bold text-black">
                    {name}
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-bold text-black">
                    {stn.rmse.toFixed(1)}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-black/70">
                    {stn.mae.toFixed(1)}
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-extrabold">
                    <span className={isStrong ? 'text-[#2563EB]' : isWeak ? 'text-[#D97745]' : 'text-black'}>
                      {stn.r2.toFixed(3)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-bold text-[#D9531E]">
                    &ge; {stn.extreme_threshold_cfs.toFixed(0)} cfs
                  </td>
                  <td className="py-4 px-4 text-center">
                    {isStrong ? (
                      <span className="px-2.5 py-1 rounded-lg bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/25 text-[10.5px] font-bold font-mono inline-block">
                        Strong Fit
                      </span>
                    ) : isWeak ? (
                      <span className="px-2.5 py-1 rounded-lg bg-[#D97745]/10 text-[#D97745] border border-[#D97745]/30 text-[10.5px] font-bold font-mono inline-block">
                        Higher Residuals
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-black/5 text-black border border-black/10 text-[10.5px] font-bold font-mono inline-block">
                        Nominal Fit
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-2 text-center">
                    <ArrowRight className="w-4 h-4 text-black/20 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PerStationTable
