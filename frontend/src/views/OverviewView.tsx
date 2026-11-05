import React from 'react'
import type { EnrichedStation, RegionType } from '../types/data'
import { Terrain3DScene } from '../components/terrain/Terrain3DScene'
import StatsCounter from '../components/ui/stats-counter'
import { ArrowRight } from 'lucide-react'

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
    <div className="space-y-10">
      {/* Editorial Split Layout matching Reference Image 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Bold Editorial Typography & Wavy Accent */}
        <div className="lg:col-span-4 flex flex-col justify-center space-y-4">
          <h1 className="font-black italic uppercase tracking-tighter text-5xl sm:text-6xl text-black leading-[0.88] select-none">
            RIVER<br />
            CATCHMENT<br />
            MAP.
          </h1>

          {/* Blue Wave Accent Line matching Reference */}
          <div className="py-1">
            <svg
              className="w-24 h-4 text-[#2563EB]"
              viewBox="0 0 96 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 8C8 2 16 2 22 8C28 14 36 14 42 8C48 2 56 2 62 8C68 14 76 14 82 8C88 2 94 2 94 8"
                stroke="#2563EB"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <p className="text-sm font-medium text-black/75 leading-relaxed max-w-sm">
            Real-time river catchment intelligence, flow dynamics and flood risk insights.
          </p>

          <div className="pt-2">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/5 border border-black/10 text-[11px] font-mono font-bold text-black uppercase">
              <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
              {region === 'india' ? 'INDIA PROTOTYPE BASIN' : 'USGS 22 BASIN NETWORK'}
            </span>
          </div>
        </div>

        {/* Right Column: Large Rounded 3D Terrain Container matching Reference Image 2 */}
        <div className="lg:col-span-8">
          <div className="w-full rounded-[2.2rem] border border-black/80 overflow-hidden bg-white shadow-xl relative aspect-[16/10] min-h-[460px]">
            <Terrain3DScene
              region={region}
              stations={stations}
              selectedStationId={selectedStationId}
              onSelectStation={onSelectStation}
            />
          </div>
        </div>
      </div>

      {/* Horizontal Metrics Row matching Reference Image 2 */}
      <div className="border-t border-b border-black/10 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Metric 1: Gauging Network */}
        <div className="pr-4 md:border-r border-black/15">
          <div className="text-[11px] font-bold font-mono tracking-wider uppercase text-black/70 mb-1">
            GAUGING NETWORK
          </div>
          <div className="text-3xl sm:text-4xl font-black text-black tracking-tight">
            <StatsCounter value={stations.length} /> Stations
          </div>
        </div>

        {/* Metric 2: Mean Catchment Flow */}
        <div className="pr-4 md:border-r border-black/15">
          <div className="text-[11px] font-bold font-mono tracking-wider uppercase text-black/70 mb-1">
            MEAN CATCHMENT FLOW
          </div>
          <div className="text-3xl sm:text-4xl font-black text-black tracking-tight">
            <StatsCounter value={avgDischarge} decimals={1} /> cfs
          </div>
        </div>

        {/* Metric 3: Peak Catchment Flow */}
        <div className="pr-4 md:border-r border-black/15">
          <div className="text-[11px] font-bold font-mono tracking-wider uppercase text-black/70 mb-1">
            PEAK CATCHMENT FLOW
          </div>
          <div className="text-3xl sm:text-4xl font-black text-black tracking-tight">
            <StatsCounter value={maxDischargeStation?.currentDischarge} decimals={1} fallback="N/A" /> cfs
          </div>
        </div>

        {/* Metric 4: Extreme Flow Events */}
        <div>
          <div className="text-[11px] font-bold font-mono tracking-wider uppercase text-[#D9531E] mb-1">
            EXTREME FLOW EVENTS
          </div>
          <div className="text-3xl sm:text-4xl font-black text-[#D9531E] tracking-tight">
            <StatsCounter value={extremeStations.length} /> Stations
          </div>
        </div>
      </div>

      {/* Real Monitoring Station Directory */}
      <div className="bg-black/[0.02] border border-black/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-black uppercase tracking-wider font-mono">
            Catchment Gauging Directory (<StatsCounter value={stations.length} /> Active Stations)
          </h3>
          <span className="text-xs text-black/50">Click station to inspect hydrograph</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stations.map((s) => {
            const isSelected = s.station_id === selectedStationId
            return (
              <button
                key={s.station_id}
                onClick={() => {
                  onSelectStation(s.station_id)
                  onNavigateToStation(s.station_id)
                }}
                className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between group cursor-pointer ${
                  isSelected
                    ? 'border-[#2563EB] bg-[#2563EB]/5 shadow-xs'
                    : 'border-black/10 bg-white hover:border-black/40 hover:bg-black/[0.02]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-[#2563EB]">{s.station_id}</span>
                    {s.isExtreme && (
                      <span className="w-2 h-2 rounded-full bg-[#D9531E]" title="Extreme discharge" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-black truncate max-w-[220px] mt-0.5">
                    {s.station_name}
                  </div>
                  <div className="text-[11px] text-black/60 mt-0.5">
                    {s.river_name} &bull; {s.state} &bull; <span className="font-mono font-semibold">{s.currentDischarge?.toFixed(1) ?? 'N/A'} cfs</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-black/40 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
