import React from 'react'
import type { EnrichedStation, ModelResults } from '../../types/data'

interface PerStationTableProps {
  results: ModelResults
  stations: EnrichedStation[]
  onSelectStation: (id: string) => void
}

export const PerStationTable: React.FC<PerStationTableProps> = ({ results, stations, onSelectStation }) => {
  const stationNameMap = new Map(stations.map((s) => [s.station_id, s.station_name]))

  return (
    <div className="bg-white border border-[#DCE4E9] rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DCE4E9] pb-4">
        <div>
          <h3 className="text-lg font-bold text-[#19364A] tracking-tight">Station-Level Generalization Performance</h3>
          <p className="text-xs text-[#647786]">
            Cross-catchment validation metrics highlighting regional variance and prediction stress
          </p>
        </div>
        <div className="text-xs font-mono text-[#647786]">
          Strategy: <span className="text-[#28A6A1] font-semibold">{results.validation_strategy}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#DCE4E9] text-[#647786] uppercase tracking-wider font-semibold">
              <th className="py-3 px-3">Station ID</th>
              <th className="py-3 px-3">Catchment Name</th>
              <th className="py-3 px-3 text-right">RMSE (cfs)</th>
              <th className="py-3 px-3 text-right">MAE (cfs)</th>
              <th className="py-3 px-3 text-right">R² Score</th>
              <th className="py-3 px-3 text-right">Extreme Cutoff</th>
              <th className="py-3 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCE4E9]">
            {results.per_station.map((stn) => {
              const name = stationNameMap.get(stn.station_id) || 'Unknown Station'
              const isStrong = stn.r2 >= 0.88
              const isWeak = stn.r2 < 0.85

              return (
                <tr
                  key={stn.station_id}
                  onClick={() => onSelectStation(stn.station_id)}
                  className="hover:bg-[#F5F7F8] cursor-pointer transition"
                >
                  <td className="py-3.5 px-3 font-mono font-bold text-[#28A6A1]">{stn.station_id}</td>
                  <td className="py-3.5 px-3 text-[#19364A] font-medium">{name}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-[#19364A] font-semibold">{stn.rmse.toFixed(1)}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-[#647786]">{stn.mae.toFixed(1)}</td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold">
                    <span className={isStrong ? 'text-[#28A6A1]' : isWeak ? 'text-[#D97745]' : 'text-[#19364A]'}>
                      {stn.r2.toFixed(3)}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-[#C94C55] font-semibold">
                    &ge; {stn.extreme_threshold_cfs.toFixed(0)} cfs
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    {isStrong ? (
                      <span className="px-2 py-0.5 rounded bg-[#E6F4F1] text-[#28A6A1] border border-[#BCE5DD] text-[10px] font-semibold">
                        Strong Fit
                      </span>
                    ) : isWeak ? (
                      <span className="px-2 py-0.5 rounded bg-[#FFF7ED] text-[#D97745] border border-[#FFEDD5] text-[10px] font-semibold">
                        Higher Residuals
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] border border-[#DCE4E9] text-[10px] font-medium">
                        Nominal Fit
                      </span>
                    )}
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
