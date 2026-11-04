import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as Cesium from 'cesium'
import type { RegionType } from '../../types/data'
import { FastForward, Navigation, ZoomIn, ZoomOut } from 'lucide-react'

interface CesiumGlobeProps {
  onSelectRegion: (region: RegionType) => void
  onSkipIntro: () => void
}

export const CesiumGlobe: React.FC<CesiumGlobeProps> = ({ onSelectRegion, onSkipIntro }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const [hoveredRegion, setHoveredRegion] = useState<{ name: string; x: number; y: number } | null>(null)
  const [isFlying, setIsFlying] = useState<boolean>(false)

  const triggerFlyTo = useCallback((region: RegionType) => {
    const viewer = viewerRef.current
    if (!viewer || isFlying) return
    setIsFlying(true)

    const destination =
      region === 'india'
        ? Cesium.Cartesian3.fromDegrees(79.0, 22.0, 1800000.0)
        : Cesium.Cartesian3.fromDegrees(-97.0, 38.0, 3200000.0)

    viewer.camera.flyTo({
      destination,
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-88.0),
        roll: 0.0,
      },
      duration: 2.2,
      complete: () => {
        onSelectRegion(region)
      },
    })
  }, [isFlying, onSelectRegion])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    (window as any).CESIUM_BASE_URL = '/cesium'

    const ionToken = (import.meta as any).env?.VITE_CESIUM_ION_TOKEN
    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken
    }

    let imageryProvider: Cesium.ImageryProvider
    try {
      imageryProvider = new (Cesium.TileMapServiceImageryProvider as any)({
        url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
      })
    } catch {
      imageryProvider = new Cesium.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      })
    }

    const viewer = new Cesium.Viewer(container, {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      timeline: false,
      animation: false,
      fullscreenButton: false,
      selectionIndicator: false,
      baseLayer: new Cesium.ImageryLayer(imageryProvider),
    })

    viewerRef.current = viewer

    viewer.scene.globe.enableLighting = true
    viewer.scene.globe.atmosphereBrightnessShift = 0.1
    viewer.scene.globe.atmosphereHueShift = 0.02
    viewer.scene.globe.depthTestAgainstTerrain = false

    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true
    }
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#F5F7F8')

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(60.0, 20.0, 18000000.0),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-89.0),
        roll: 0.0,
      },
    })

    const indiaEntity = viewer.entities.add({
      id: 'region-india',
      position: Cesium.Cartesian3.fromDegrees(79.0, 22.5, 50000.0),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#28A6A1'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: 'India Catchments (Selected)',
        font: 'bold 12px system-ui, sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#19364A'),
        showBackground: true,
        backgroundColor: Cesium.Color.WHITE.withAlpha(0.9),
        backgroundPadding: new Cesium.Cartesian2(7, 4),
        pixelOffset: new Cesium.Cartesian2(0, -22),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    const usaEntity = viewer.entities.add({
      id: 'region-usa',
      position: Cesium.Cartesian3.fromDegrees(-97.0, 38.0, 50000.0),
      point: {
        pixelSize: 12,
        color: Cesium.Color.fromCssColorString('#398DB5'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: 'USA Gauging Network',
        font: 'bold 12px system-ui, sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#19364A'),
        showBackground: true,
        backgroundColor: Cesium.Color.WHITE.withAlpha(0.9),
        backgroundPadding: new Cesium.Cartesian2(7, 4),
        pixelOffset: new Cesium.Cartesian2(0, -22),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    Cesium.GeoJsonDataSource.load('/assets/geo/india-pov.json', {
      stroke: Cesium.Color.fromCssColorString('#28A6A1'),
      fill: Cesium.Color.fromCssColorString('#28A6A1').withAlpha(0.12),
      strokeWidth: 3,
      clampToGround: true,
    })
      .then((ds) => {
        viewer.dataSources.add(ds)
      })
      .catch(() => {})

    Cesium.GeoJsonDataSource.load('/assets/geo/usa-boundary.json', {
      stroke: Cesium.Color.fromCssColorString('#398DB5'),
      fill: Cesium.Color.fromCssColorString('#398DB5').withAlpha(0.08),
      strokeWidth: 2,
      clampToGround: true,
    })
      .then((ds) => {
        viewer.dataSources.add(ds)
      })
      .catch(() => {})

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

    handler.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position)
      if (Cesium.defined(picked) && picked.id) {
        if (picked.id === indiaEntity || picked.id.id === 'region-india') {
          triggerFlyTo('india')
        } else if (picked.id === usaEntity || picked.id.id === 'region-usa') {
          triggerFlyTo('usa')
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    handler.setInputAction((movement: any) => {
      const picked = viewer.scene.pick(movement.endPosition)
      if (Cesium.defined(picked) && picked.id) {
        if (picked.id === indiaEntity || picked.id.id === 'region-india') {
          container.style.cursor = 'pointer'
          setHoveredRegion({ name: 'India River Basins (Selected Region)', x: movement.endPosition.x, y: movement.endPosition.y })
          return
        }
        if (picked.id === usaEntity || picked.id.id === 'region-usa') {
          container.style.cursor = 'pointer'
          setHoveredRegion({ name: 'United States Catchments', x: movement.endPosition.x, y: movement.endPosition.y })
          return
        }
      }
      container.style.cursor = 'default'
      setHoveredRegion(null)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    let spinHandler: Cesium.Event.RemoveCallback | null = null
    const spinRate = 0.0008
    spinHandler = viewer.clock.onTick.addEventListener(() => {
      if (!isFlying && !viewer.camera.getPickRay(new Cesium.Cartesian2(0, 0))) {
        viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, spinRate)
      }
    })

    return () => {
      if (spinHandler) spinHandler()
      handler.destroy()
      if (!viewer.isDestroyed()) {
        viewer.destroy()
      }
      viewerRef.current = null
    }
  }, [triggerFlyTo, isFlying])

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[580px] bg-[#F5F7F8] overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full" />

      <div className="absolute top-6 left-6 z-20 pointer-events-none space-y-2 max-w-sm">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#DCE4E9] text-[#19364A] font-mono text-xs font-semibold shadow-xs">
          <Navigation className="w-3.5 h-3.5 text-[#28A6A1]" />
          <span>Natural 3D Earth Observation</span>
        </div>
        <h1 className="text-2xl font-bold text-[#19364A] tracking-tight">
          River Discharge Intelligence
        </h1>
        <p className="text-xs text-[#647786] leading-relaxed">
          Realistic Natural Earth elevation globe. Click India or select a catchment region to begin orbital descent into the river monitoring network.
        </p>
      </div>

      <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
        <button
          onClick={onSkipIntro}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#EAF0F3] text-[#19364A] border border-[#DCE4E9] text-xs font-semibold shadow-xs transition"
        >
          <FastForward className="w-4 h-4 text-[#28A6A1]" />
          <span>Skip to India Map</span>
        </button>
      </div>

      <div className="absolute bottom-6 left-6 z-20 bg-white/95 backdrop-blur border border-[#DCE4E9] p-4 rounded-xl text-xs space-y-2.5 max-w-xs text-[#19364A] shadow-lg">
        <div className="text-[11px] font-mono uppercase text-[#647786] font-bold tracking-wider border-b border-[#DCE4E9] pb-1.5">
          Natural Catchment Regions
        </div>
        <div
          onClick={() => triggerFlyTo('india')}
          className="flex items-center justify-between p-2 rounded-lg bg-[#EAF0F3]/80 hover:bg-[#EAF0F3] border border-[#28A6A1]/40 cursor-pointer transition"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#28A6A1]" />
            <span className="font-semibold text-[#19364A]">India River Basins</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-white text-[#28A6A1] font-mono font-bold border border-[#DCE4E9] text-[10px]">
            PRIMARY
          </span>
        </div>
        <div
          onClick={() => triggerFlyTo('usa')}
          className="flex items-center justify-between p-2 rounded-lg hover:bg-[#EAF0F3] cursor-pointer transition border border-transparent"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#398DB5]" />
            <span className="font-medium text-[#19364A]">United States Catchments</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-[#EAF0F3] text-[#398DB5] font-mono text-[10px]">
            DEMO
          </span>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1.5 bg-white border border-[#DCE4E9] p-1.5 rounded-lg shadow-md">
        <button
          onClick={() => {
            const viewer = viewerRef.current
            if (viewer) viewer.camera.zoomIn(1000000.0)
          }}
          className="p-1.5 hover:bg-[#EAF0F3] text-[#19364A] rounded transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            const viewer = viewerRef.current
            if (viewer) viewer.camera.zoomOut(1000000.0)
          }}
          className="p-1.5 hover:bg-[#EAF0F3] text-[#19364A] rounded transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {hoveredRegion && (
        <div
          className="fixed z-30 pointer-events-none transform -translate-x-1/2 -translate-y-12 bg-[#19364A] text-white text-xs px-3 py-1.5 rounded-lg shadow-xl backdrop-blur flex items-center gap-2"
          style={{ left: hoveredRegion.x, top: hoveredRegion.y }}
        >
          <span className="w-2 h-2 rounded-full bg-[#28A6A1]" />
          <span>{hoveredRegion.name}</span>
        </div>
      )}

      {isFlying && (
        <div className="absolute inset-0 z-40 bg-white/40 backdrop-blur-[2px] pointer-events-none flex items-center justify-center transition-opacity duration-1000">
          <div className="px-5 py-3 rounded-xl bg-white border border-[#28A6A1] text-[#19364A] text-xs font-bold flex items-center gap-2.5 shadow-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-[#28A6A1] animate-ping" />
            <span>Camera flight to India river basin network...</span>
          </div>
        </div>
      )}
    </div>
  )
}
