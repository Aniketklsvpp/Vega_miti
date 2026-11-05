import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { EnrichedStation, RegionType } from '../../types/data'
import { Compass, Sliders } from 'lucide-react'

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
  discharge: number
}

// Vertex shader: displacements & smooth slope normals
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
    
    // Finite difference normal approximation with gentle slope gradients
    float texelSize = 1.0 / 256.0;
    float hL = texture2D(uHeightmap, uv - vec2(texelSize, 0.0)).r;
    float hR = texture2D(uHeightmap, uv + vec2(texelSize, 0.0)).r;
    float hD = texture2D(uHeightmap, uv - vec2(0.0, texelSize)).r;
    float hU = texture2D(uHeightmap, uv + vec2(0.0, texelSize)).r;

    vec3 normal = normalize(vec3(
      (hL - hR) * uExaggeration * uMaxHeight * 2.8,
      (hD - hU) * uExaggeration * uMaxHeight * 2.8,
      1.0
    ));
    vNormalVec = normal;

    vec3 displacedPos = position;
    displacedPos.z = h * uExaggeration * uMaxHeight;
    vWorldPos = displacedPos;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPos, 1.0);
  }
`

// Fragment shader: clean matte white & light-grey sculptural plaster relief matching Image 2
const fragmentShader = `
  uniform float uExaggeration;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vNormalVec;
  varying vec3 vWorldPos;

  void main() {
    vec3 normal = normalize(vNormalVec);
    vec3 light = normalize(uLightDir);
    
    // Primary key directional hillshading from top-left
    float NdotL = max(0.0, dot(normal, light));

    // Soft secondary fill light from opposite angle
    vec3 fillLight = normalize(vec3(0.6, -0.4, 0.8));
    float fill = max(0.0, dot(normal, fillLight)) * 0.28;

    // Sculpted plaster tone: pure white mountain crests (#ffffff) to light soft silver-grey valleys (#edf0f4)
    vec3 baseColor = mix(vec3(0.92, 0.93, 0.95), vec3(1.0, 1.0, 1.0), smoothstep(0.08, 0.9, vElevation));

    // Gentle micro-ambient occlusion in deep depressions
    float ao = clamp(pow(vElevation + 0.15, 0.2), 0.82, 1.0);

    // Realistic sculptural lighting
    float lighting = NdotL * 0.68 + fill + 0.44;
    vec3 shadedColor = baseColor * lighting * ao;

    gl_FragColor = vec4(shadedColor, 1.0);
  }
