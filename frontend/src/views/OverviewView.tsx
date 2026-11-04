import React from 'react'
import type { EnrichedStation } from '../types/data'
import { RiverMap } from '../components/map/RiverMap'
import { Activity, ArrowRight, Compass, Droplet, Flame } from 'lucide-react'

interface OverviewViewProps {
  stations: EnrichedStation[]
  selectedStationId: string | null
  onSelectStation: (id: string) => void
  onNavigateToStation: (id: string) => void
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  stations,
  selectedStationId,
  onSelectStation,
  onNavigateToStation,
}) => {
  const extremeStations = stations.filter((s) => s.isExtreme)
  const maxDischargeStation = stations.reduce(
    (max, s) => ((s.currentDischarge ?? 0) > (max.currentDischarge ?? 0) ? s : max),
    stations[0]
  )

  const avgDischarge =
    stations.length > 0
      ? stations.reduce((acc, s) => acc + (s.currentDischarge ?? 0), 0) / stations.length
      : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-mono uppercase font-semibold">Active Catchments</span>
            <Compass className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{stations.length} Stations</div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">USGS River Gauging Network</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-mono uppercase font-semibold">Mean Flow Forecast</span>
            <Droplet className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{avgDischarge.toFixed(1)} cfs</div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">Cross-Station Average</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-mono uppercase font-semibold">Peak Catchment Flow</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300">
            {maxDischargeStation?.currentDischarge?.toFixed(1) ?? 'N/A'} cfs
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-1 truncate">
            {maxDischargeStation?.station_name ?? 'N/A'}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-rose-950/60 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-mono uppercase font-semibold text-rose-300">Extreme Flow Events</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            {extremeStations.length} {extremeStations.length === 1 ? 'Station' : 'Stations'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-1">Top 10% Historical Cutoff</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-200 tracking-tight font-mono uppercase">
            Spatial River Intelligence Map
          </h2>
          <span className="text-xs text-slate-400 font-mono">Select marker to inspect catchment telemetry</span>
        </div>
        <RiverMap
          stations={stations}
          selectedStationId={selectedStationId}
          onSelectStation={(id) => {
            onSelectStation(id)
            onNavigateToStation(id)
          }}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-300 tracking-tight font-mono uppercase">
          Monitored River Stations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((stn) => {
            const isSelected = stn.station_id === selectedStationId
            return (
              <div
                key={stn.station_id}
                onClick={() => {
                  onSelectStation(stn.station_id)
                  onNavigateToStation(stn.station_id)
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-500/50 shadow-lg shadow-cyan-950/40'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900/90 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-cyan-400 font-semibold">{stn.station_id}</span>
                    <h4 className="text-sm font-bold text-slate-100">{stn.station_name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{stn.river_name || 'Catchment Basin'}, {stn.state}</p>
                  </div>
                  {stn.isExtreme && (
                    <span className="px-2 py-0.5 rounded bg-rose-950/70 text-rose-400 border border-rose-800/60 text-[10px] font-mono font-bold flex items-center gap-1">
                      <Flame className="w-3 h-3" /> EXTREME
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 font-mono">Discharge:</span>{' '}
                    <span className="font-mono font-bold text-slate-200">
                      {stn.currentDischarge?.toFixed(1) ?? 'N/A'} cfs
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono font-medium">
                    Hydrograph <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
