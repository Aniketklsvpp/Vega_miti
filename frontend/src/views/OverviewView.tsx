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
        <div className="bg-white border border-[#DCE4E9] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#647786] mb-1">
            <span className="text-xs font-mono uppercase font-semibold">Gauging Network</span>
            <Compass className="w-4 h-4 text-[#28A6A1]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#19364A]">{stations.length} Stations</div>
          <div className="text-[11px] text-[#647786] mt-1">
            {region === 'india' ? 'India Catchment Monitoring' : 'USGS Monitored Catchments'}
          </div>
        </div>

        <div className="bg-white border border-[#DCE4E9] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#647786] mb-1">
            <span className="text-xs font-mono uppercase font-semibold">Mean Catchment Flow</span>
            <Droplet className="w-4 h-4 text-[#398DB5]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#19364A]">{avgDischarge.toFixed(1)} cfs</div>
          <div className="text-[11px] text-[#647786] mt-1">Cross-Station Average</div>
        </div>

        <div className="bg-white border border-[#DCE4E9] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#647786] mb-1">
            <span className="text-xs font-mono uppercase font-semibold">Peak Catchment Flow</span>
            <Activity className="w-4 h-4 text-[#28A6A1]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#19364A]">
            {maxDischargeStation?.currentDischarge?.toFixed(1) ?? 'N/A'} cfs
          </div>
          <div className="text-[11px] text-[#647786] mt-1 truncate">
            {maxDischargeStation?.station_name ?? 'N/A'}
          </div>
        </div>

        <div className="bg-white border border-[#FECDD3] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#647786] mb-1">
            <span className="text-xs font-mono uppercase font-semibold text-[#C94C55]">Extreme Flow Events</span>
            <Flame className="w-4 h-4 text-[#C94C55]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#C94C55]">
            {extremeStations.length} {extremeStations.length === 1 ? 'Station' : 'Stations'}
          </div>
          <div className="text-[11px] text-[#647786] mt-1">Top 10% Historical Cutoff</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#19364A] tracking-tight">
              {region === 'india' ? 'India River Basin Cartographic Map' : 'USGS River Catchment Survey Sheet'}
            </h2>
            <p className="text-xs text-[#647786]">
              Real geographic river lines &middot; Drag to pan &middot; Scroll to zoom &middot; Select station for telemetry
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#EAF0F3] text-[#19364A] font-semibold border border-[#DCE4E9]">
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

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-[#19364A] tracking-tight">
          River Monitoring Stations
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
                    ? 'bg-white border-[#28A6A1] shadow-md ring-1 ring-[#28A6A1]'
                    : 'bg-white border-[#DCE4E9] hover:bg-[#F5F7F8] hover:border-[#CBD5E1]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-[#28A6A1] font-bold">{stn.station_id}</span>
                    <h4 className="text-sm font-bold text-[#19364A]">{stn.station_name}</h4>
                    <p className="text-xs text-[#647786] mt-0.5">{stn.river_name || 'Catchment Basin'}, {stn.state}</p>
                  </div>
                  {stn.isExtreme && (
                    <span className="px-2 py-0.5 rounded bg-[#FFF1F2] text-[#C94C55] border border-[#FECDD3] text-[10px] font-bold flex items-center gap-1">
                      <Flame className="w-3 h-3" /> EXTREME
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#DCE4E9] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#647786]">Estimate:</span>{' '}
                    <span className="font-mono font-bold text-[#19364A]">
                      {stn.currentDischarge?.toFixed(1) ?? 'N/A'} cfs
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[#28A6A1] font-semibold">
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