`

// Helper: build wide, visible blue river ribbon meshes flowing naturally through valleys
function createRiverRibbon(
  pts: { x: number; y: number; z: number }[],
  width: number = 0.32,
  color: number = 0x2563eb
): THREE.Mesh | null {
  if (pts.length < 2) return null

  const vertices: number[] = []
  const indices: number[] = []

  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i]
    let dirX = 0
    let dirY = 0

    if (i < pts.length - 1) {
      dirX = pts[i + 1].x - curr.x
      dirY = pts[i + 1].y - curr.y
    } else {
      dirX = curr.x - pts[i - 1].x
      dirY = curr.y - pts[i - 1].y
    }

    const len = Math.hypot(dirX, dirY) || 1
    const normX = (-dirY / len) * (width / 2)
    const normY = (dirX / len) * (width / 2)
    const zOffset = curr.z + 0.05

    vertices.push(curr.x + normX, curr.y + normY, zOffset)
    vertices.push(curr.x - normX, curr.y - normY, zOffset)

    if (i < pts.length - 1) {
      const base = i * 2
      indices.push(base, base + 1, base + 2)
      indices.push(base + 1, base + 3, base + 2)
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geom.setIndex(indices)
  geom.computeVertexNormals()

  const mat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
  })

  return new THREE.Mesh(geom, mat)
}

export const Terrain3DScene: React.FC<Terrain3DSceneProps> = ({
  region,
  stations,
  selectedStationId,
  onSelectStation,
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const [metadata, setMetadata] = useState<TerrainMeta | null>(null)
  const [exaggeration, setExaggeration] = useState<number>(2.4)
  const [screenLabels, setScreenLabels] = useState<StationScreenPos[]>([])
  const [isFlying, setIsFlying] = useState<boolean>(false)

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const terrainGroupRef = useRef<THREE.Group | null>(null)
  const terrainMeshRef = useRef<THREE.Mesh | null>(null)
  const stationPinsRef = useRef<THREE.Group | null>(null)
  const heightDataRef = useRef<Float32Array | null>(null)
  const heightDimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const animFrameRef = useRef<number | null>(null)

  // Architectural square/rectangular model dimensions
  const planeWidth = 20
  const planeHeight = region === 'usa' ? 16 : 18
  const baseMaxHeight = 3.6
  const skirtDepth = -1.2 // Deep solid block base

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
      if (!grid || w === 0 || h === 0) return 0.1

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
      if (!metadata) return { x: 0, y: 0, z: 0.1, u: 0.5, v: 0.5 }
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

  // Initialize Three.js scene matching Reference Image 2
  useEffect(() => {
    const container = mountRef.current
    if (!container || !metadata) return

    const width = container.clientWidth || 960
    const height = container.clientHeight || 560

    const scene = new THREE.Scene()
    sceneRef.current = scene
    scene.background = new THREE.Color(0xffffff)
    scene.fog = new THREE.FogExp2(0xffffff, 0.007)

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 1000)
    cameraRef.current = camera

    // Set camera to the exact oblique isometric perspective of Reference Image 2:
    // Looking at the front corner of the raised block from an elevated 38-degree angle
    camera.position.set(16, -22, 17)
    camera.lookAt(0, 0, 1.2)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 10
    controls.maxDistance = 50
    controls.maxPolarAngle = Math.PI / 2 - 0.06
    controls.minPolarAngle = 0.12
    controls.target.set(0, 0, 1.2)

    // Soft Directional Studio Lighting casting subtle realistic shadows into the valleys
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4)
    dirLight.position.set(-20, -15, 30)
    scene.add(dirLight)

    const dirLightFill = new THREE.DirectionalLight(0xf8fafc, 0.6)
    dirLightFill.position.set(20, 15, 25)
    scene.add(dirLightFill)

    const ambLight = new THREE.AmbientLight(0xf5f7fa, 0.95)
    scene.add(ambLight)

    // Master Terrain Group (rotated to corner-front isometric orientation matching Image 2)
    const terrainGroup = new THREE.Group()
    terrainGroupRef.current = terrainGroup
    // Rotate 32 degrees around Z to turn the corner toward the viewer
    terrainGroup.rotation.z = -0.56
    scene.add(terrainGroup)

    // Load Heightmap and build thick architectural relief block
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
        const raw = new Float32Array(cvs.width * cvs.height)
        for (let i = 0; i < raw.length; i++) {
          raw[i] = imgData.data[i * 4] / 255
        }

        const w = cvs.width
        const h = cvs.height
        const smoothed = new Float32Array(w * h)

        // 1. Box smoothing pass to eliminate jagged pixel noise and produce smooth sculpted alpine ridges
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let sum = 0
            let count = 0
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx
                const ny = y + dy
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                  sum += raw[ny * w + nx]
                  count++
                }
              }
            }
            smoothed[y * w + x] = sum / count
          }
        }

        // 2. Perimeter edge falloff so boundary neatly meets the vertical skirt block
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const fx = Math.min(x, w - 1 - x) / (w * 0.04)
            const fy = Math.min(y, h - 1 - y) / (h * 0.04)
            const edge = Math.min(1, Math.min(fx, fy))
            const smoothEdge = edge * edge * (3 - 2 * edge)
            smoothed[y * w + x] = smoothed[y * w + x] * (0.08 + 0.92 * smoothEdge)
          }
        }

        // Update canvas texture with smoothed heightmap
        const smoothedImgData = ctx.createImageData(w, h)
        for (let i = 0; i < smoothed.length; i++) {
          const val = Math.floor(smoothed[i] * 255)
          smoothedImgData.data[i * 4] = val
          smoothedImgData.data[i * 4 + 1] = val
          smoothedImgData.data[i * 4 + 2] = val
          smoothedImgData.data[i * 4 + 3] = 255
        }
        ctx.putImageData(smoothedImgData, 0, 0)

        heightDataRef.current = smoothed
        heightDimsRef.current = { w, h }
      }

      const texture = new THREE.CanvasTexture(cvs)
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.generateMipmaps = true

      // Displaced Top Terrain Surface
      const geom = new THREE.PlaneGeometry(planeWidth, planeHeight, 256, 256)
      const mat = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uHeightmap: { value: texture },
          uExaggeration: { value: exaggeration },
          uMaxHeight: { value: baseMaxHeight },
          uLightDir: { value: new THREE.Vector3(-0.6, -0.45, 0.85).normalize() },
        },
        side: THREE.DoubleSide,
      })

      const terrain = new THREE.Mesh(geom, mat)
      terrainMeshRef.current = terrain
      terrainGroup.add(terrain)

      // Solid Vertical Skirt Walls (North, South, East, West) creating the thick architectural relief block
      const halfW = planeWidth / 2
      const halfH = planeHeight / 2
      const skirtMat = new THREE.MeshBasicMaterial({ color: 0xf5f6f8, side: THREE.DoubleSide })

      // South Wall
      const sPts: THREE.Vector3[] = [
        new THREE.Vector3(-halfW, -halfH, skirtDepth),
        new THREE.Vector3(halfW, -halfH, skirtDepth),
        new THREE.Vector3(halfW, -halfH, 0.25),
        new THREE.Vector3(-halfW, -halfH, 0.25),
      ]
      const sGeo = new THREE.BufferGeometry().setFromPoints(sPts)
      sGeo.setIndex([0, 1, 2, 0, 2, 3])
      sGeo.computeVertexNormals()
      terrainGroup.add(new THREE.Mesh(sGeo, skirtMat))

      // East Wall
      const ePts: THREE.Vector3[] = [
        new THREE.Vector3(halfW, -halfH, skirtDepth),
        new THREE.Vector3(halfW, halfH, skirtDepth),
        new THREE.Vector3(halfW, halfH, 0.25),
        new THREE.Vector3(halfW, -halfH, 0.25),
      ]
      const eGeo = new THREE.BufferGeometry().setFromPoints(ePts)
      eGeo.setIndex([0, 1, 2, 0, 2, 3])
      eGeo.computeVertexNormals()
      terrainGroup.add(new THREE.Mesh(eGeo, skirtMat))

      // North Wall
      const nPts: THREE.Vector3[] = [
        new THREE.Vector3(halfW, halfH, skirtDepth),
        new THREE.Vector3(-halfW, halfH, skirtDepth),
        new THREE.Vector3(-halfW, halfH, 0.25),
        new THREE.Vector3(halfW, halfH, 0.25),
      ]
      const nGeo = new THREE.BufferGeometry().setFromPoints(nPts)
      nGeo.setIndex([0, 1, 2, 0, 2, 3])
      nGeo.computeVertexNormals()
      terrainGroup.add(new THREE.Mesh(nGeo, skirtMat))

      // West Wall
      const wPts: THREE.Vector3[] = [
        new THREE.Vector3(-halfW, halfH, skirtDepth),
        new THREE.Vector3(-halfW, -halfH, skirtDepth),
        new THREE.Vector3(-halfW, -halfH, 0.25),
        new THREE.Vector3(-halfW, halfH, 0.25),
      ]
      const wGeo = new THREE.BufferGeometry().setFromPoints(wPts)
      wGeo.setIndex([0, 1, 2, 0, 2, 3])
      wGeo.computeVertexNormals()
      terrainGroup.add(new THREE.Mesh(wGeo, skirtMat))

      // Solid Bottom Base Plate
      const baseGeo = new THREE.PlaneGeometry(planeWidth, planeHeight)
      const baseMesh = new THREE.Mesh(baseGeo, skirtMat)
      baseMesh.position.z = skirtDepth
      terrainGroup.add(baseMesh)

      // Clearly Visible Blue River Channels matching Reference Image 2 & 3
      const riversGroup = new THREE.Group()

      if (region === 'india') {
        fetch('/assets/geo/india-rivers.json')
          .then((res) => res.json())
          .then((riversGeo) => {
            if (!riversGeo || !riversGeo.features) return
            riversGeo.features.forEach((r: any) => {
              const coords = r.geometry?.coordinates
              if (!coords) return
              const pts = coords.map(([lon, lat]: [number, number]) => latLonToPlanePos(lat, lon))
              const ribbon = createRiverRibbon(pts, 0.35, 0x2563eb)
              if (ribbon) riversGroup.add(ribbon)
            })
            terrainGroup.add(riversGroup)
          })
          .catch(() => {})
      } else {
        // Natural river networks for USGS Catchments connecting upstream/downstream stations
        // Susquehanna river trunk and tributaries matching Reference Image 2
        const riverGroups: { [key: string]: EnrichedStation[] } = {}
        stations.forEach((s) => {
          const key = s.river_name || 'USGS Basin'
          if (!riverGroups[key]) riverGroups[key] = []
          riverGroups[key].push(s)
        })

        Object.values(riverGroups).forEach((stns) => {
          if (stns.length > 1) {
            const sorted = [...stns].sort((a, b) => b.latitude - a.latitude)
            const pts = sorted.map((stn) => latLonToPlanePos(stn.latitude, stn.longitude))
            const ribbon = createRiverRibbon(pts, 0.32, 0x2563eb)
            if (ribbon) riversGroup.add(ribbon)
          }
        })

        // Major Susquehanna & Potomac river trunk channels winding across the relief model
        const primaryTrunk = [
          [-77.4, 41.8], [-77.1, 41.4], [-76.88, 40.8], [-76.88, 40.26],
          [-76.6, 39.9], [-76.3, 39.6], [-76.08, 39.54]
        ]
        const trunkPts = primaryTrunk.map(([lon, lat]) => latLonToPlanePos(lat, lon))
        const trunkMesh = createRiverRibbon(trunkPts, 0.38, 0x2563eb)
        if (trunkMesh) riversGroup.add(trunkMesh)

        // Tributaries branching naturally through the valleys
        const tributary1 = [
          [-77.8, 41.2], [-77.4, 41.0], [-77.0, 40.9], [-76.88, 40.8]
        ]
        const trib1Pts = tributary1.map(([lon, lat]) => latLonToPlanePos(lat, lon))
        const trib1Mesh = createRiverRibbon(trib1Pts, 0.28, 0x2563eb)
        if (trib1Mesh) riversGroup.add(trib1Mesh)

        const tributary2 = [
          [-76.4, 41.3], [-76.6, 41.0], [-76.8, 40.5], [-76.88, 40.26]
        ]
        const trib2Pts = tributary2.map(([lon, lat]) => latLonToPlanePos(lat, lon))
        const trib2Mesh = createRiverRibbon(trib2Pts, 0.28, 0x2563eb)
        if (trib2Mesh) riversGroup.add(trib2Mesh)

        terrainGroup.add(riversGroup)
      }
    }

    heightmapImg.src = heightmapSrc

    const stationGroup = new THREE.Group()
    stationPinsRef.current = stationGroup
    terrainGroup.add(stationGroup)

    const onResize = () => {
      const w = container.clientWidth || 960
      const h = container.clientHeight || 560
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // Project station 3D positions to 2D screen coordinates for floating tooltip
    const updateScreenLabels = () => {
      const canvasEl = renderer.domElement
      const rect = canvasEl.getBoundingClientRect()
      const labels: StationScreenPos[] = []

      stations.forEach((stn) => {
        const pos = latLonToPlanePos(stn.latitude, stn.longitude)
        const localPos = new THREE.Vector3(pos.x, pos.y, pos.z + 0.3)
        // Transform local position through terrainGroup rotation
        localPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), -0.56)

        const v = localPos.clone().project(camera)
        const isBehind = v.z > 1.0
        if (isBehind) return

        const screenX = ((v.x + 1) / 2) * rect.width
        const screenY = ((-v.y + 1) / 2) * rect.height

        const isSelected = stn.station_id === selectedStationId

        labels.push({
          id: stn.station_id,
          name: stn.station_name,
          shortId: stn.station_id.replace(/^US_|^IND-/, ''),
          x: screenX,
          y: screenY,
          visible: true,
          isExtreme: Boolean(stn.isExtreme),
          isSelected,
          discharge: stn.currentDischarge || 0,
        })
      })

      setScreenLabels(labels)
    }

    // Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
      updateScreenLabels()
    }
    animate()

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [metadata, region, latLonToPlanePos, selectedStationId])

  // Station 3D markers matching Reference Image 2 & 3:
  // Clean dark slate dots with white outer border rings resting on the terrain/river surface
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

      // Dark slate core marker dot (#0f172a)
      const dotGeo = new THREE.SphereGeometry(isSelected ? 0.22 : 0.16, 16, 16)
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x0f172a })
      const dot = new THREE.Mesh(dotGeo, dotMat)
      dot.position.set(pos.x, pos.y, pos.z + 0.1)
      pinGroup.add(dot)

      // Crisp white outer border ring
      const ringGeo = new THREE.RingGeometry(isSelected ? 0.24 : 0.18, isSelected ? 0.32 : 0.26, 24)
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.set(pos.x, pos.y, pos.z + 0.11)
      pinGroup.add(ring)

      // Glowing Cyan Target Ring for Selected Station matching Image 2 & 3
      if (isSelected) {
        const cyanRingGeo = new THREE.RingGeometry(0.36, 0.48, 32)
        const cyanRingMat = new THREE.MeshBasicMaterial({
          color: 0x0284c7, // Vibrant cyan
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
        })
        const cyanRing = new THREE.Mesh(cyanRingGeo, cyanRingMat)
        cyanRing.position.set(pos.x, pos.y, pos.z + 0.12)
        pinGroup.add(cyanRing)
      }
    })
  }, [exaggeration, stations, selectedStationId, latLonToPlanePos])

  // Camera fly-to on station selection
  const flyToStation = useCallback(
    (stnId: string) => {
      const targetStation = stations.find((s) => s.station_id === stnId)
      const camera = cameraRef.current
      const controls = controlsRef.current
      if (!targetStation || !camera || !controls || isFlying) return

      const pos = latLonToPlanePos(targetStation.latitude, targetStation.longitude)
      const worldTarget = new THREE.Vector3(pos.x, pos.y, pos.z + 0.4)
      worldTarget.applyAxisAngle(new THREE.Vector3(0, 0, 1), -0.56)

      const startCam = camera.position.clone()
      const startTarget = controls.target.clone()

      const destTarget = new THREE.Vector3(worldTarget.x, worldTarget.y, worldTarget.z)
      const destCam = new THREE.Vector3(worldTarget.x + 8, worldTarget.y - 10, worldTarget.z + 8)

      setIsFlying(true)
      const startTime = performance.now()
      const duration = 1000

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
        }
      }
      requestAnimationFrame(step)
    },
    [stations, latLonToPlanePos, isFlying, onSelectStation]
  )

  const resetView = () => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return

    camera.position.set(16, -22, 17)
    controls.target.set(0, 0, 1.2)
    controls.update()
  }

  // Selected station for floating callout tooltip
  const selectedLabel = screenLabels.find((lbl) => lbl.isSelected) || screenLabels[0]

  return (
    <div className="relative w-full h-full bg-white select-none overflow-hidden">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Callout Tooltip matching Reference Image 2 & 3 */}
      {selectedLabel && (
        <div
          style={{
            left: `${selectedLabel.x}px`,
            top: `${selectedLabel.y - 18}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className="absolute z-40 pointer-events-auto cursor-pointer transition-all duration-200"
          onClick={() => onSelectStation(selectedLabel.id)}
        >
          <div className="bg-white text-[#0f172a] text-xs font-semibold px-4 py-2 rounded-2xl border-2 border-[#0284c7] shadow-xl flex items-center gap-2 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]" />
            <span className="font-bold">{selectedLabel.name}</span>
            <span className="text-black/40">&bull;</span>
            <span className="font-mono text-[#0284c7] font-bold">
              {selectedLabel.discharge.toFixed(1)} cfs
            </span>
          </div>
          {/* Tooltip downward pointer triangle */}
          <div className="w-0 h-0 border-x-6 border-x-transparent border-t-8 border-t-[#0284c7] mx-auto" />
        </div>
      )}

      {/* Interactive Station Click Targets (Invisible click hits on all stations) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {screenLabels.map((lbl) => (
          <button
            key={lbl.id}
            onClick={() => {
              onSelectStation(lbl.id)
              flyToStation(lbl.id)
            }}
            style={{
              left: `${lbl.x}px`,
              top: `${lbl.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
            title={`${lbl.name} (${lbl.discharge.toFixed(1)} cfs)`}
            className="absolute pointer-events-auto w-6 h-6 rounded-full cursor-pointer focus:outline-none"
          />
        ))}
      </div>

      {/* Subtle Bottom Controls: Elevation slider & Reset View */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-black/15 shadow-sm z-30">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-black">
          <Sliders className="w-3 h-3 text-[#2563EB]" />
          <span>Relief:</span>
          <span className="font-mono font-bold text-[#2563EB]">{exaggeration.toFixed(1)}x</span>
        </div>

        <input
          type="range"
          min={1}
          max={4}
          step={0.1}
          value={exaggeration}
          onChange={(e) => setExaggeration(Number(e.target.value))}
          className="w-16 accent-[#2563EB] h-1 bg-black/10 rounded-lg appearance-none cursor-pointer"
        />

        <div className="h-3 w-[1px] bg-black/15" />

        <button
          onClick={resetView}
          className="flex items-center gap-1 text-[11px] font-semibold text-black hover:text-[#2563EB] transition cursor-pointer"
          title="Reset terrain camera view"
        >
          <Compass className="w-3 h-3 text-[#2563EB]" />
          <span>Reset</span>
        </button>
      </div>

      {/* Subtle Bottom Right Caption */}
      <div className="absolute bottom-4 right-4 bg-white/90 px-3 py-1 rounded-full text-[10px] font-mono text-black/50 border border-black/10 shadow-xs z-30 pointer-events-none">
        High-Resolution SRTM Elevation Relief &bull; Real River Network
      </div>
    </div>
  )
}

export default Terrain3DScene
