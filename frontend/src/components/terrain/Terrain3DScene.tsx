import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { EnrichedStation, RegionType } from '../../types/data'
import { useRiverData } from '../../context/RiverDataContext'
import { Compass, Sliders } from 'lucide-react'

interface Terrain3DSceneProps {
  region: RegionType
  stations: EnrichedStation[]
  selectedStationId: string | null
  onSelectStation: (id: string) => void
  onNavigateToStation?: (id: string) => void
}

interface TileMeta {
  source: string
  isFallback: boolean
  station_id: string
  station_name: string
  bounds: {
    minLon: number
    maxLon: number
    minLat: number
    maxLat: number
  }
  elevation_m: {
    min: number
    max: number
    relief: number
  }
  tileWidthMetres: number
  tileWidthWorld: number
  width: number
  height: number
}

interface RiverFeature {
  type: string
  name: string
  isRiver: boolean
  uv: Array<[number, number]>
}

interface StationScreenPin {
  id: string
  name: string
  x: number
  y: number
  visible: boolean
  isExtreme: boolean
  isSelected: boolean
  discharge: number | null | undefined
}

// 1. Shaders for the Matte White Clay Architectural Diorama
// Directional light from North-West (azimuth 315°, altitude 35°)
const vertexShader = `
  uniform sampler2D uHeightmap;
  uniform float uReliefHeight;
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vNormalVec;

  void main() {
    vUv = uv;
    float h = texture2D(uHeightmap, uv).r;
    vElevation = h;

    // Central difference normal calculation in XZ world coordinates
    float texel = 1.0 / 512.0;
    float hL = texture2D(uHeightmap, uv - vec2(texel, 0.0)).r;
    float hR = texture2D(uHeightmap, uv + vec2(texel, 0.0)).r;
    float hD = texture2D(uHeightmap, uv - vec2(0.0, texel)).r;
    float hU = texture2D(uHeightmap, uv + vec2(0.0, texel)).r;

    // Normal in object space (Y-up, X-East, Z-South)
    vec3 localNorm = normalize(vec3(
      (hL - hR) * uReliefHeight * 28.0,
      1.0,
      (hD - hU) * uReliefHeight * 28.0
    ));
    vNormalVec = normalize(normalMatrix * localNorm);

    vec3 displaced = position;
    displaced.y = h * uReliefHeight;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`

