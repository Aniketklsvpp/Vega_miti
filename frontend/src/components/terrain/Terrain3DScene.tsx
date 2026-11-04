import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { EnrichedStation, RegionType } from '../../types/data'
import {
  Compass,
  Flame,
  Layers,
  Sliders,
} from 'lucide-react'

interface Terrain3DSceneProps {
  region: RegionType
  stations: EnrichedStation[]
  selectedStationId: string | null
  onSelectStation: (id: string) => void
  onNavigateToStation?: (id: string) => void
}

interface TerrainMeta {
  source: string
  isProcedural: boolean
  bounds: {
    minLon: number
    maxLon: number
    minLat: number
    maxLat: number
  }
  elevation: {
    min: number
    max: number
  }
  width: number
  height: number
}

interface StationScreenPos {
  id: string
  name: string
  shortId: string
  x: number
  y: number
  visible: boolean
  isExtreme: boolean
  isSelected: boolean
  isHovered: boolean
  discharge: number
  percentile: number
  pinColor: string
}

const vertexShader = `
  uniform sampler2D uHeightmap;
  uniform float uExaggeration;
  uniform float uMaxHeight;
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vNormalVec;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    float h = texture2D(uHeightmap, uv).r;
    vElevation = h;
    
    // Finite difference normal approximation
    float texelSize = 1.0 / 512.0;
    float hL = texture2D(uHeightmap, uv - vec2(texelSize, 0.0)).r;
    float hR = texture2D(uHeightmap, uv + vec2(texelSize, 0.0)).r;
    float hD = texture2D(uHeightmap, uv - vec2(0.0, texelSize)).r;
    float hU = texture2D(uHeightmap, uv + vec2(0.0, texelSize)).r;

    vec3 normal = normalize(vec3(
      (hL - hR) * uExaggeration * uMaxHeight * 4.0,
      (hD - hU) * uExaggeration * uMaxHeight * 4.0,
      2.0
    ));
    vNormalVec = normal;

    vec3 displacedPos = position;
    displacedPos.z = h * uExaggeration * uMaxHeight;
    vWorldPos = displacedPos;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPos, 1.0);
  }
`

