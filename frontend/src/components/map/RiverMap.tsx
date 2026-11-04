import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { EnrichedStation } from '../../types/data'
import { Flame } from 'lucide-react'

interface RiverMapProps {
  stations: EnrichedStation[]
  selectedStationId: string | null
  onSelectStation: (stationId: string) => void
}

export const RiverMap: React.FC<RiverMapProps> = ({ stations, selectedStationId, onSelectStation }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.CircleMarker[]>([])

  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapInstanceRef.current) return

    const initialCenter: [number, number] =
      stations.length > 0 ? [stations[0].latitude, stations[0].longitude] : [45.2, -69.2]

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [stations])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (stations.length === 0) return

    const bounds = L.latLngBounds([])

    stations.forEach((stn) => {
      const isSelected = stn.station_id === selectedStationId
      const isExtreme = stn.isExtreme

      const color = isExtreme ? '#f43f5e' : stn.percentileRank && stn.percentileRank > 70 ? '#38bdf8' : '#0ea5e9'

      const fillColor = isExtreme ? '#f43f5e' : '#38bdf8'

      const marker = L.circleMarker([stn.latitude, stn.longitude], {
        radius: isSelected ? 12 : isExtreme ? 10 : 8,
        color: isSelected ? '#ffffff' : color,
        weight: isSelected ? 3 : 2,
        fillColor: fillColor,
        fillOpacity: isExtreme ? 0.95 : 0.75,
      })

      marker.bindPopup(`
        <div style="font-family: ui-monospace, monospace; padding: 4px;">
          <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">${stn.station_id}</div>
          <div style="font-size: 14px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">${stn.station_name}</div>
          <div style="font-size: 12px; color: #38bdf8;">River: ${stn.river_name || 'USGS Catchment'}</div>
          <div style="font-size: 12px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #334155;">
            Forecast: <b>${stn.currentDischarge?.toFixed(1) ?? 'N/A'} cfs</b>
          </div>
          ${
            isExtreme
              ? `<div style="font-size: 11px; color: #f43f5e; font-weight: bold; margin-top: 4px;">⚠ EXTREME EVENT (Top 10%)</div>`
              : `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Percentile: ${stn.percentileRank}%</div>`
          }
        </div>
      `, { className: 'custom-map-popup' })

      marker.on('click', () => {
        onSelectStation(stn.station_id)
      })

      marker.addTo(map)
      markersRef.current.push(marker)
      bounds.extend([stn.latitude, stn.longitude])
    })

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 9 })
    }
  }, [stations, selectedStationId, onSelectStation])

  return (
    <div className="relative w-full h-[540px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full" />

      <div className="absolute top-4 right-4 z-[400] bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3.5 rounded-xl text-xs space-y-2 shadow-xl">
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Catchment Hydrology
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-cyan-400 border border-cyan-300" />
          <span className="text-slate-300">Nominal Discharge</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-sky-500 border border-sky-400" />
          <span className="text-slate-300">Elevated Flow (&gt;70th %ile)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-400 shadow-[0_0_8px_#f43f5e]" />
          <span className="text-rose-400 font-semibold flex items-center gap-1">
            <Flame className="w-3 h-3" /> Extreme Flow (Top 10%)
          </span>
        </div>
      </div>
    </div>
  )
}
