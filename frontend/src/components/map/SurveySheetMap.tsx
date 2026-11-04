import React, { useEffect, useState, useRef, useMemo } from 'react'
import * as d3Geo from 'd3-geo'
import type { EnrichedStation, RegionType } from '../../types/data'
import { AlertCircle, Flame, Minus, Plus, RotateCcw } from 'lucide-react'

interface SurveySheetMapProps {
  region: RegionType
  stations: EnrichedStation[]
  selectedStationId: string | null
  onSelectStation: (id: string) => void
}

export const SurveySheetMap: React.FC<SurveySheetMapProps> = ({
  region,
  stations,
  selectedStationId,
  onSelectStation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [geoData, setGeoData] = useState<d3Geo.ExtendedFeatureCollection | null>(null)
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const width = 960
  const height = 560

  useEffect(() => {
    const file = region === 'usa' ? '/assets/geo/usa-boundary.json' : '/assets/geo/india-pov.json'
    fetch(file)
      .then((res) => res.json())
      .then((data) => setGeoData(data as d3Geo.ExtendedFeatureCollection))
      .catch(() => setGeoData(null))
  }, [region])

  const { projection, pathGenerator } = useMemo(() => {
    let proj: d3Geo.GeoProjection

    if (region === 'usa') {
      proj = d3Geo.geoAlbersUsa().translate([width / 2, height / 2]).scale(1100)
    } else {
      proj = d3Geo.geoMercator().center([82.0, 22.5]).translate([width / 2, height / 2]).scale(1150)
    }

    const path = d3Geo.geoPath().projection(proj)
    return { projection: proj, pathGenerator: path }
  }, [region, width, height])

  const countryPath = useMemo(() => {
    if (!geoData || !geoData.features || geoData.features.length === 0) return ''
    return pathGenerator(geoData.features[0]) || ''
  }, [geoData, pathGenerator])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const resetView = () => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-[#52493b] bg-[#ede6d4] shadow-2xl select-none">
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-[580px] cursor-grab active:cursor-grabbing overflow-hidden"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <defs>
            <clipPath id="survey-boundary-clip">
              {countryPath ? <path d={countryPath} /> : <rect width={width} height={height} />}
            </clipPath>

            <pattern id="survey-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#7d7565" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.35" />
            </pattern>

            <filter id="carto-paper-filter">
              <feColorMatrix
                type="matrix"
                values="
                  1.05 0 0 0 0
                  0 1.02 0 0 0
                  0 0 0.95 0 0
                  0 0 0 1 0"
              />
            </filter>
          </defs>

          <rect width={width} height={height} fill="#ede5d1" />
          <rect width={width} height={height} fill="url(#survey-grid-pattern)" />

          <g clipPath="url(#survey-boundary-clip)">
            <rect width={width} height={height} fill="#f4eedb" />
            <image
              href="/assets/topo.png"
              x="0"
              y="0"
              width={width}
              height={height}
              preserveAspectRatio="xMidYMid slice"
              opacity="0.7"
              style={{ mixBlendMode: 'multiply' }}
            />
            <rect width={width} height={height} fill="url(#survey-grid-pattern)" opacity="0.6" />
          </g>

          {countryPath && (
            <path
              d={countryPath}
              fill="none"
              stroke="#2d2a24"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.85"
            />
          )}

          {stations.map((stn) => {
            const coords = projection([stn.longitude, stn.latitude])
            if (!coords) return null
            const [cx, cy] = coords
            const isSelected = stn.station_id === selectedStationId
            const isExtreme = stn.isExtreme
            const pinColor = isExtreme ? '#e11d48' : isSelected ? '#0284c7' : '#2d2a24'

            return (
              <g
                key={stn.station_id}
                transform={`translate(${cx}, ${cy})`}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectStation(stn.station_id)
                }}
                className="cursor-pointer group"
              >
                {isExtreme && (
                  <circle
                    r="14"
                    fill="none"
                    stroke="#e11d48"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    className="animate-pulse"
                    opacity="0.8"
                  />
                )}

                {isSelected && (
                  <circle
                    r="12"
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="2"
                    opacity="0.9"
                  />
                )}

                <circle
                  r="6"
                  fill={isExtreme ? '#ffe4e6' : '#fcfaf5'}
                  stroke={pinColor}
                  strokeWidth="1.5"
                />

                <line x1="-7" y1="0" x2="7" y2="0" stroke={pinColor} strokeWidth="2" strokeLinecap="round" />
                <line x1="0" y1="-7" x2="0" y2="7" stroke={pinColor} strokeWidth="2" strokeLinecap="round" />

                <g transform="translate(10, -10)">
                  <rect
                    x="0"
                    y="-12"
                    width={stn.station_id.length * 7 + 16}
                    height="18"
                    rx="3"
                    fill="#1e1b18"
                    opacity="0.85"
                  />
                  <text
                    x="8"
                    y="1"
                    fontSize="9.5"
                    fontFamily="ui-monospace, monospace"
                    fontWeight="700"
                    fill={isExtreme ? '#fca5a5' : '#f4eedb'}
                  >
                    {stn.station_id}
                  </text>
                </g>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 bg-[#1a1714]/90 backdrop-blur-md border border-[#453d32] p-2 rounded-xl text-slate-200 shadow-xl">
        <button
          onClick={() => setZoomLevel((z) => Math.min(z + 0.3, 3))}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoomLevel((z) => Math.max(z - 0.3, 0.7))}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-200 transition"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute top-4 right-4 z-10 bg-[#181512]/92 backdrop-blur-md border border-[#4a4235] p-3 rounded-xl text-xs font-mono space-y-2 text-slate-200 shadow-xl max-w-xs">
        <div className="text-[10.5px] uppercase tracking-wider text-slate-400 font-bold border-b border-[#3b3429] pb-1">
          Survey Legend & Symbols
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#f4eedb] text-base leading-none">+</span>
          <span className="text-slate-300 text-[11px]">Survey Observation Station</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sky-400 text-base leading-none">+</span>
          <span className="text-sky-300 text-[11px]">Selected Station</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-rose-500 text-base leading-none flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-rose-500" />
          </span>
          <span className="text-rose-400 font-bold text-[11px]">Top 10% Extreme Flow</span>
        </div>
      </div>

      <div className="p-2.5 bg-[#201c18] border-t border-[#40372b] flex items-center justify-between text-[11px] font-mono text-[#a39783] px-4">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500/90 shrink-0" />
          <span>Stylised map: contours and rivers are illustrative, station positions come from the data.</span>
        </div>
        <div className="hidden sm:block text-slate-400">
          Scale 1:5,000,000 &middot; Projection: {region === 'usa' ? 'Albers Equal-Area' : 'Survey Mercator'}
        </div>
      </div>
    </div>
  )
}
