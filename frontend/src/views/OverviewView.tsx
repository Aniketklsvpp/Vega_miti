import React from 'react'
import type { EnrichedStation, RegionType } from '../types/data'
import { SurveySheetMap } from '../components/map/SurveySheetMap'
import { Activity, ArrowRight, Compass, Droplet, Flame } from 'lucide-react'

interface OverviewViewProps {
  region: RegionType
  stations: EnrichedStation[]
  selectedStationId: string | null
  onSelectStation: (id: string) => void
  onNavigateToStation: (id: string) => void
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  region,
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
        <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#526573] mb-1">
            <span className="text-xs font-mono uppercase font-semibold">Gauging Network</span>
            <Compass className="w-4 h-4 text-[#2F7F8F]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#1F2A33]">{stations.length} Stations</div>
          <div className="text-[11px] text-[#526573] mt-1">
            {region === 'india' ? 'India Catchment Monitoring' : 'USGS Monitored Catchments (22 Active)'}
          </div>
        </div>

        <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#526573] mb-1">
            <span className="text-xs font-mono uppercase font-semibold">Mean Catchment Flow</span>
            <Droplet className="w-4 h-4 text-[#2F7F8F]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#1F2A33]">{avgDischarge.toFixed(1)} cfs</div>
          <div className="text-[11px] text-[#526573] mt-1">Cross-Station Average</div>
        </div>

        <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#526573] mb-1">
            <span className="text-xs font-mono uppercase font-semibold">Peak Catchment Flow</span>
            <Activity className="w-4 h-4 text-[#B8893B]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#1F2A33]">
            {maxDischargeStation?.currentDischarge?.toFixed(1) ?? 'N/A'} cfs
          </div>
          <div className="text-[11px] text-[#526573] mt-1 truncate">
            {maxDischargeStation?.station_name ?? 'N/A'}
          </div>
        </div>

        <div className="bg-[#FAF6EE] border border-[#D8432B]/30 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#526573] mb-1">
            <span className="text-xs font-mono uppercase font-semibold text-[#D8432B]">Extreme Flow Events</span>
            <Flame className="w-4 h-4 text-[#D8432B]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#D8432B]">
            {extremeStations.length} {extremeStations.length === 1 ? 'Station' : 'Stations'}
          </div>
          <div className="text-[11px] text-[#526573] mt-1">Top 10% Historical Cutoff</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1F2A33] tracking-tight">
              {region === 'india' ? 'India River Basin Cartographic Map' : 'USGS River Catchment Survey Sheet'}
            </h2>
            <p className="text-xs text-[#526573]">
              Real geographic river lines &middot; Drag to pan &middot; Scroll to zoom &middot; Select station for telemetry
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#EAE1D2] text-[#1F2A33] font-semibold border border-[#DDD1BF]">
            {region.toUpperCase()} REGION
          </span>
        </div>
        <SurveySheetMap
          region={region}
          stations={stations}
          selectedStationId={selectedStationId}
          onSelectStation={(id) => {
            onSelectStation(id)
            onNavigateToStation(id)
          }}
        />
      </div>

      <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-[#1F2A33] mb-3">Monitoring Station Directory</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stations.map((s) => (
            <button
              key={s.station_id}
              onClick={() => {
                onSelectStation(s.station_id)
                onNavigateToStation(s.station_id)
              }}
              className="p-3 rounded-xl border border-[#DDD1BF] hover:border-[#2F7F8F] bg-[#F3EBDD]/40 hover:bg-[#FAF6EE] text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold text-[#2F7F8F]">{s.station_id}</span>
                  {s.isExtreme && (
                    <span className="w-2 h-2 rounded-full bg-[#D8432B]" title="Extreme discharge" />
                  )}
                </div>
                <div className="text-xs font-semibold text-[#1F2A33] truncate max-w-[200px] mt-0.5">
                  {s.station_name}
                </div>
                <div className="text-[10px] text-[#526573] mt-0.5">
                  {s.river_name} &bull; {s.state}
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#526573] group-hover:text-[#2F7F8F] group-hover:translate-x-0.5 transition" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
