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
    <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DDD1BF] pb-4">
        <div>
          <h3 className="text-lg font-bold text-[#1F2A33] tracking-tight">Station-Level Generalization Performance</h3>
          <p className="text-xs text-[#526573]">
            Cross-catchment validation metrics highlighting regional variance and prediction stress
          </p>
        </div>
        <div className="text-xs font-mono text-[#526573]">
          Strategy: <span className="text-[#2F7F8F] font-semibold">{results.validation_strategy}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#DDD1BF] text-[#526573] uppercase tracking-wider font-semibold">
              <th className="py-3 px-3">Station ID</th>
              <th className="py-3 px-3">Catchment Name</th>
              <th className="py-3 px-3 text-right">RMSE (cfs)</th>
              <th className="py-3 px-3 text-right">MAE (cfs)</th>
              <th className="py-3 px-3 text-right">R² Score</th>
              <th className="py-3 px-3 text-right">Extreme Cutoff</th>
              <th className="py-3 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDD1BF]">
            {results.per_station.map((stn) => {
              const name = stationNameMap.get(stn.station_id) || 'Unknown Station'
              const isStrong = stn.r2 >= 0.88
              const isWeak = stn.r2 < 0.85

              return (
                <tr
                  key={stn.station_id}
                  onClick={() => onSelectStation(stn.station_id)}
                  className="hover:bg-[#F3EBDD]/60 cursor-pointer transition"
                >
                  <td className="py-3.5 px-3 font-mono font-bold text-[#2F7F8F]">{stn.station_id}</td>
                  <td className="py-3.5 px-3 text-[#1F2A33] font-medium">{name}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-[#1F2A33] font-semibold">{stn.rmse.toFixed(1)}</td>
                  <td className="py-3.5 px-3 text-right font-mono text-[#526573]">{stn.mae.toFixed(1)}</td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold">
                    <span className={isStrong ? 'text-[#2F7F8F]' : isWeak ? 'text-[#B8893B]' : 'text-[#1F2A33]'}>
                      {stn.r2.toFixed(3)}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-[#D8432B] font-semibold">
                    &ge; {stn.extreme_threshold_cfs.toFixed(0)} cfs
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    {isStrong ? (
                      <span className="px-2 py-0.5 rounded bg-[#E8F2F4] text-[#2F7F8F] border border-[#2F7F8F]/30 text-[10px] font-semibold">
                        Strong Fit
                      </span>
                    ) : isWeak ? (
                      <span className="px-2 py-0.5 rounded bg-[#F7F0E3] text-[#B8893B] border border-[#B8893B]/30 text-[10px] font-semibold">
                        Higher Residuals
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-[#EAE1D2] text-[#1F2A33] border border-[#DDD1BF] text-[10px] font-medium">
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