const fragmentShader = `
  uniform float uExaggeration;
  uniform vec3 uColorLow;
  uniform vec3 uColorMid;
  uniform vec3 uColorHigh;
  uniform vec3 uContourColor;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vNormalVec;
  varying vec3 vWorldPos;

  void main() {
    // 1. Hypsometric tinting in Cartographer palette
    vec3 terrainColor;
    if (vElevation < 0.35) {
      terrainColor = mix(uColorLow, uColorMid, vElevation / 0.35);
    } else {
      terrainColor = mix(uColorMid, uColorHigh, (vElevation - 0.35) / 0.65);
    }

    // 2. Hillshading calculation
    vec3 normal = normalize(vNormalVec);
    vec3 light = normalize(uLightDir);
    float NdotL = max(0.15, dot(normal, light));
    float ambient = 0.55;
    vec3 shadedColor = terrainColor * (NdotL * 0.7 + ambient);

    // 3. Crisp topographic contour lines
    float contourFreq = 38.0;
    float contourVal = abs(fract(vElevation * contourFreq - 0.5) - 0.5);
    float contourWidth = fwidth(vElevation * contourFreq) * 1.2;
    float contourFactor = smoothstep(0.0, max(0.04, contourWidth), contourVal);
    shadedColor = mix(uContourColor, shadedColor, 0.82 + 0.18 * contourFactor);

    // 4. Soft edge vignette fade to parchment
    float edgeDistX = min(vUv.x, 1.0 - vUv.x);
    float edgeDistY = min(vUv.y, 1.0 - vUv.y);
    float edgeDist = min(edgeDistX, edgeDistY);
    float edgeFade = smoothstep(0.0, 0.09, edgeDist);
    vec3 finalColor = mix(uColorLow, shadedColor, edgeFade);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

export const Terrain3DScene: React.FC<Terrain3DSceneProps> = ({
  region,
  stations,
  selectedStationId,
  onSelectStation,
  onNavigateToStation,
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const [metadata, setMetadata] = useState<TerrainMeta | null>(null)
  const [exaggeration, setExaggeration] = useState<number>(2.0)
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null)
  const [screenLabels, setScreenLabels] = useState<StationScreenPos[]>([])
  const [isFlying, setIsFlying] = useState<boolean>(false)

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const terrainMeshRef = useRef<THREE.Mesh | null>(null)
  const stationPinsRef = useRef<THREE.Group | null>(null)
  const heightDataRef = useRef<Float32Array | null>(null)
  const heightDimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const animFrameRef = useRef<number | null>(null)

  const planeWidth = 24
  const planeHeight = region === 'usa' ? 14 : 18
  const baseMaxHeight = 3.2

  useEffect(() => {
    fetch('/assets/terrain/metadata.json')
      .then((res) => res.json())
      .then((data) => {
        if (data && data[region]) {
          setMetadata(data[region])
        }
      })
      .catch(() => {
        setMetadata({
          source: 'Stylised terrain (procedural)',
          isProcedural: true,
          bounds:
            region === 'india'
              ? { minLon: 68, maxLon: 98, minLat: 6, maxLat: 37 }
              : { minLon: -125, maxLon: -66, minLat: 24, maxLat: 50 },
          elevation: { min: 0, max: 4000 },
          width: 1024,
          height: 1024,
        })
      })
  }, [region])

  const sampleHeight = useCallback(
    (u: number, v: number): number => {
      const grid = heightDataRef.current
      const { w, h } = heightDimsRef.current
      if (!grid || w === 0 || h === 0) return 0

      const clampedU = Math.max(0, Math.min(1, u))
      const clampedV = Math.max(0, Math.min(1, v))
      const px = Math.floor(clampedU * (w - 1))
      const py = Math.floor(clampedV * (h - 1))
      const idx = py * w + px
      const norm = grid[idx] || 0
      return norm * exaggeration * baseMaxHeight
    },
    [exaggeration]
  )

  const latLonToPlanePos = useCallback(
    (lat: number, lon: number): { x: number; y: number; z: number; u: number; v: number } => {
      if (!metadata) return { x: 0, y: 0, z: 0, u: 0.5, v: 0.5 }
      const { minLon, maxLon, minLat, maxLat } = metadata.bounds

      const u = (lon - minLon) / (maxLon - minLon)
      const v = (maxLat - lat) / (maxLat - minLat)

      const x = (u - 0.5) * planeWidth
      const y = (0.5 - v) * planeHeight
      const z = sampleHeight(u, v)

      return { x, y, z, u, v }
    },
    [metadata, planeWidth, planeHeight, sampleHeight]
  )

  useEffect(() => {
    const container = mountRef.current
    if (!container || !metadata) return

    const width = container.clientWidth || 960
    const height = 620

    const scene = new THREE.Scene()
    sceneRef.current = scene
    scene.background = new THREE.Color(0xf3ebdd)
    scene.fog = new THREE.FogExp2(0xf3ebdd, 0.015)

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000)
    cameraRef.current = camera

    const defaultCamDist = region === 'usa' ? 28 : 32
    camera.position.set(0, -defaultCamDist * 0.72, defaultCamDist * 0.75)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rendererRef.current = renderer
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 6
    controls.maxDistance = 55
    controls.maxPolarAngle = Math.PI / 2 - 0.04
    controls.minPolarAngle = 0.15
    controls.target.set(0, 0, 0)

    const heightmapImg = new Image()
    heightmapImg.crossOrigin = 'anonymous'
    const heightmapSrc = `/assets/terrain/${region}-heightmap.png`

    heightmapImg.onload = () => {
      const cvs = document.createElement('canvas')
      cvs.width = heightmapImg.width
      cvs.height = heightmapImg.height
      const ctx = cvs.getContext('2d')
      if (ctx) {
        ctx.drawImage(heightmapImg, 0, 0)
        const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height)
        const grid = new Float32Array(cvs.width * cvs.height)
        for (let i = 0; i < grid.length; i++) {
          grid[i] = imgData.data[i * 4] / 255
        }
        heightDataRef.current = grid
        heightDimsRef.current = { w: cvs.width, h: cvs.height }
      }

      const texture = new THREE.CanvasTexture(cvs)
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.generateMipmaps = true

      const geom = new THREE.PlaneGeometry(planeWidth, planeHeight, 256, 256)
      const mat = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uHeightmap: { value: texture },
          uExaggeration: { value: exaggeration },
          uMaxHeight: { value: baseMaxHeight },
          uColorLow: { value: new THREE.Color(0xf3ebdd) },
          uColorMid: { value: new THREE.Color(0xb8893b) },
          uColorHigh: { value: new THREE.Color(0x1f2a33) },
          uContourColor: { value: new THREE.Color(0x8c7960) },
          uLightDir: { value: new THREE.Vector3(-0.6, -0.4, 0.8).normalize() },
        },
        side: THREE.DoubleSide,
      })

      const terrain = new THREE.Mesh(geom, mat)
      terrainMeshRef.current = terrain
      scene.add(terrain)

      fetch('/assets/geo/world-countries.json')
        .then((res) => res.json())
        .then((geoJson) => {
          if (!geoJson || !geoJson.features) return
          const targetFeature = geoJson.features.find((f: any) =>
            region === 'india'
              ? f.id === '356' || f.properties?.name === 'India'
              : f.id === '840' || f.properties?.name === 'United States'
          )
          if (!targetFeature) return

          const polys =
            targetFeature.geometry.type === 'Polygon'
              ? [targetFeature.geometry.coordinates]
              : targetFeature.geometry.coordinates

          const lineGroup = new THREE.Group()
          polys.forEach((ringGroup: any) => {
            ringGroup.forEach((ring: any) => {
              const pts: THREE.Vector3[] = []
              ring.forEach(([lon, lat]: [number, number]) => {
                const pos = latLonToPlanePos(lat, lon)
                pts.push(new THREE.Vector3(pos.x, pos.y, pos.z + 0.05))
              })
              const lineGeo = new THREE.BufferGeometry().setFromPoints(pts)
              const lineMat = new THREE.LineBasicMaterial({
                color: 0x1f2a33,
                transparent: true,
                opacity: 0.7,
                linewidth: 2,
              })
              lineGroup.add(new THREE.Line(lineGeo, lineMat))
            })
          })
          scene.add(lineGroup)
        })
        .catch(() => {})

      if (region === 'india') {
        fetch('/assets/geo/india-rivers.json')
          .then((res) => res.json())
          .then((riversGeo) => {
            if (!riversGeo || !riversGeo.features) return
            const riverGroup = new THREE.Group()
            riversGeo.features.forEach((r: any) => {
              const coords = r.geometry?.coordinates
              if (!coords) return
              const pts: THREE.Vector3[] = []
              coords.forEach(([lon, lat]: [number, number]) => {
                const pos = latLonToPlanePos(lat, lon)
                pts.push(new THREE.Vector3(pos.x, pos.y, pos.z + 0.03))
              })
              const lineGeo = new THREE.BufferGeometry().setFromPoints(pts)
              const lineMat = new THREE.LineBasicMaterial({
                color: 0x2f7f8f,
                transparent: true,
                opacity: 0.85,
                linewidth: 2,
              })
              riverGroup.add(new THREE.Line(lineGeo, lineMat))
            })
            scene.add(riverGroup)
          })
          .catch(() => {})
      }
    }

    heightmapImg.src = heightmapSrc

    const stationGroup = new THREE.Group()
    stationPinsRef.current = stationGroup
    scene.add(stationGroup)

    const onResize = () => {
      const w = container.clientWidth || 960
      const h = 620
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    const updateScreenLabels = () => {
      const canvasEl = renderer.domElement
      const rect = canvasEl.getBoundingClientRect()
      const labels: StationScreenPos[] = []

      stations.forEach((stn) => {
        const pos = latLonToPlanePos(stn.latitude, stn.longitude)
        const worldPos = new THREE.Vector3(pos.x, pos.y, pos.z + 0.5)

        const v = worldPos.clone().project(camera)
        const isBehind = v.z > 1.0
        if (isBehind) return

        const screenX = ((v.x + 1) / 2) * rect.width
        const screenY = ((-v.y + 1) / 2) * rect.height

        const isHovered = stn.station_id === hoveredStationId
        const isSelected = stn.station_id === selectedStationId
        const pinColor = stn.isExtreme
          ? '#D8432B'
          : isSelected
            ? '#2F7F8F'
            : (stn.percentileRank || 0) > 75
              ? '#B8893B'
              : '#1F2A33'

        labels.push({
          id: stn.station_id,
          name: stn.station_name,
          shortId: stn.station_id.replace(/^US_|^IND-/, ''),
          x: screenX,
          y: screenY,
          visible: true,
          isExtreme: Boolean(stn.isExtreme),
          isSelected,
          isHovered,
          discharge: stn.currentDischarge || 0,
          percentile: stn.percentileRank || 50,
          pinColor,
        })
      })

      // Collision avoidance: prioritize hovered/selected/extreme, then sort
      labels.sort((a, b) => {
        const priorityA = (a.isHovered ? 100 : 0) + (a.isSelected ? 50 : 0) + (a.isExtreme ? 30 : 0)
        const priorityB = (b.isHovered ? 100 : 0) + (b.isSelected ? 50 : 0) + (b.isExtreme ? 30 : 0)
        return priorityB - priorityA
      })

      const placed: { x: number; y: number; w: number; h: number }[] = []
      labels.forEach((lbl) => {
        const labelWidth = lbl.isSelected || lbl.isHovered ? 130 : 54
        const labelHeight = 24
        let collides = false

        for (const p of placed) {
          const dx = Math.abs(lbl.x - p.x)
          const dy = Math.abs(lbl.y - p.y)
          if (dx < (labelWidth + p.w) * 0.45 && dy < (labelHeight + p.h) * 0.45) {
            collides = true
            break
          }
        }

        if (!collides || lbl.isSelected || lbl.isHovered) {
          placed.push({ x: lbl.x, y: lbl.y, w: labelWidth, h: labelHeight })
          lbl.visible = true
        } else {
          lbl.visible = false
        }
      })

      setScreenLabels(labels)
    }

    const animateLoop = () => {
      animFrameRef.current = requestAnimationFrame(animateLoop)
      controls.update()
      renderer.render(scene, camera)
      updateScreenLabels()
    }
    animateLoop()

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [metadata, region, latLonToPlanePos])

  // Update uniform and station 3D pins on exaggeration or selection change
  useEffect(() => {
    if (terrainMeshRef.current) {
      const mat = terrainMeshRef.current.material as THREE.ShaderMaterial
      if (mat.uniforms && mat.uniforms.uExaggeration) {
        mat.uniforms.uExaggeration.value = exaggeration
      }
    }

    const pinGroup = stationPinsRef.current
    if (!pinGroup) return

    pinGroup.clear()

    stations.forEach((stn) => {
      const pos = latLonToPlanePos(stn.latitude, stn.longitude)
      const isSelected = stn.station_id === selectedStationId
      const isExtreme = stn.isExtreme
      const pinColorHex = isExtreme ? 0xd8432b : isSelected ? 0x2f7f8f : 0x1f2a33

      const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8)
      const stemMat = new THREE.MeshBasicMaterial({ color: pinColorHex })
      const stem = new THREE.Mesh(stemGeo, stemMat)
      stem.rotation.x = Math.PI / 2
      stem.position.set(pos.x, pos.y, pos.z + 0.35)

      const headGeo = new THREE.SphereGeometry(isSelected ? 0.22 : 0.16, 16, 16)
      const headMat = new THREE.MeshBasicMaterial({ color: pinColorHex })
      const head = new THREE.Mesh(headGeo, headMat)
      head.position.set(pos.x, pos.y, pos.z + 0.7)

      const ringGeo = new THREE.RingGeometry(0.18, 0.26, 24)
      const ringMat = new THREE.MeshBasicMaterial({
        color: pinColorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.set(pos.x, pos.y, pos.z + 0.03)

      pinGroup.add(stem)
      pinGroup.add(head)
      pinGroup.add(ring)
    })
  }, [exaggeration, stations, selectedStationId, latLonToPlanePos])

  // Smooth camera fly-to on station selection
  const flyToStation = useCallback(
    (stnId: string) => {
      const targetStation = stations.find((s) => s.station_id === stnId)
      const camera = cameraRef.current
      const controls = controlsRef.current
      if (!targetStation || !camera || !controls || isFlying) return

      const pos = latLonToPlanePos(targetStation.latitude, targetStation.longitude)
      const startCam = camera.position.clone()
      const startTarget = controls.target.clone()

      const destTarget = new THREE.Vector3(pos.x, pos.y, pos.z)
      const destCam = new THREE.Vector3(pos.x, pos.y - 4.5, pos.z + 3.8)

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (prefersReducedMotion) {
        controls.target.copy(destTarget)
        camera.position.copy(destCam)
        controls.update()
        onSelectStation(stnId)
        return
      }

      setIsFlying(true)
      const startTime = performance.now()
      const duration = 1400

      const step = (now: number) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const ease =
          progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

        camera.position.lerpVectors(startCam, destCam, ease)
        controls.target.lerpVectors(startTarget, destTarget, ease)
        controls.update()

        if (progress < 1) {
          requestAnimationFrame(step)
        } else {
          setIsFlying(false)
          onSelectStation(stnId)
          if (onNavigateToStation) {
            setTimeout(() => onNavigateToStation(stnId), 200)
          }
        }
      }
      requestAnimationFrame(step)
    },
    [stations, latLonToPlanePos, isFlying, onSelectStation, onNavigateToStation]
  )

  const resetView = () => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return

    const defaultCamDist = region === 'usa' ? 28 : 32
    camera.position.set(0, -defaultCamDist * 0.72, defaultCamDist * 0.75)
    controls.target.set(0, 0, 0)
    controls.update()
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-[#DDD1BF] bg-[#F3EBDD] shadow-sm select-none">
      <div ref={mountRef} className="w-full h-[620px] cursor-grab active:cursor-grabbing" />

      {/* 3D Collision-Avoidance Station Screen Labels */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {screenLabels.map((lbl) => {
          if (!lbl.visible) return null
          const isExpanded = lbl.isHovered || lbl.isSelected

          return (
            <div
              key={lbl.id}
              style={{
                left: `${lbl.x}px`,
                top: `${lbl.y}px`,
                transform: 'translate(-50%, -130%)',
              }}
              className={`absolute pointer-events-auto transition-all duration-150 cursor-pointer ${
                isExpanded ? 'z-40' : 'z-20'
              }`}
              onMouseEnter={() => setHoveredStationId(lbl.id)}
              onMouseLeave={() => setHoveredStationId(null)}
              onClick={(e) => {
                e.stopPropagation()
                flyToStation(lbl.id)
              }}
            >
              <div
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-mono shadow-xs backdrop-blur-xs transition ${
                  lbl.isExtreme
                    ? 'bg-[#FBECE9] border-[#D8432B] text-[#D8432B] font-bold animate-pulse'
                    : lbl.isSelected
                      ? 'bg-[#E8F2F4] border-[#2F7F8F] text-[#2F7F8F] font-bold'
                      : 'bg-[#FAF6EE]/90 border-[#DDD1BF] text-[#1F2A33] hover:border-[#2F7F8F]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lbl.pinColor }} />
                <span>{isExpanded ? lbl.name : lbl.shortId}</span>
                {isExpanded && (
                  <span className="text-[10px] opacity-75 font-normal">
                    &bull; {lbl.discharge.toFixed(0)} cfs
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Floating Controls: Elevation Slider & Compass */}
      <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2 bg-[#FAF6EE]/95 backdrop-blur-md p-2 rounded-xl border border-[#DDD1BF] shadow-md z-30">
        <div className="flex items-center gap-2 px-2 text-xs font-semibold text-[#1F2A33]">
          <Sliders className="w-3.5 h-3.5 text-[#2F7F8F]" />
          <span>Elevation:</span>
          <span className="font-mono font-bold text-[#2F7F8F]">{exaggeration.toFixed(1)}x</span>
        </div>

        <input
          type="range"
          min={1}
          max={4}
          step={0.1}
          value={exaggeration}
          onChange={(e) => setExaggeration(Number(e.target.value))}
          className="w-24 accent-[#2F7F8F] h-1.5 bg-[#EAE1D2] rounded-lg appearance-none cursor-pointer"
        />

        <div className="h-4 w-[1px] bg-[#DDD1BF]" />

        <button
          onClick={resetView}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EAE1D2] hover:bg-[#DDD1BF] text-[#1F2A33] text-xs font-semibold transition cursor-pointer"
          title="Reset terrain camera view"
        >
          <Compass className="w-3.5 h-3.5 text-[#2F7F8F]" />
          <span>Reset View</span>
        </button>
      </div>

      {/* Fixed Responsive Cartographic Legend Card */}
      <div className="absolute top-4 right-4 max-w-[260px] bg-[#FAF6EE]/95 backdrop-blur-md p-3.5 rounded-xl border border-[#DDD1BF] shadow-md text-xs space-y-2 z-30">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#DDD1BF]">
          <div className="flex items-center gap-1.5 font-bold text-[#1F2A33]">
            <Layers className="w-3.5 h-3.5 text-[#2F7F8F]" />
            <span>3D Hypsometric Legend</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#526573] bg-[#EAE1D2] px-1.5 py-0.2 rounded">
            TOPO
          </span>
        </div>

        <div className="space-y-1.5 text-[11px] text-[#526573]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-xs bg-[#F3EBDD] border border-[#DDD1BF]" /> Lowland Plains
            </span>
            <span className="font-mono text-[10px]">0 &ndash; 800m</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-xs bg-[#B8893B]" /> Uplands & Plateaus
            </span>
            <span className="font-mono text-[10px]">800 &ndash; 2500m</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-xs bg-[#1F2A33]" /> Alpine Crests
            </span>
            <span className="font-mono text-[10px]">&gt; 2500m</span>
          </div>

          <div className="pt-1.5 border-t border-[#DDD1BF] space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1F2A33]" /> Nominal Gauge Pin
            </div>
            <div className="flex items-center gap-1.5 text-[#D8432B]">
              <Flame className="w-3 h-3 text-[#D8432B]" />
              <span className="font-semibold">Extreme Flow Cutoff (P90)</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#2F7F8F]">
              <span className="w-3 h-0.5 bg-[#2F7F8F] inline-block" /> Surveyed River Reach
            </div>
          </div>
        </div>
      </div>

      {/* Footnote */}
      <div className="absolute bottom-4 right-4 max-w-sm bg-[#FAF6EE]/85 backdrop-blur-xs px-3 py-1.5 rounded-lg text-[10px] font-mono text-[#526573] border border-[#DDD1BF] z-30">
        {metadata?.isProcedural
          ? 'Stylised terrain (procedural) &bull; Station positions from data'
          : 'Terrain: public elevation data (SRTM-derived). Station positions from the data.'}
      </div>
    </div>
  )
}

export default Terrain3DScene
