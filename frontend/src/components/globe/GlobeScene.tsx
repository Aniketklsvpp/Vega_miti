import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import type { RegionType } from '../../types/data'
import { FastForward, Navigation, ZoomIn, ZoomOut } from 'lucide-react'

interface GlobeSceneProps {
  onSelectRegion: (region: RegionType) => void
  onSkipIntro: () => void
}

interface HoverInfo {
  name: string
  status: 'active' | 'prototype' | 'none'
  x: number
  y: number
}

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')))
  } catch {
    return false
  }
}

export const GlobeScene: React.FC<GlobeSceneProps> = ({ onSelectRegion, onSkipIntro }) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false)
  const [webGLSupported, setWebGLSupported] = useState<boolean>(true)

  const animFrameRef = useRef<number | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const globeGroupRef = useRef<THREE.Group | null>(null)
  const countriesRef = useRef<{ feature: any; lines: THREE.Line[] }[]>([])
  const interactiveTargetsRef = useRef<{ mesh: THREE.Mesh; region: RegionType; name: string }[]>([])

  const isDraggingRef = useRef<boolean>(false)
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const isDocumentVisibleRef = useRef<boolean>(true)

  const handleRegionClick = useCallback((region: RegionType) => {
    if (isTransitioning) return
    setIsTransitioning(true)

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      onSelectRegion(region)
      return
    }

    const globe = globeGroupRef.current
    const camera = cameraRef.current
    if (!globe || !camera) {
      onSelectRegion(region)
      return
    }

    const targetLat = region === 'india' ? 22.5 : 38.0
    const targetLon = region === 'india' ? 79.0 : -97.0

    const targetRotY = -((targetLon + 180) * (Math.PI / 180)) + Math.PI / 2
    const targetRotX = (targetLat * (Math.PI / 180)) * 0.35

    const startRotX = globe.rotation.x
    const startRotY = globe.rotation.y
    const startCamZ = camera.position.z
    const targetCamZ = 3.0
    const startTime = performance.now()
    const duration = 1900

    const animateTransition = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

      globe.rotation.x = startRotX + (targetRotX - startRotX) * ease
      globe.rotation.y = startRotY + (targetRotY - startRotY) * ease
      camera.position.z = startCamZ + (targetCamZ - startCamZ) * ease

      if (progress < 1) {
        requestAnimationFrame(animateTransition)
      } else {
        onSelectRegion(region)
      }
    }

    requestAnimationFrame(animateTransition)
  }, [isTransitioning, onSelectRegion])

  useEffect(() => {
    if (!checkWebGLSupport()) {
      setWebGLSupported(false)
      return
    }

    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000)
    camera.position.z = 5.8
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    rendererRef.current = renderer
    container.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xe8f0f8, 1.4)
    dirLight.position.set(5, 3, 5)
    scene.add(dirLight)

    const globeGroup = new THREE.Group()
    globeGroupRef.current = globeGroup
    scene.add(globeGroup)

    globeGroup.rotation.y = 1.1

    const sphereRadius = 2.05

    const oceanMat = new THREE.MeshPhongMaterial({
      color: 0x19364A,
      emissive: 0x0c1b26,
      specular: 0x28A6A1,
      shininess: 18,
    })
    const oceanSphere = new THREE.Mesh(new THREE.SphereGeometry(sphereRadius, 64, 64), oceanMat)
    globeGroup.add(oceanSphere)

    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x398DB5,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    })
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(sphereRadius * 1.035, 48, 48), atmosphereMat)
    globeGroup.add(atmosphere)

    interactiveTargetsRef.current = []
    countriesRef.current = []

    const createRegionPin = (lat: number, lon: number, region: RegionType, name: string, color: number) => {
      const pos = latLonToVector3(lat, lon, sphereRadius * 1.01)
      const pinMat = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.10, 0.18, 32), pinMat)
      ring.position.copy(pos)
      ring.lookAt(new THREE.Vector3(0, 0, 0))

      const core = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), pinMat)
      core.position.copy(pos)
      core.lookAt(new THREE.Vector3(0, 0, 0))

      globeGroup.add(ring)
      globeGroup.add(core)
      interactiveTargetsRef.current.push({ mesh: ring, region, name })
    }

    createRegionPin(22.5, 79.0, 'india', 'India (Selected Catchment Region)', 0x28A6A1)
    createRegionPin(38.0, -97.0, 'usa', 'United States (USGS Demo Network)', 0x398DB5)

    fetch('/assets/geo/world-countries.json')
      .then((res) => res.json())
      .then((data) => {
        if (!data || !data.features) return

        data.features.forEach((feature: any) => {
          const geom = feature.geometry
          if (!geom) return
          const isIndia = feature.properties?.name === 'India' || feature.id === '356'
          const isUsa = feature.properties?.name === 'United States' || feature.id === '840'

          const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
          const featureLines: THREE.Line[] = []

          polys.forEach((ringGroup: any) => {
            ringGroup.forEach((ring: any) => {
              const points: THREE.Vector3[] = []
              ring.forEach(([lon, lat]: [number, number]) => {
                points.push(latLonToVector3(lat, lon, sphereRadius * 1.004))
              })
              const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
              const lineMat = new THREE.LineBasicMaterial({
                color: isIndia ? 0x28A6A1 : isUsa ? 0x398DB5 : 0x7c9bb3,
                transparent: true,
                opacity: isIndia ? 0.95 : isUsa ? 0.85 : 0.45,
              })
              const line = new THREE.Line(lineGeo, lineMat)
              globeGroup.add(line)
              featureLines.push(line)
            })
          })

          countriesRef.current.push({ feature, lines: featureLines })
        })
      })
      .catch(() => {})

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onPointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const targets = interactiveTargetsRef.current.map((t) => t.mesh)
      const intersects = raycaster.intersectObjects(targets, true)

      if (intersects.length > 0) {
        const hit = interactiveTargetsRef.current.find(
          (t) => t.mesh === intersects[0].object || t.mesh.children.includes(intersects[0].object as any)
        )
        if (hit) {
          renderer.domElement.style.cursor = 'pointer'
          setHoverInfo({
            name: hit.name,
            status: hit.region === 'india' ? 'prototype' : 'active',
            x: e.clientX,
            y: e.clientY,
          })
          return
        }
      }

      const sphereIntersects = raycaster.intersectObject(oceanSphere)
      if (sphereIntersects.length > 0) {
        renderer.domElement.style.cursor = 'grab'
        setHoverInfo(null)
      } else {
        renderer.domElement.style.cursor = 'default'
        setHoverInfo(null)
      }
    }

    const onPointerDown = (e: MouseEvent) => {
      isDraggingRef.current = true
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY }
    }

    const onPointerUp = (e: MouseEvent) => {
      const deltaX = Math.abs(e.clientX - previousMousePositionRef.current.x)
      const deltaY = Math.abs(e.clientY - previousMousePositionRef.current.y)
      isDraggingRef.current = false

      if (deltaX < 5 && deltaY < 5) {
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const targets = interactiveTargetsRef.current.map((t) => t.mesh)
        const intersects = raycaster.intersectObjects(targets, true)

        if (intersects.length > 0) {
          const hit = interactiveTargetsRef.current.find(
            (t) => t.mesh === intersects[0].object || t.mesh.children.includes(intersects[0].object as any)
          )
          if (hit) {
            handleRegionClick(hit.region)
            return
          }
        }

        const sphereIntersects = raycaster.intersectObject(oceanSphere)
        if (sphereIntersects.length > 0) {
          setHoverInfo({
            name: 'Non-Gauged Catchment',
            status: 'none',
            x: e.clientX,
            y: e.clientY,
          })
        }
      }
    }

    const onDragMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !globeGroupRef.current) return
      const deltaX = e.clientX - previousMousePositionRef.current.x
      const deltaY = e.clientY - previousMousePositionRef.current.y

      globeGroupRef.current.rotation.y += deltaX * 0.005
      globeGroupRef.current.rotation.x += deltaY * 0.005
      globeGroupRef.current.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, globeGroupRef.current.rotation.x))

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!cameraRef.current) return
      cameraRef.current.position.z = Math.max(3.4, Math.min(7.5, cameraRef.current.position.z + e.deltaY * 0.003))
    }

    const dom = renderer.domElement
    dom.addEventListener('mousemove', onPointerMove)
    dom.addEventListener('mousedown', onPointerDown)
    window.addEventListener('mouseup', onPointerUp)
    window.addEventListener('mousemove', onDragMove)
    dom.addEventListener('wheel', onWheel, { passive: false })

    const handleVisibilityChange = () => {
      isDocumentVisibleRef.current = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const handleResize = () => {
      if (!container || !camera || !renderer) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate)
      if (!isDocumentVisibleRef.current) return
      if (!isDraggingRef.current && !isTransitioning && globeGroupRef.current) {
        globeGroupRef.current.rotation.y += 0.001
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      dom.removeEventListener('mousemove', onPointerMove)
      dom.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('mouseup', onPointerUp)
      window.removeEventListener('mousemove', onDragMove)
      dom.removeEventListener('wheel', onWheel)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      if (container.contains(dom)) container.removeChild(dom)
    }
  }, [handleRegionClick, isTransitioning])

  if (!webGLSupported) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <Navigation className="w-12 h-12 text-[#28A6A1]" />
        <h2 className="text-xl font-bold text-[#19364A]">Hardware Acceleration Unavailable</h2>
        <p className="text-xs text-[#647786] max-w-md">
          Proceeding directly to the geographic river monitoring map.
        </p>
        <button
          onClick={onSkipIntro}
          className="px-4 py-2 rounded-lg bg-[#28A6A1] text-white text-xs font-semibold shadow-xs"
        >
          Open River Map
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[580px] bg-[#F5F7F8] flex items-center justify-center overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full max-w-5xl" />

      <div className="absolute top-6 left-6 z-20 pointer-events-none space-y-2 max-w-sm">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#DCE4E9] text-[#19364A] font-mono text-xs font-semibold shadow-sm">
          <Navigation className="w-3.5 h-3.5 text-[#28A6A1]" />
          <span>Geospatial Earth Observation</span>
        </div>
        <h1 className="text-2xl font-bold text-[#19364A] tracking-tight">
          River Discharge Intelligence
        </h1>
        <p className="text-xs text-[#647786] leading-relaxed">
          Select an operational river catchment region to inspect geographic river monitoring networks, telemetry hydrographs, and validation models.
        </p>
      </div>

      <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
        <button
          onClick={onSkipIntro}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#EAF0F3] text-[#19364A] border border-[#DCE4E9] text-xs font-medium shadow-sm transition"
        >
          <FastForward className="w-4 h-4 text-[#28A6A1]" />
          <span>Skip to India Map</span>
        </button>
      </div>

      <div className="absolute bottom-6 left-6 z-20 bg-white/95 backdrop-blur border border-[#DCE4E9] p-4 rounded-xl text-xs space-y-2.5 max-w-xs text-[#19364A] shadow-lg">
        <div className="text-[11px] font-mono uppercase text-[#647786] font-bold tracking-wider border-b border-[#DCE4E9] pb-1.5">
          Catchment Exploration Regions
        </div>
        <div
          onClick={() => handleRegionClick('india')}
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
          onClick={() => handleRegionClick('usa')}
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
            if (cameraRef.current) cameraRef.current.position.z = Math.max(3.4, cameraRef.current.position.z - 0.5)
          }}
          className="p-1.5 hover:bg-[#EAF0F3] text-[#19364A] rounded transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            if (cameraRef.current) cameraRef.current.position.z = Math.min(7.5, cameraRef.current.position.z + 0.5)
          }}
          className="p-1.5 hover:bg-[#EAF0F3] text-[#19364A] rounded transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {hoverInfo && (
        <div
          className="fixed z-30 pointer-events-none transform -translate-x-1/2 -translate-y-12 bg-[#19364A] text-white text-xs px-3 py-1.5 rounded-lg shadow-xl backdrop-blur flex items-center gap-2"
          style={{ left: hoverInfo.x, top: hoverInfo.y }}
        >
          <span className="w-2 h-2 rounded-full bg-[#28A6A1]" />
          <span>{hoverInfo.name}</span>
        </div>
      )}

      {isTransitioning && (
        <div className="absolute inset-0 z-40 bg-white/50 backdrop-blur-[2px] pointer-events-none flex items-center justify-center transition-opacity duration-1000">
          <div className="px-4 py-2.5 rounded-xl bg-white border border-[#28A6A1] text-[#19364A] text-xs font-semibold flex items-center gap-2.5 shadow-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-[#28A6A1] animate-ping" />
            <span>Transitioning to India River Monitoring Map...</span>
          </div>
        </div>
      )}
    </div>
  )
}
