import React, { useEffect, useState, useRef, useMemo } from 'react'
import * as d3Geo from 'd3-geo'
import type { EnrichedStation, RegionType } from '../../types/data'
import { AlertCircle, Flame, Layers, Minus, Plus, RotateCcw } from 'lucide-react'

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
  const [riversData, setRiversData] = useState<d3Geo.ExtendedFeatureCollection | null>(null)
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const width = 960
  const height = 620

  useEffect(() => {
    const boundaryFile = region === 'usa' ? '/assets/geo/usa-boundary.json' : '/assets/geo/india-pov.json'
    fetch(boundaryFile)
      .then((res) => res.json())
      .then((data) => setGeoData(data as d3Geo.ExtendedFeatureCollection))
      .catch(() => setGeoData(null))

    if (region === 'india') {
      fetch('/assets/geo/india-rivers.json')
        .then((res) => res.json())
        .then((data) => setRiversData(data as d3Geo.ExtendedFeatureCollection))
        .catch(() => setRiversData(null))
    } else {
      setRiversData(null)
    }
  }, [region])

  const { projection, pathGenerator } = useMemo(() => {
    let proj: d3Geo.GeoProjection

    if (region === 'usa') {
      proj = d3Geo.geoAlbersUsa().translate([width / 2, height / 2]).scale(1150)
    } else {
      proj = d3Geo.geoMercator().center([82.5, 22.0]).translate([width / 2, height / 2]).scale(1300)
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
    <div className="relative w-full rounded-2xl overflow-hidden border border-[#DCE4E9] bg-[#F5F7F8] shadow-sm select-none">
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-[620px] cursor-grab active:cursor-grabbing overflow-hidden"
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
            <clipPath id="country-boundary-clip">
              {countryPath ? <path d={countryPath} /> : <rect width={width} height={height} />}
            </clipPath>

            <pattern id="gis-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#DCE4E9" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7" />
            </pattern>
          </defs>

          <rect width={width} height={height} fill="#EAF0F3" />
          <rect width={width} height={height} fill="url(#gis-grid)" />

          <g clipPath="url(#country-boundary-clip)">
            <rect width={width} height={height} fill="#FFFFFF" />

            <image
              href="/assets/topo.png"
              x="0"
              y="0"
              width={width}
              height={height}
              preserveAspectRatio="xMidYMid slice"
              opacity="0.18"
              style={{ mixBlendMode: 'multiply' }}
            />

            <rect width={width} height={height} fill="url(#gis-grid)" opacity="0.5" />

            {riversData &&
              riversData.features.map((river: any, idx: number) => {
                const pathStr = pathGenerator(river)
                if (!pathStr) return null
                return (
                  <g key={`river-${idx}`}>
                    <path
                      d={pathStr}
                      fill="none"
                      stroke="#398DB5"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.85"
                    />
                    <path
                      d={pathStr}
                      fill="none"
                      stroke="#28A6A1"
                      strokeWidth="0.8"
                      strokeDasharray="4 2"
                      opacity="0.5"
                    />
                  </g>
                )
              })}
          </g>

          {countryPath && (
            <path
              d={countryPath}
              fill="none"
              stroke="#19364A"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.85"
            />
          )}

          {riversData &&
            riversData.features.map((river: any, idx: number) => {
              const coords = river.geometry?.coordinates
              if (!coords || coords.length === 0) return null
              const midIdx = Math.floor(coords.length / 2)
              const [rx, ry] = projection(coords[midIdx]) || [0, 0]
              if (rx === 0 && ry === 0) return null
              return (
                <text
                  key={`river-label-${idx}`}
                  x={rx + 6}
                  y={ry - 6}
                  fontSize="10"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="600"
                  fill="#19364A"
                  opacity="0.75"
                  className="select-none pointer-events-none"
                >
                  {river.properties?.name}
                </text>
              )
            })}

          {stations.map((stn) => {
            const coords = projection([stn.longitude, stn.latitude])
            if (!coords) return null
            const [cx, cy] = coords
            const isSelected = stn.station_id === selectedStationId
            const isExtreme = stn.isExtreme
            const pinColor = isExtreme ? '#C94C55' : isSelected ? '#28A6A1' : '#19364A'

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
                    stroke="#C94C55"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    className="animate-pulse"
                    opacity="0.85"
                  />
                )}

                {isSelected && (
                  <circle
                    r="12"
                    fill="none"
                    stroke="#28A6A1"
                    strokeWidth="2"
                    opacity="0.9"
                  />
                )}

                <circle
                  r="6.5"
                  fill={isExtreme ? '#FFE4E6' : '#FFFFFF'}
                  stroke={pinColor}
                  strokeWidth="2"
                />

                <line x1="-7" y1="0" x2="7" y2="0" stroke={pinColor} strokeWidth="1.5" strokeLinecap="round" />
                <line x1="0" y1="-7" x2="0" y2="7" stroke={pinColor} strokeWidth="1.5" strokeLinecap="round" />

                <g transform="translate(10, -10)">
                  <rect
                    x="0"
                    y="-13"
                    width={stn.station_name.length * 6.5 + 16}
                    height="18"
                    rx="4"
                    fill="#FFFFFF"
                    stroke="#DCE4E9"
                    strokeWidth="1"
                    className="shadow-sm"
                  />
                  <text
                    x="8"
                    y="0"
                    fontSize="9.5"
                    fontFamily="system-ui, sans-serif"
                    fontWeight="600"
                    fill={isExtreme ? '#C94C55' : '#19364A'}
                  >
                    {stn.station_name}
                  </text>
                </g>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 bg-white border border-[#DCE4E9] p-1.5 rounded-xl shadow-sm">
        <button
          onClick={() => setZoomLevel((z) => Math.min(z + 0.3, 3))}
          className="p-1.5 rounded-lg hover:bg-[#EAF0F3] text-[#19364A] transition"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoomLevel((z) => Math.max(z - 0.3, 0.7))}
          className="p-1.5 rounded-lg hover:bg-[#EAF0F3] text-[#19364A] transition"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 rounded-lg hover:bg-[#EAF0F3] text-[#19364A] transition"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute top-4 right-4 z-10 bg-white border border-[#DCE4E9] p-3.5 rounded-xl text-xs space-y-2 text-[#19364A] shadow-sm max-w-xs">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[#647786] font-bold border-b border-[#DCE4E9] pb-1.5 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#28A6A1]" />
          <span>Geographic Legend</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 bg-[#398DB5] rounded" />
          <span className="text-[#647786] text-[11px]">Major River Drainage Network</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#19364A] text-base leading-none">+</span>
          <span className="text-[#647786] text-[11px]">River Monitoring Station</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#C94C55] text-base leading-none flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-[#C94C55]" />
          </span>
          <span className="text-[#C94C55] font-semibold text-[11px]">Top 10% Extreme Discharge</span>
        </div>
      </div>

      <div className="p-3 bg-white border-t border-[#DCE4E9] flex items-center justify-between text-xs text-[#647786] px-5">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-[#D97745] shrink-0" />
          <span>Geographic river paths and station points mapped from catchment hydrological registers.</span>
        </div>
        <div className="hidden sm:block text-[11px] font-mono text-[#647786]">
          Scale 1:6,500,000 &middot; Projection: {region === 'usa' ? 'Albers Conic Equal-Area' : 'Survey Mercator'}
        </div>
      </div>
    </div>
  )
}
