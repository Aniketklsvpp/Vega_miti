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
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100 tracking-tight">Station-Level Validation Integrity</h3>
          <p className="text-xs text-slate-400">
            Cross-catchment generalization metrics highlighting regional variance and prediction stress
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Strategy: <span className="text-cyan-400">{results.validation_strategy}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-3">Station ID</th>
              <th className="py-3 px-3">Catchment Name</th>
              <th className="py-3 px-3 text-right">RMSE (cfs)</th>
              <th className="py-3 px-3 text-right">MAE (cfs)</th>
              <th className="py-3 px-3 text-right">R² Score</th>
              <th className="py-3 px-3 text-right">Extreme Cutoff</th>
              <th className="py-3 px-3 text-center">Generalization Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {results.per_station.map((stn) => {
              const name = stationNameMap.get(stn.station_id) || 'Unknown Station'
              const isStrong = stn.r2 >= 0.88
              const isWeak = stn.r2 < 0.85

              return (
                <tr
                  key={stn.station_id}
                  onClick={() => onSelectStation(stn.station_id)}
                  className="hover:bg-slate-800/50 cursor-pointer transition"
                >
                  <td className="py-3.5 px-3 font-bold text-cyan-400">{stn.station_id}</td>
                  <td className="py-3.5 px-3 text-slate-200 font-sans">{name}</td>
                  <td className="py-3.5 px-3 text-right text-slate-200 font-semibold">{stn.rmse.toFixed(1)}</td>
                  <td className="py-3.5 px-3 text-right text-slate-300">{stn.mae.toFixed(1)}</td>
                  <td className="py-3.5 px-3 text-right font-bold">
                    <span className={isStrong ? 'text-emerald-400' : isWeak ? 'text-amber-400' : 'text-slate-200'}>
                      {stn.r2.toFixed(3)}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right text-rose-400 font-semibold">
                    &ge; {stn.extreme_threshold_cfs.toFixed(0)} cfs
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    {isStrong ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 text-[10px]">
                        Strong Fit
                      </span>
                    ) : isWeak ? (
                      <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/50 text-[10px]">
                        Higher Residuals
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
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

