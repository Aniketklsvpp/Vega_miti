import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export interface OrbitDeliveryHeroProps {
  onSelectRegion?: (region: 'india' | 'usa') => void
  onSkipIntro?: () => void
  auto?: boolean
}

interface MotionState {
  planetAngle: number
  planetVelocity: number
  dragTarget: number
  time: number
  dragging: boolean
  lastInteraction: number
  pitchAngle: number
  pitchVelocity: number
  pitchTarget: number
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))
const damp = (val: number, target: number, lambda: number, dt: number) =>
  val + (target - val) * (1 - Math.exp(-lambda * dt))

const createMotion = (): MotionState => ({
  planetAngle: 0,
  planetVelocity: 0,
  dragTarget: 0,
  time: 0,
  dragging: false,
  lastInteraction: 0,
  pitchAngle: 0,
  pitchVelocity: 0,
  pitchTarget: 0,
})

function stepPlanet(m: MotionState, dt: number, auto: boolean, reduced: boolean, autoRoll = -0.032) {
  m.time += dt
  if (!auto) {
    m.dragging = false
    m.planetVelocity = m.pitchVelocity = 0
    m.dragTarget = m.planetAngle
    m.pitchTarget = m.pitchAngle
    return
  }
  if (m.dragging) {
    const acceleration = 90 * (m.dragTarget - m.planetAngle) - 18 * m.planetVelocity
    m.planetVelocity += acceleration * dt
  } else {
    const desired = auto && !reduced && m.time - m.lastInteraction > 3.5 ? autoRoll : 0
    m.planetVelocity = damp(m.planetVelocity, desired, reduced ? 12 : 5, dt)
  }
  m.planetVelocity = clamp(m.planetVelocity, -1.15, 1.15)
  m.planetAngle += m.planetVelocity * dt
}

interface GlobeMotion {
  delta: THREE.Quaternion
  orientation: THREE.Quaternion
  angular: THREE.Vector3
  route: number
}

function createGlobeMotion(): GlobeMotion {
  return {
    delta: new THREE.Quaternion(),
    orientation: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.4, 0)),
    angular: new THREE.Vector3(),
    route: 0,
  }
}

function stepGlobeMotion(globe: GlobeMotion, m: MotionState, dt: number, auto: boolean, reduced: boolean) {
  const roaming = auto && !reduced && !m.dragging && m.time - m.lastInteraction > 3.5
  if (roaming) globe.route += 0.24 * dt
  stepPlanet(m, dt, auto, reduced, -0.24 * Math.cos(globe.route))
  if (!auto) {
    globe.angular.set(0, 0, 0)
    return
  }
  if (m.dragging) {
    m.pitchVelocity += (70 * (m.pitchTarget - m.pitchAngle) - 17 * m.pitchVelocity) * dt
  } else {
    m.pitchVelocity = THREE.MathUtils.damp(m.pitchVelocity, roaming ? 0.24 * Math.sin(globe.route) : 0, 6, dt)
  }
  m.pitchVelocity = THREE.MathUtils.clamp(m.pitchVelocity, -0.55, 0.55)
  m.pitchAngle += m.pitchVelocity * dt
  globe.angular.set(m.pitchVelocity, m.planetVelocity * 0.45, -m.planetVelocity)
  const speed = globe.angular.length()
  if (speed > 1e-8) {
    globe.delta.setFromAxisAngle(globe.angular.clone().multiplyScalar(1 / speed), speed * dt)
    globe.orientation.premultiply(globe.delta).normalize()
  }
}

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

function createNaturalEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
  grad.addColorStop(0, '#122635')
  grad.addColorStop(0.2, '#19364A')
  grad.addColorStop(0.5, '#1E4158')
  grad.addColorStop(0.8, '#19364A')
  grad.addColorStop(1, '#122635')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const shelfGrad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 50, canvas.width / 2, canvas.height / 2, 800)
  shelfGrad.addColorStop(0, 'rgba(40, 83, 107, 0.35)')
  shelfGrad.addColorStop(1, 'rgba(18, 38, 53, 0)')
  ctx.fillStyle = shelfGrad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const toX = (lon: number) => ((lon + 180) / 360) * canvas.width
  const toY = (lat: number) => ((90 - lat) / 180) * canvas.height

  const landmasses: [number, number][][] = [
    [[-165, 65], [-140, 70], [-100, 75], [-60, 78], [-60, 50], [-70, 45], [-80, 25], [-100, 20], [-120, 35], [-160, 58], [-165, 65]],
    [[-80, 10], [-50, 0], [-35, -5], [-40, -22], [-55, -35], [-70, -53], [-75, -45], [-70, -18], [-80, 0], [-80, 10]],
    [[-10, 36], [10, 37], [30, 32], [50, 12], [45, -15], [30, -34], [18, -34], [12, -5], [0, 5], [-15, 12], [-10, 36]],
    [[-10, 36], [5, 43], [15, 40], [25, 36], [40, 42], [30, 55], [20, 60], [10, 55], [-5, 50], [-10, 36]],
    [[30, 38], [60, 40], [70, 60], [90, 72], [140, 70], [170, 65], [140, 40], [120, 30], [105, 20], [80, 10], [60, 22], [45, 25], [30, 38]],
    [[68, 24], [72, 32], [78, 35], [88, 28], [92, 26], [88, 21], [80, 10], [76, 8.5], [72, 18], [68, 24]],
    [[115, -15], [145, -12], [152, -25], [140, -38], [115, -34], [112, -22], [115, -15]],
  ]

  ctx.fillStyle = '#41634F'
  ctx.strokeStyle = '#5E876F'
  ctx.lineWidth = 1.5

  landmasses.forEach((poly) => {
    ctx.beginPath()
    poly.forEach(([lon, lat], i) => {
      const px = toX(lon), py = toY(lat)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  })

  const indiaPoly: [number, number][] = [
    [68, 24], [70, 28], [74, 33], [77, 35.5], [81, 31],
    [88, 27.5], [93, 27], [92, 23], [89, 22], [85, 20],
    [80, 13], [77.5, 8], [76, 10], [73, 16], [70, 21], [68, 24],
  ]
  ctx.fillStyle = '#4C7A5E'
  ctx.beginPath()
  indiaPoly.forEach(([lon, lat], i) => {
    const px = toX(lon), py = toY(lat)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#28A6A1'
  ctx.stroke()

  ctx.lineWidth = 1.8
  ctx.strokeStyle = '#68C4E8'
  const rivers: [number, number][][] = [
    [[78, 31], [81, 27], [85, 25.5], [88, 24], [90, 22.5]],
    [[82, 31], [77, 34], [72, 30], [68, 24.5]],
    [[73.5, 20], [76, 19], [79, 18.5], [81.5, 17], [82, 16.5]],
    [[81.5, 22.8], [77.5, 22], [74, 21.8], [72.8, 21.5]],
    [[-94, 46], [-91, 41], [-89, 37], [-91, 32], [-89.5, 29]],
    [[-74, -4], [-68, -3], [-60, -3], [-54, -2], [-50, 0]],
    [[32, 3], [31.5, 12], [32.5, 20], [31, 31]],
    [[10, 48], [15, 48], [20, 45], [26, 44], [28.5, 45]],
    [[94, 33], [102, 28], [108, 30], [114, 30.5], [121, 31.5]],
  ]

  rivers.forEach((r) => {
    ctx.beginPath()
    r.forEach(([lon, lat], idx) => {
      const px = toX(lon), py = toY(lat)
      if (idx === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  })

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

function NaturalEarth({
  globe,
  isFlying,
  onHoverIndia,
  onClickIndia,
}: {
  globe: GlobeMotion
  isFlying: boolean
  onHoverIndia: (hovered: boolean) => void
  onClickIndia: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useMemo(() => createNaturalEarthTexture(), [])

  const stations = useMemo(() => [
    { lat: 25.5, lon: 85.0 },
    { lat: 28.0, lon: 77.0 },
    { lat: 19.0, lon: 75.0 },
    { lat: 26.0, lon: 92.0 },
    { lat: 22.5, lon: 79.0 },
    { lat: 38.0, lon: -97.0 },
    { lat: 35.0, lon: -90.0 },
    { lat: -3.0, lon: -60.0 },
    { lat: 45.0, lon: 19.0 },
    { lat: 24.0, lon: 32.0 },
  ], [])

  useFrame(() => {
    if (meshRef.current && !isFlying) {
      meshRef.current.quaternion.copy(globe.orientation)
    }
  })

  return (
    <group ref={meshRef}>
      <mesh>
        <sphereGeometry args={[2.25, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.75}
          metalness={0.08}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[2.28, 48, 48]} />
        <meshStandardMaterial
          color="#A9C5D5"
          transparent
          opacity={0.16}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {stations.map((st, i) => {
        const pos = latLonToVector3(st.lat, st.lon, 2.27)
        return (
          <group key={i} position={pos}>
            <mesh>
              <sphereGeometry args={[0.024, 12, 12]} />
              <meshBasicMaterial color="#28A6A1" />
            </mesh>
            <mesh>
              <ringGeometry args={[0.035, 0.045, 16]} />
              <meshBasicMaterial color="#A9C5D5" side={THREE.DoubleSide} transparent opacity={0.65} />
            </mesh>
          </group>
        )
      })}

      <mesh
        position={latLonToVector3(22.5, 79.0, 2.29)}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
          onHoverIndia(true)
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'default'
          onHoverIndia(false)
        }}
        onClick={(e) => {
          e.stopPropagation()
          onClickIndia()
        }}
      >
        <sphereGeometry args={[0.34, 16, 16]} />
        <meshBasicMaterial transparent opacity={0.01} depthWrite={false} />
      </mesh>
    </group>
  )
}

function ResponsiveCamera() {
  const { size, camera } = useThree()
  useEffect(() => {
    const ortho = camera as THREE.OrthographicCamera
    ortho.zoom = Math.min(size.width / 5.4, size.height / 5.4)
    ortho.updateProjectionMatrix()
  }, [size.width, size.height, camera])
  return null
}

export const OrbitDeliveryHero: React.FC<OrbitDeliveryHeroProps> = ({
  onSelectRegion,
  auto = true,
}) => {
  const motion = useRef<MotionState>(createMotion())
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const globe = useMemo(createGlobeMotion, [])
  const [, setHoveredIndia] = useState(false)
  const [isFlying, setIsFlying] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const listener = () => setReduced(query.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  const triggerFlyToIndia = useCallback(() => {
    if (isFlying) return
    setIsFlying(true)
    const m = motion.current
    m.dragging = false
    m.planetVelocity = 0
    m.pitchVelocity = 0

    const targetEuler = new THREE.Euler(0.35, -1.35, 0)
    const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler)
    const startQuat = globe.orientation.clone()
    const startTime = performance.now()
    const duration = 2100

    const animateZoom = () => {
      const now = performance.now()
      const progress = Math.min((now - startTime) / duration, 1)
      const t = progress * progress * (3 - 2 * progress)
      globe.orientation.copy(startQuat).slerp(targetQuat, t)

      if (progress < 1) {
        requestAnimationFrame(animateZoom)
      } else {
        onSelectRegion?.('india')
      }
    }
    requestAnimationFrame(animateZoom)
  }, [isFlying, globe, onSelectRegion])

  const release = (id: number) => {
    if (drag.current?.id !== id) return
    drag.current = null
    const m = motion.current
    m.dragging = false
    m.lastInteraction = m.time
  }

  return (
    <div
      className="relative w-full h-full min-h-[580px] bg-[#F7F9FB] overflow-hidden select-none"
      onPointerDown={(e) => {
        if (!auto || !e.isPrimary || e.button !== 0 || isFlying) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
        const m = motion.current
        m.dragTarget = m.planetAngle
        m.pitchTarget = m.pitchAngle
        m.dragging = true
        m.lastInteraction = m.time
      }}
      onPointerMove={(e) => {
        if (!auto || isFlying || drag.current?.id !== e.pointerId) return
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        const sensitivity = 4.2 / Math.max(360, e.currentTarget.clientWidth)
        const m = motion.current
        m.dragTarget = Math.max(m.planetAngle - 0.45, Math.min(m.planetAngle + 0.45, m.dragTarget + dx * sensitivity))
        m.pitchTarget = Math.max(m.pitchAngle - 0.35, Math.min(m.pitchAngle + 0.35, m.pitchTarget + dy * sensitivity * 0.6))
        drag.current.x = e.clientX
        drag.current.y = e.clientY
        m.lastInteraction = m.time
      }}
      onPointerUp={(e) => release(e.pointerId)}
      onPointerCancel={(e) => release(e.pointerId)}
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 9], zoom: 140, near: 0.1, far: 30 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ResponsiveCamera />
        <ambientLight intensity={1.1} />
        <hemisphereLight args={['#F7F9FB', '#8AABC5', 1.2]} />
        <directionalLight position={[-4, 5, 6]} intensity={2.4} color="#FFFFFF" />
        <directionalLight position={[4, 2, -3]} intensity={1.5} color="#A9C5D5" />
        <NaturalEarth
          globe={globe}
          isFlying={isFlying}
          onHoverIndia={setHoveredIndia}
          onClickIndia={triggerFlyToIndia}
        />
        <FrameStep motion={motion} globe={globe} auto={auto} reduced={reduced} isFlying={isFlying} />
      </Canvas>
    </div>
  )
}

function FrameStep({
  motion,
  globe,
  auto,
  reduced,
  isFlying,
}: {
  motion: React.MutableRefObject<MotionState>
  globe: GlobeMotion
  auto: boolean
  reduced: boolean
  isFlying: boolean
}) {
  useFrame((_, delta) => {
    if (isFlying) return
    const m = motion.current
    const elapsed = Math.min(delta, 0.05)
    stepGlobeMotion(globe, m, elapsed, auto, reduced)
  })
  return null
}

export default OrbitDeliveryHero

