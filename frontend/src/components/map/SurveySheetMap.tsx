import React, { useEffect, useState, useRef, useMemo } from 'react'
import * as d3Geo from 'd3-geo'
import type { EnrichedStation, RegionType } from '../../types/data'
import { Flame, Layers, Minus, Plus, RotateCcw } from 'lucide-react'

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
    <div className="relative w-full rounded-2xl overflow-hidden border border-[#DDD1BF] bg-[#F3EBDD] shadow-sm select-none">
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
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#DDD1BF" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.8" />
            </pattern>
          </defs>

          <rect width={width} height={height} fill="#EAE1D2" />
          <rect width={width} height={height} fill="url(#gis-grid)" />

          <g clipPath="url(#country-boundary-clip)">
            <rect width={width} height={height} fill="#FAF6EE" />

            <image
              href="/assets/topo.png"
              x="0"
              y="0"
              width={width}
              height={height}
              preserveAspectRatio="xMidYMid slice"
              opacity="0.15"
              style={{ mixBlendMode: 'multiply' }}
            />

            <rect width={width} height={height} fill="url(#gis-grid)" opacity="0.4" />

            {riversData &&
              riversData.features.map((river: any, idx: number) => {
                const pathStr = pathGenerator(river)
                if (!pathStr) return null
                return (
                  <g key={`river-${idx}`}>
                    <path
                      d={pathStr}
                      fill="none"
                      stroke="#2F7F8F"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.85"
                    />
                    <path
                      d={pathStr}
                      fill="none"
                      stroke="#FAF6EE"
                      strokeWidth="0.8"
                      strokeDasharray="4 2"
                      opacity="0.6"
                    />
                  </g>
                )
              })}
          </g>

          {countryPath && (
            <path
              d={countryPath}
              fill="none"
              stroke="#1F2A33"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.9"
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
                  fill="#1F2A33"
                  opacity="0.8"
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
            const pinColor = isExtreme ? '#D8432B' : isSelected ? '#2F7F8F' : '#1F2A33'

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
                    stroke="#D8432B"
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
                    stroke="#2F7F8F"
                    strokeWidth="2"
                    opacity="0.9"
                  />
                )}

                <circle
                  r="6.5"
                  fill={isExtreme ? '#FBECE9' : '#FAF6EE'}
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
                    fill="#FAF6EE"
                    stroke="#DDD1BF"
                    strokeWidth="1"
                    className="shadow-sm"
                  />
                  <text
                    x="8"
                    y="0"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="600"
                    fill="#1F2A33"
                  >
                    {stn.station_name}
                  </text>
                </g>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-[#FAF6EE]/90 backdrop-blur-xs p-1 rounded-xl border border-[#DDD1BF] shadow-xs">
        <button
          onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
          className="p-1.5 rounded-lg hover:bg-[#EAE1D2] text-[#1F2A33] transition cursor-pointer"
          title="Zoom in"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.75))}
          className="p-1.5 rounded-lg hover:bg-[#EAE1D2] text-[#1F2A33] transition cursor-pointer"
          title="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 rounded-lg hover:bg-[#EAE1D2] text-[#1F2A33] transition cursor-pointer"
          title="Reset view"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute top-4 right-4 bg-[#FAF6EE]/90 backdrop-blur-xs p-3 rounded-xl border border-[#DDD1BF] shadow-xs text-xs space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-[#1F2A33]">
          <Layers className="w-3.5 h-3.5 text-[#2F7F8F]" />
          <span>Cartographic Legend</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#526573]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1F2A33]"></span>
          <span>Nominal Discharge Station</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#526573]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2F7F8F]"></span>
          <span>Selected Active Station</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#D8432B]">
          <Flame className="w-3 h-3 text-[#D8432B]" />
          <span className="font-semibold">Extreme Flow Cutoff (P90)</span>
        </div>
        {region === 'india' && (
          <div className="flex items-center gap-2 text-[11px] text-[#2F7F8F]">
            <span className="w-3 h-0.5 bg-[#2F7F8F] inline-block"></span>
            <span>Surveyed River Reach</span>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 right-4 bg-[#FAF6EE]/80 backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] font-mono text-[#526573] border border-[#DDD1BF]">
        {region === 'india' ? 'EPSG:3857 &bull; SURVEY OF INDIA' : 'EPSG:5070 &bull; USGS HYDROLOGICAL SURVEY'}
      </div>
    </div>
  )
}