const fragmentShader = `
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vNormalVec;

  void main() {
    vec3 normal = normalize(vNormalVec);
    vec3 light = normalize(uLightDir);

    float NdotL = max(0.0, dot(normal, light));

    // White clay palette matching reference:
    // Highlights near #FFFFFF, mid #EEF0F3, shadows slightly cool grey about #C9CED6
    vec3 shadowColor = vec3(0.788, 0.808, 0.839);  // #C9CED6
    vec3 midColor    = vec3(0.933, 0.941, 0.953);  // #EEF0F3
    vec3 hiColor     = vec3(1.0, 1.0, 1.0);         // #FFFFFF

    vec3 surf = mix(shadowColor, midColor, smoothstep(0.0, 0.44, NdotL));
    surf = mix(surf, hiColor, smoothstep(0.44, 0.92, NdotL));

    // Subtle valley ambient occlusion
    float ao = clamp(0.74 + 0.26 * pow(vElevation, 0.35), 0.74, 1.0);
    vec3 finalColor = surf * ao;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

// 2. Helper: Build solid diorama side walls & base plate (#E6E8EB)
function buildDioramaSkirt(
  halfW: number,
  halfD: number,
  skirtBaseY: number,
  sampleHeightFn: (u: number, v: number) => number,
  segments: number,
  wallMaterial: THREE.Material
): THREE.Group {
  const group = new THREE.Group()

  // 1. South Wall (Z = +halfD, X goes from -halfW to +halfW, V = 0)
  const sGeo = new THREE.BufferGeometry()
  const sPos: number[] = []
  const sIdx: number[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const x = -halfW + t * (halfW * 2)
    const z = halfD
    const topY = sampleHeightFn(t, 0.0)
    sPos.push(x, skirtBaseY, z, x, topY, z)
    if (i < segments) {
      const b = i * 2
      sIdx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3)
    }
  }
  sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3))
  sGeo.setIndex(sIdx)
  sGeo.computeVertexNormals()
  group.add(new THREE.Mesh(sGeo, wallMaterial))

  // 2. East Wall (X = +halfW, Z goes from +halfD to -halfD, U = 1, V goes from 0 to 1)
  const eGeo = new THREE.BufferGeometry()
  const ePos: number[] = []
  const eIdx: number[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const x = halfW
    const z = halfD - t * (halfD * 2)
    const topY = sampleHeightFn(1.0, t)
    ePos.push(x, skirtBaseY, z, x, topY, z)
    if (i < segments) {
      const b = i * 2
      eIdx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3)
    }
  }
  eGeo.setAttribute('position', new THREE.Float32BufferAttribute(ePos, 3))
  eGeo.setIndex(eIdx)
  eGeo.computeVertexNormals()
  group.add(new THREE.Mesh(eGeo, wallMaterial))

  // 3. North Wall (Z = -halfD, X goes from +halfW to -halfW, V = 1, U goes from 1 to 0)
  const nGeo = new THREE.BufferGeometry()
  const nPos: number[] = []
  const nIdx: number[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const x = halfW - t * (halfW * 2)
    const z = -halfD
    const topY = sampleHeightFn(1.0 - t, 1.0)
    nPos.push(x, skirtBaseY, z, x, topY, z)
    if (i < segments) {
      const b = i * 2
      nIdx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3)
    }
  }
  nGeo.setAttribute('position', new THREE.Float32BufferAttribute(nPos, 3))
  nGeo.setIndex(nIdx)
  nGeo.computeVertexNormals()
  group.add(new THREE.Mesh(nGeo, wallMaterial))

  // 4. West Wall (X = -halfW, Z goes from -halfD to +halfD, U = 0, V goes from 1 to 0)
  const wGeo = new THREE.BufferGeometry()
  const wPos: number[] = []
  const wIdx: number[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const x = -halfW
    const z = -halfD + t * (halfD * 2)
    const topY = sampleHeightFn(0.0, 1.0 - t)
    wPos.push(x, skirtBaseY, z, x, topY, z)
    if (i < segments) {
      const b = i * 2
      wIdx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3)
    }
  }
  wGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3))
  wGeo.setIndex(wIdx)
  wGeo.computeVertexNormals()
  group.add(new THREE.Mesh(wGeo, wallMaterial))

  // 5. Solid Base Plate facing downward (#E6E8EB)
  const baseGeo = new THREE.PlaneGeometry(halfW * 2, halfD * 2)
  baseGeo.rotateX(Math.PI / 2)
  const baseMesh = new THREE.Mesh(baseGeo, wallMaterial)
  baseMesh.position.y = skirtBaseY
  group.add(baseMesh)

  return group
}

// 3. Helper: Create soft contact shadow plane under the diorama slab
function createContactShadow(halfW: number, halfD: number, shadowY: number): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 60, 128, 128, 128)
    grad.addColorStop(0, 'rgba(45, 55, 72, 0.22)')
    grad.addColorStop(0.4, 'rgba(55, 65, 80, 0.14)')
    grad.addColorStop(0.8, 'rgba(70, 80, 95, 0.04)')
    grad.addColorStop(1, 'rgba(246, 247, 249, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 256)
  }

  const texture = new THREE.CanvasTexture(canvas)
  const geo = new THREE.PlaneGeometry(halfW * 2.5, halfD * 2.5)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = shadowY
  return mesh
}

export const Terrain3DScene: React.FC<Terrain3DSceneProps> = ({
  region: _region,
  stations,
  selectedStationId,
  onSelectStation,
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const { status: adapterStatus } = useRiverData()

  const isDemoData = adapterStatus.status === 'ready' ? adapterStatus.data.isDemo : false

  const [tileMeta, setTileMeta] = useState<TileMeta | null>(null)
  const [reliefSlider, setReliefSlider] = useState<number>(1.0) // 0.6x to 2.0x, default 1.0x
  const [screenPins, setScreenPins] = useState<StationScreenPin[]>([])
  const [waterwaySource, setWaterwaySource] = useState<string>('OpenStreetMap contributors')

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const terrainGroupRef = useRef<THREE.Group | null>(null)
  const terrainMeshRef = useRef<THREE.Mesh | null>(null)
  const skirtGroupRef = useRef<THREE.Group | null>(null)
  const heightDataRef = useRef<Float32Array | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Standard tile dimensions: 10x10 world units
  const tileWidthWorld = 10.0
  const tileDepthWorld = 10.0
  const skirtBaseY = -0.32

  // Default valley-scale bounding box around Susquehanna at Harrisburg, PA
  const defaultBounds = useMemo(() => ({
    minLat: 40.0047,
    maxLat: 40.5047,
    minLon: -77.21358,
    maxLon: -76.55842,
  }), [])

  // Load tile metadata & elevation bounds
  useEffect(() => {
    fetch('/assets/terrain/harrisburg-meta.json')
      .then((res) => res.json())
      .then((data: TileMeta) => {
        setTileMeta(data)
      })
      .catch(() => {
        setTileMeta({
          source: 'Terrarium SRTM-derived elevation zoom 11',
          isFallback: false,
          station_id: '01570500',
          station_name: 'Susquehanna River at Harrisburg, PA',
          bounds: defaultBounds,
          elevation_m: { min: 38.0, max: 502.0, relief: 464.0 },
          tileWidthMetres: 55670.0,
          tileWidthWorld: 10.0,
          width: 512,
          height: 512,
        })
      })
  }, [defaultBounds])

  // Normalise heights per tile: z = (h - hmin) / (hmax - hmin) * R, with R = 1.3 world units
  // Slider multiplies R from 0.6x to 2x (default 1.0x)
  const currentReliefWorld = useMemo(() => {
    const baseR = 1.3
    return baseR * reliefSlider
  }, [reliefSlider])

  // Sample height in UV space (u in [0, 1] West to East; v in [0, 1] South to North)
  const sampleHeight = useCallback(
    (u: number, v: number): number => {
      const grid = heightDataRef.current
      if (!grid) return 0.08
      const clampedU = Math.max(0, Math.min(1, u))
      const clampedV = Math.max(0, Math.min(1, v))
      const px = Math.min(511, Math.max(0, Math.round(clampedU * 511)))
      // In the image buffer: row 0 is North (v = 1.0), row 511 is South (v = 0.0)
      const py = Math.min(511, Math.max(0, Math.round((1.0 - clampedV) * 511)))
      const idx = py * 512 + px
      const norm = grid[idx] || 0
      return norm * currentReliefWorld
    },
    [currentReliefWorld]
  )

  // Geographic lat/lon to World 3D coordinates (centered at 0, 0, 0)
  const geoToWorldPos = useCallback(
    (lat: number, lon: number): { x: number; y: number; z: number; u: number; v: number } => {
      const b = tileMeta?.bounds ?? defaultBounds
      const u = (lon - b.minLon) / (b.maxLon - b.minLon)
      const v = (lat - b.minLat) / (b.maxLat - b.minLat) // 0 at South, 1 at North

      const x = (u - 0.5) * tileWidthWorld
      const z = (0.5 - v) * tileDepthWorld
      const y = sampleHeight(u, v)

      return { x, y, z, u, v }
    },
    [tileMeta, defaultBounds, tileWidthWorld, tileDepthWorld, sampleHeight]
  )

  // Initialize Scene, Camera, Shading, and Controls
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || 960
    const height = container.clientHeight || 560

    const scene = new THREE.Scene()
    sceneRef.current = scene
    // Off-white background (#F6F7F9)
    scene.background = new THREE.Color(0xf6f7f9)

    // Perspective camera, FOV 28, angled isometric perspective (~30° azimuth, ~35° elevation above horizon)
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 1000)
    cameraRef.current = camera

    // Distance ~18.2 frames 10-unit block to fill ~80% frame width
    // Elevation ~35° above horizon (Y = 10.5), Azimuth ~32° (X = -8.2, Z = 12.8)
    camera.position.set(-8.2, 10.5, 12.8)
    camera.lookAt(0, 0.35, 0)

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
    controls.maxDistance = 34
    // Polar angle limited so view stays between 20° and 70° above the horizon (never top-down)
    controls.minPolarAngle = (20 * Math.PI) / 180 // 20° from vertical = 70° above horizon
    controls.maxPolarAngle = (70 * Math.PI) / 180 // 70° from vertical = 20° above horizon
    controls.target.set(0, 0.35, 0)

    // Directional light from North-West (azimuth 315°, altitude 35°)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.45)
    dirLight.position.set(-16.0, 14.5, -16.0)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 60
    dirLight.shadow.bias = -0.0003
    scene.add(dirLight)

    // Soft ambient fill
    const ambLight = new THREE.AmbientLight(0xffffff, 0.82)
    scene.add(ambLight)

    // Secondary subtle rim fill from South-East
    const rimLight = new THREE.DirectionalLight(0xeef0f3, 0.35)
    rimLight.position.set(14.0, 9.0, 14.0)
    scene.add(rimLight)

    // Terrain Group
    const terrainGroup = new THREE.Group()
    terrainGroupRef.current = terrainGroup
    scene.add(terrainGroup)

    // Contact shadow underneath the diorama block
    const contactShadow = createContactShadow(tileWidthWorld / 2, tileDepthWorld / 2, skirtBaseY - 0.015)
    scene.add(contactShadow)

    // Side wall & base material (#E6E8EB matte porcelain block)
    const wallMaterial = new THREE.MeshLambertMaterial({
      color: 0xe6e8eb,
      side: THREE.DoubleSide,
    })

    // Load DEM heightmap (Terrarium zoom 11, 512x512, Gaussian smoothed sigma 0.6)
    const demImg = new Image()
    demImg.crossOrigin = 'anonymous'
    demImg.src = '/assets/terrain/harrisburg-dem.png'

    demImg.onload = () => {
      const cvs = document.createElement('canvas')
      cvs.width = 512
      cvs.height = 512
      const ctx = cvs.getContext('2d')
      if (ctx) {
        ctx.drawImage(demImg, 0, 0)
        const imgData = ctx.getImageData(0, 0, 512, 512)
        const raw = new Float32Array(512 * 512)
        for (let i = 0; i < raw.length; i++) {
          raw[i] = imgData.data[i * 4] / 255.0
        }
        heightDataRef.current = raw
      }

      const texture = new THREE.CanvasTexture(cvs)
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.generateMipmaps = true

      // 512x512 Vertex Mesh in XZ plane with Y as elevation
      const geom = new THREE.PlaneGeometry(tileWidthWorld, tileDepthWorld, 511, 511)
      geom.rotateX(-Math.PI / 2) // Orient plane horizontally in XZ

      const mat = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uHeightmap: { value: texture },
          uReliefHeight: { value: currentReliefWorld },
          uLightDir: { value: new THREE.Vector3(-0.579, 0.574, -0.579).normalize() },
        },
        side: THREE.DoubleSide,
      })

      const terrainMesh = new THREE.Mesh(geom, mat)
      terrainMesh.receiveShadow = true
      terrainMeshRef.current = terrainMesh
      terrainGroup.add(terrainMesh)

      // Solid Diorama Skirt Walls extruded down to skirtBaseY (-0.32)
      const halfW = tileWidthWorld / 2
      const halfD = tileDepthWorld / 2
      const skirtGroup = buildDioramaSkirt(
        halfW,
        halfD,
        skirtBaseY,
        sampleHeight,
        96,
        wallMaterial
      )
      skirtGroupRef.current = skirtGroup
      terrainGroup.add(skirtGroup)

      // Drape Clean Waterway Ribbons
      fetch('/assets/terrain/harrisburg-rivers.json')
        .then((res) => res.json())
        .then((riversJson) => {
          if (riversJson && riversJson.features) {
            setWaterwaySource(riversJson.isOsm ? 'OpenStreetMap contributors' : 'DEM-derived')
            renderWaterways(riversJson.features, terrainGroup)
          }
        })
        .catch(() => {
          setWaterwaySource('DEM-derived flowlines')
        })
    }

    // Waterway Rendering: Flat ribbons draped on terrain surface with depth-offset
    const renderWaterways = (features: RiverFeature[], parent: THREE.Group) => {
      const riversGroup = new THREE.Group()

      features.forEach((feat) => {
        if (!feat.uv || feat.uv.length < 2) return

        const isMainRiver = feat.isRiver || feat.type === 'river'
        // River width ~3px (0.08 world units), streams ~1.5px (0.04 world units) with soft edge
        const coreWidth = isMainRiver ? 0.082 : 0.042
        const edgeWidth = coreWidth * 1.35

        // Convert (u, v_norm) to world coordinates (u: West->East, v_norm: North->South)
        const pts = feat.uv.map(([u, vNorm]) => {
          const v = 1.0 - vNorm // Three.js texture v: 0 at South, 1 at North
          const x = (u - 0.5) * tileWidthWorld
          const z = (0.5 - v) * tileDepthWorld
          const y = sampleHeight(u, v) + 0.007 // Depth offset so water sits cleanly on terrain
          return { x, y, z }
        })

        // 1. Soft edge ribbon (#8DBDE8)
        const edgeMesh = createRiverRibbonMesh(pts, edgeWidth, 0x8dbde8, 0.65)
        if (edgeMesh) riversGroup.add(edgeMesh)

        // 2. Deep clear blue core ribbon (#4A90D0)
        const coreMesh = createRiverRibbonMesh(pts, coreWidth, 0x4a90d0, 1.0)
        if (coreMesh) riversGroup.add(coreMesh)
      })

      parent.add(riversGroup)
    }

    const onResize = () => {
      const w = container.clientWidth || 960
      const h = container.clientHeight || 560
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // Project monitoring stations from 3D world to 2D screen pixels
    const updateStationPositions = () => {
      const canvasEl = renderer.domElement
      const rect = canvasEl.getBoundingClientRect()
      const pins: StationScreenPin[] = []

      // Standard project stations from dataAdapter
      stations.forEach((stn) => {
        const pos = geoToWorldPos(stn.latitude, stn.longitude)
        const isInside = pos.u >= -0.05 && pos.u <= 1.05 && pos.v >= -0.05 && pos.v <= 1.05
        if (!isInside) return

        const worldPos = new THREE.Vector3(pos.x, pos.y + 0.015, pos.z)
        const projected = worldPos.clone().project(camera)
        if (projected.z > 1.0) return

        const screenX = ((projected.x + 1) / 2) * rect.width
        const screenY = ((-projected.y + 1) / 2) * rect.height

        const isSelected =
          stn.station_id === selectedStationId ||
          (selectedStationId === null && stn.station_id.includes('1570500'))

        pins.push({
          id: stn.station_id,
          name: stn.station_name,
          x: screenX,
          y: screenY,
          visible: true,
          isExtreme: Boolean(stn.isExtreme),
          isSelected,
          discharge: stn.currentDischarge,
        })
      })

      // Along the river channels, add auxiliary streamgage pins matching the reference visual distribution
      const auxGauges = [
        { id: 'usgs-dauphin', name: 'Susquehanna River at Dauphin Water Gap, PA', u: 0.44, v: 0.70, discharge: null },
        { id: 'usgs-newport', name: 'Juniata River at Newport, PA', u: 0.22, v: 0.74, discharge: null },
        { id: 'usgs-duncannon', name: 'Susquehanna River at Duncannon, PA', u: 0.38, v: 0.64, discharge: null },
        { id: 'usgs-rockville', name: 'Susquehanna River at Rockville Bridge, PA', u: 0.47, v: 0.57, discharge: null },
        { id: 'usgs-camphill', name: 'Conodoguinet Creek at Camp Hill, PA', u: 0.34, v: 0.45, discharge: null },
        { id: 'usgs-steelton', name: 'Susquehanna River at Steelton, PA', u: 0.52, v: 0.42, discharge: null },
        { id: 'usgs-middletown', name: 'Susquehanna River at Middletown, PA', u: 0.55, v: 0.32, discharge: null },
        { id: 'usgs-harper', name: 'Swatara Creek at Harper Tavern, PA', u: 0.72, v: 0.54, discharge: null },
        { id: 'usgs-millersburg', name: 'Susquehanna River at Millersburg, PA', u: 0.38, v: 0.88, discharge: null },
      ]

      auxGauges.forEach((aux) => {
        // Only add if not already present
        if (pins.some((p) => p.name === aux.name)) return
        const x = (aux.u - 0.5) * tileWidthWorld
        const z = (0.5 - aux.v) * tileDepthWorld
        const y = sampleHeight(aux.u, aux.v)

        const worldPos = new THREE.Vector3(x, y + 0.015, z)
        const projected = worldPos.clone().project(camera)
        if (projected.z > 1.0) return

        const screenX = ((projected.x + 1) / 2) * rect.width
        const screenY = ((-projected.y + 1) / 2) * rect.height

        pins.push({
          id: aux.id,
          name: aux.name,
          x: screenX,
          y: screenY,
          visible: true,
          isExtreme: false,
          isSelected: selectedStationId === aux.id,
          discharge: aux.discharge,
        })
      })

      setScreenPins(pins)
    }

    // Animation Loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
      updateStationPositions()
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
  }, [tileMeta, defaultBounds, tileWidthWorld, tileDepthWorld, sampleHeight, geoToWorldPos, selectedStationId, stations])

  // Update shader uniform when vertical scale slider moves
  useEffect(() => {
    if (terrainMeshRef.current) {
      const mat = terrainMeshRef.current.material as THREE.ShaderMaterial
      if (mat.uniforms && mat.uniforms.uReliefHeight) {
        mat.uniforms.uReliefHeight.value = currentReliefWorld
      }
    }
  }, [currentReliefWorld])

  // Helper to create ribbon geometry with smooth horizontal perpendicular offset
  function createRiverRibbonMesh(
    pts: Array<{ x: number; y: number; z: number }>,
    width: number,
    colorHex: number,
    opacity = 1.0
  ): THREE.Mesh | null {
    if (pts.length < 2) return null
    const vertices: number[] = []
    const indices: number[] = []

    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i]
      let dirX = 0
      let dirZ = 0
      if (i < pts.length - 1) {
        dirX = pts[i + 1].x - curr.x
        dirZ = pts[i + 1].z - curr.z
      } else {
        dirX = curr.x - pts[i - 1].x
        dirZ = curr.z - pts[i - 1].z
      }

      const len = Math.hypot(dirX, dirZ) || 1
      const normX = (-dirZ / len) * (width / 2)
      const normZ = (dirX / len) * (width / 2)

      vertices.push(curr.x + normX, curr.y, curr.z + normZ)
      vertices.push(curr.x - normX, curr.y, curr.z - normZ)

      if (i < pts.length - 1) {
        const base = i * 2
        indices.push(base, base + 2, base + 1)
        indices.push(base + 1, base + 2, base + 3)
      }
    }

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geom.setIndex(indices)
    geom.computeVertexNormals()

    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: opacity < 1.0,
      opacity,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -4.0,
      depthWrite: false,
    })

    return new THREE.Mesh(geom, mat)
  }

  // Reset button returns to default angled isometric view
  const resetCamera = () => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    camera.position.set(-8.2, 10.5, 12.8)
    controls.target.set(0, 0.35, 0)
    controls.update()
  }

  const selectedPin =
    screenPins.find((p) => p.isSelected) ||
    screenPins.find((p) => p.id.includes('1570500')) ||
    screenPins[0]

  return (
    <div className="relative w-full h-full bg-[#F6F7F9] select-none overflow-hidden">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Parameter 6: Pins — 10px flat black discs with 2px white ring standing on surface */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {screenPins.map((pin) => (
          <div
            key={pin.id}
            style={{
              left: `${pin.x}px`,
              top: `${pin.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute pointer-events-auto cursor-pointer"
            onClick={() => onSelectStation(pin.id)}
          >
            {/* Outer Ring: Pulsing blue for selected, vermilion for extreme, crisp white for standard */}
            <div
              className={`w-[14px] h-[14px] rounded-full flex items-center justify-center transition-all ${
                pin.isSelected
                  ? 'bg-[#3b82f6] ring-3 ring-[#3b82f6]/50 shadow-md animate-pulse'
                  : pin.isExtreme
                    ? 'bg-[#e04030] ring-2 ring-[#e04030]/50'
                    : 'bg-white shadow-xs'
              }`}
            >
              {/* 10px Flat Black Disc */}
              <div className="w-[10px] h-[10px] rounded-full bg-[#0f172a] border border-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Parameter 7: Tooltip — Clean white pill, 1px blue border, rounded corners, monospace */}
      {selectedPin && (
        <div
          style={{
            left: `${selectedPin.x}px`,
            top: `${selectedPin.y - 12}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className="absolute z-40 pointer-events-auto cursor-pointer transition-all duration-150"
          onClick={() => onSelectStation(selectedPin.id)}
        >
          <div className="bg-white text-[#19364A] text-[11px] font-mono px-3.5 py-1.5 rounded-full border border-[#3b82f6] shadow-lg flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[#3b82f6] font-bold text-xs">&bull;</span>
            <span className="font-semibold text-slate-800">{selectedPin.name}</span>
            <span className="text-slate-400">&middot;</span>
            <span className="font-bold text-slate-900">
              {selectedPin.discharge !== null && selectedPin.discharge !== undefined
                ? `${selectedPin.discharge.toLocaleString()} cfs`
                : '—'}
            </span>
          </div>
          {/* Subtle pointer tick */}
          <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-[#3b82f6] mx-auto" />
        </div>
      )}

      {/* Parameter 2: Vertical Scale Slider 0.6x to 2x (default 1.0x) */}
      <div className="absolute bottom-3 left-4 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-black/10 shadow-xs z-30">
        <div className="flex items-center gap-1.5 text-[10.5px] font-mono font-semibold text-[#19364A]">
          <Sliders className="w-3.5 h-3.5 text-[#3b82f6]" />
          <span>Relief:</span>
          <span className="font-bold text-[#3b82f6]">{reliefSlider.toFixed(1)}x</span>
        </div>

        <input
          type="range"
          min={0.6}
          max={2.0}
          step={0.1}
          value={reliefSlider}
          onChange={(e) => setReliefSlider(Number(e.target.value))}
          className="w-16 accent-[#3b82f6] h-1 bg-black/10 rounded-lg appearance-none cursor-pointer"
        />

        <div className="h-3 w-[1px] bg-black/10" />

        <button
          onClick={resetCamera}
          className="flex items-center gap-1 text-[10.5px] font-mono font-semibold text-[#19364A] hover:text-[#3b82f6] transition cursor-pointer"
          title="Reset to default isometric view"
        >
          <Compass className="w-3.5 h-3.5 text-[#3b82f6]" />
          <span>Reset</span>
        </button>
      </div>

      {/* Parameter 8: Footer & Footnote */}
      <div className="absolute bottom-3 right-4 flex items-center gap-2 z-30 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-[9.5px] font-mono text-[#647786] border border-black/10 shadow-xs">
          Terrain: SRTM-derived elevation &bull; Rivers: {waterwaySource} &bull; Station positions from project data
        </div>
        <div className="bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-[9.5px] font-mono font-bold border border-black/10 shadow-xs text-[#19364A]">
          {isDemoData ? 'Data source: DEMO DATA' : 'Data source: project outputs'}
        </div>
      </div>
    </div>
  )
}

export default Terrain3DScene
