import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import type { RegionType } from '../../types/data'
import { FastForward, Globe2, Info, Navigation } from 'lucide-react'

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

    const targetLat = region === 'usa' ? 38 : 22
    const targetLon = region === 'usa' ? -97 : 78

    const targetRotY = -((targetLon + 180) * (Math.PI / 180)) + Math.PI / 2
    const targetRotX = (targetLat * (Math.PI / 180)) * 0.4

    const startRotX = globe.rotation.x
    const startRotY = globe.rotation.y
    const startCamZ = camera.position.z
    const targetCamZ = 3.2
    const startTime = performance.now()
    const duration = 1800

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

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000)
    camera.position.z = 6.2
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    rendererRef.current = renderer
    container.appendChild(renderer.domElement)

    const globeGroup = new THREE.Group()
    globeGroupRef.current = globeGroup
    scene.add(globeGroup)

    const sphereRadius = 2.0
    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 48, 48)
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x0c121e,
      wireframe: false,
    })
    const baseSphere = new THREE.Mesh(sphereGeo, sphereMat)
    globeGroup.add(baseSphere)

    const atmosphereGeo = new THREE.SphereGeometry(sphereRadius * 1.025, 32, 32)
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x1e3a5f,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    })
    const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat)
    globeGroup.add(atmosphere)

    interactiveTargetsRef.current = []

    const createRegionMarker = (lat: number, lon: number, region: RegionType, name: string, color: number) => {
      const pos = latLonToVector3(lat, lon, sphereRadius * 1.01)
      const markerGeo = new THREE.RingGeometry(0.12, 0.22, 24)
      const markerMat = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      })
      const marker = new THREE.Mesh(markerGeo, markerMat)
      marker.position.copy(pos)
      marker.lookAt(new THREE.Vector3(0, 0, 0))

      const pulseGeo = new THREE.RingGeometry(0.24, 0.28, 24)
      const pulseMat = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      })
      const pulse = new THREE.Mesh(pulseGeo, pulseMat)
      marker.add(pulse)

      globeGroup.add(marker)
      interactiveTargetsRef.current.push({ mesh: marker, region, name })
    }

    createRegionMarker(39.0, -98.0, 'usa', 'United States', 0x38bdf8)
    createRegionMarker(22.0, 79.0, 'india', 'India', 0x818cf8)

    fetch('/assets/geo/world-countries.json')
      .then((res) => res.json())
      .then((data) => {
        if (!data || !data.features) return
        data.features.forEach((feature: any) => {
          const geom = feature.geometry
          if (!geom) return
          const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
          polys.forEach((ringGroup: any) => {
            ringGroup.forEach((ring: any) => {
              const points: THREE.Vector3[] = []
              ring.forEach(([lon, lat]: [number, number]) => {
                points.push(latLonToVector3(lat, lon, sphereRadius * 1.005))
              })
              const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
              const lineMat = new THREE.LineBasicMaterial({
                color: feature.properties?.hasData ? 0x38bdf8 : 0x243247,
                transparent: true,
                opacity: feature.properties?.hasData ? 0.8 : 0.4,
              })
              const line = new THREE.Line(lineGeo, lineMat)
              globeGroup.add(line)
            })
          })
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
            status: hit.region === 'usa' ? 'active' : 'prototype',
            x: e.clientX,
            y: e.clientY,
          })
          return
        }
      }

      const sphereIntersects = raycaster.intersectObject(baseSphere)
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

        const sphereIntersects = raycaster.intersectObject(baseSphere)
        if (sphereIntersects.length > 0) {
          setHoverInfo({
            name: 'Unmonitored Region',
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
      cameraRef.current.position.z = Math.max(3.8, Math.min(8.5, cameraRef.current.position.z + e.deltaY * 0.003))
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
        globeGroupRef.current.rotation.y += 0.0012
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
        <Globe2 className="w-12 h-12 text-cyan-400" />
        <h2 className="text-xl font-bold font-mono text-slate-100">WebGL Acceleration Unavailable</h2>
        <p className="text-xs text-slate-400 max-w-md">
          Hardware 3D canvas is disabled in this environment. Proceeding directly to the cartographic survey sheet.
        </p>
        <button
          onClick={onSkipIntro}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold"
        >
          Open Survey Sheet
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[580px] bg-[#080c14] overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full" />

      <div className="absolute top-6 left-6 z-20 pointer-events-none space-y-2 max-w-sm">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-cyan-500/30 text-cyan-400 font-mono text-xs font-bold shadow-lg backdrop-blur">
          <Navigation className="w-3.5 h-3.5" />
          <span>Interactive Earth Telemetry</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-mono">
          RIVER DISCHARGE INTELLIGENCE
        </h1>
        <p className="text-xs text-slate-400 leading-relaxed font-sans">
          Click an active catchment region to enter the topographic survey sheet and inspect station discharge hydrographs.
        </p>
      </div>

      <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
        <button
          onClick={onSkipIntro}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-mono font-medium shadow-xl backdrop-blur transition"
          title="Directly enter survey map"
        >
          <FastForward className="w-4 h-4 text-cyan-400" />
          <span>Skip Intro</span>
        </button>
      </div>

      <div className="absolute bottom-6 left-6 z-20 bg-slate-950/85 backdrop-blur border border-slate-800/80 p-3.5 rounded-xl text-xs font-mono space-y-2 max-w-xs text-slate-300 shadow-2xl">
        <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider border-b border-slate-800 pb-1">
          Operational Catchment Regions
        </div>
        <div
          onClick={() => handleRegionClick('usa')}
          className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span className="font-semibold text-slate-200">United States</span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50 text-[10px]">
            REAL DATA
          </span>
        </div>
        <div
          onClick={() => handleRegionClick('india')}
          className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <span className="font-semibold text-slate-200">India Basins</span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 text-[10px]">
            PROTOTYPE
          </span>
        </div>
      </div>

      {hoverInfo && (
        <div
          className="fixed z-30 pointer-events-none transform -translate-x-1/2 -translate-y-12 bg-slate-900/95 border border-slate-700 text-slate-100 text-xs font-mono px-3 py-1.5 rounded-lg shadow-2xl backdrop-blur flex items-center gap-2"
          style={{ left: hoverInfo.x, top: hoverInfo.y }}
        >
          {hoverInfo.status === 'active' && (
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          )}
          {hoverInfo.status === 'prototype' && (
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          )}
          {hoverInfo.status === 'none' && (
            <Info className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>
            {hoverInfo.name}
            {hoverInfo.status === 'active' ? ' — Real Catchment Network' : hoverInfo.status === 'prototype' ? ' — Prototype Region' : ' — No stations here'}
          </span>
        </div>
      )}

      {isTransitioning && (
        <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-[1px] pointer-events-none flex items-center justify-center transition-opacity duration-1000">
          <div className="px-4 py-2 rounded-xl bg-slate-950/90 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold flex items-center gap-2 shadow-2xl">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Easing to Catchment Survey Sheet...</span>
          </div>
        </div>
      )}
    </div>
  )
}
