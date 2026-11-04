import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import * as d3Geo from 'd3-geo'
import type { RegionType } from '../../types/data'
import { FastForward, Globe2, Sparkles } from 'lucide-react'

interface RealEarthGlobeProps {
  onSelectRegion: (region: RegionType) => void
  onSkipIntro: () => void
}

type TransitionPhase = 'idle' | 'selecting' | 'flying' | 'revealing' | 'dashboard'

interface CountryFeature {
  type: string
  id: string
  properties: {
    name: string
    id?: string
    hasData?: boolean
    status?: 'active' | 'prototype' | 'none'
  }
  geometry: any
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
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

export const RealEarthGlobe: React.FC<RealEarthGlobeProps> = ({
  onSelectRegion,
  onSkipIntro,
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<TransitionPhase>('idle')
  const [hoveredCountry, setHoveredCountry] = useState<{
    name: string
    status: 'active' | 'prototype' | 'none'
    x: number
    y: number
  } | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [irisScale, setIrisScale] = useState<number>(0)
  const [fadeAlpha, setFadeAlpha] = useState<number>(0)

  const animFrameRef = useRef<number | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const globeGroupRef = useRef<THREE.Group | null>(null)
  const starsRef = useRef<THREE.Points | null>(null)
  const atmosphereRef = useRef<THREE.Mesh | null>(null)
  const earthMeshRef = useRef<THREE.Mesh | null>(null)
  const pulsingRingsRef = useRef<{ mesh: THREE.Mesh; scale: number; region: RegionType }[]>([])

  const countriesDataRef = useRef<CountryFeature[]>([])
  const countryLinesRef = useRef<{ id: string; line: THREE.Line; defaultColor: number }[]>([])

  const isDraggingRef = useRef<boolean>(false)
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const velocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastInteractionTimeRef = useRef<number>(performance.now())
  const mouseNormRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const touchStartDistRef = useRef<number | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 2400)
  }, [])

  const triggerCinematicTransition = useCallback(
    (region: RegionType, targetLat: number, targetLon: number) => {
      if (phase !== 'idle') return
      setPhase('selecting')

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (prefersReducedMotion) {
        onSelectRegion(region)
        return
      }

      const globe = globeGroupRef.current
      const camera = cameraRef.current
      const atmosphere = atmosphereRef.current
      if (!globe || !camera) {
        onSelectRegion(region)
        return
      }

      const targetRotY = -((targetLon + 180) * (Math.PI / 180)) + Math.PI / 2
      const targetRotX = (targetLat * (Math.PI / 180)) * 0.35

      const startRotX = globe.rotation.x
      const startRotY = globe.rotation.y
      const startCamZ = camera.position.z
      const targetCamZ = 2.45

      const startTime = performance.now()
      const totalDuration = 2500

      const animateTransition = (now: number) => {
        const elapsed = now - startTime
        const t = Math.min(elapsed / totalDuration, 1)

        if (t <= 0.32) {
          const stepProgress = t / 0.32
          const ease1 = stepProgress * stepProgress * (3 - 2 * stepProgress)
          globe.rotation.x = startRotX + (targetRotX - startRotX) * ease1
          globe.rotation.y = startRotY + (targetRotY - startRotY) * ease1
        } else if (t <= 0.72) {
          setPhase('flying')
          const stepProgress = (t - 0.32) / 0.40
          const ease2 = stepProgress * stepProgress
          camera.position.z = startCamZ + (targetCamZ - startCamZ) * ease2
          if (atmosphere) {
            const mat = atmosphere.material as THREE.MeshBasicMaterial
            mat.opacity = 0.22 + ease2 * 0.35
          }
        } else {
          setPhase('revealing')
          const stepProgress = (t - 0.72) / 0.28
          setFadeAlpha(stepProgress)
          setIrisScale(stepProgress * 150)
        }

        if (t < 1) {
          requestAnimationFrame(animateTransition)
        } else {
          setPhase('dashboard')
          onSelectRegion(region)
        }
      }

      requestAnimationFrame(animateTransition)
    },
    [phase, onSelectRegion]
  )

  const handleCountryClick = useCallback(
    (feature: CountryFeature | null) => {
      if (phase !== 'idle') return

      if (!feature) {
        showToast('Ocean area — Select United States or India.')
        return
      }

      const id = String(feature.id)
      const isUsa = id === '840' || feature.properties?.name === 'United States'
      const isIndia = id === '356' || feature.properties?.name === 'India'

      if (isUsa) {
        triggerCinematicTransition('usa', 38.0, -97.0)
      } else if (isIndia) {
        triggerCinematicTransition('india', 22.5, 79.0)
      } else {
        showToast(`No stations in ${feature.properties?.name || 'this region'}. Monitoring active in USA & India.`)
      }
    },
    [phase, showToast, triggerCinematicTransition]
  )

  useEffect(() => {
    if (!checkWebGLSupport()) {
      onSelectRegion('usa')
      return
    }

    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000)
    camera.position.set(0, 0, 5.6)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rendererRef.current = renderer
    container.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xfff8ee, 1.35)
    sunLight.position.set(5, 3.5, 4.5)
    scene.add(sunLight)

    const rimLight = new THREE.DirectionalLight(0x2f7f8f, 0.6)
    rimLight.position.set(-6, -2, -4)
    scene.add(rimLight)

    const starCount = 1200
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(starCount * 3)
    const starColors = new Float32Array(starCount * 3)

    for (let i = 0; i < starCount; i++) {
      const theta = 2 * Math.PI * Math.random()
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 25 + Math.random() * 45
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      starPos[i * 3 + 2] = r * Math.cos(phi)

      const lum = 0.5 + Math.random() * 0.5
      starColors[i * 3] = lum
      starColors[i * 3 + 1] = lum * 0.95
      starColors[i * 3 + 2] = lum * 1.05
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3))
    const starMat = new THREE.PointsMaterial({
      size: 0.85,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
    })
    const starPoints = new THREE.Points(starGeo, starMat)
    starsRef.current = starPoints
    scene.add(starPoints)

    const globeGroup = new THREE.Group()
    globeGroupRef.current = globeGroup
    scene.add(globeGroup)

    globeGroup.rotation.y = 1.35
    globeGroup.rotation.x = 0.15

    const sphereRadius = 2.0

    const canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 1024
    const ctx = canvas.getContext('2d')

    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 1024)
      grad.addColorStop(0, '#0a1622')
      grad.addColorStop(0.35, '#0e2338')
      grad.addColorStop(0.65, '#0e2338')
      grad.addColorStop(1, '#0a1622')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 2048, 1024)

      ctx.fillStyle = 'rgba(47, 127, 143, 0.08)'
      ctx.fillRect(0, 360, 2048, 300)
    }

    const canvasTexture = new THREE.CanvasTexture(canvas)
    canvasTexture.wrapS = THREE.ClampToEdgeWrapping
    canvasTexture.wrapT = THREE.ClampToEdgeWrapping
    canvasTexture.generateMipmaps = true

    const earthMat = new THREE.MeshStandardMaterial({
      map: canvasTexture,
      roughness: 0.78,
      metalness: 0.05,
    })
    const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(sphereRadius, 64, 64), earthMat)
    earthMeshRef.current = earthMesh
    globeGroup.add(earthMesh)

    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x397c9e,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
    })
    const atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(sphereRadius * 1.035, 48, 48), atmoMat)
    atmosphereRef.current = atmoMesh
    globeGroup.add(atmoMesh)

    const addPulsingRing = (lat: number, lon: number, region: RegionType, colorHex: number) => {
      const pos = latLonToVector3(lat, lon, sphereRadius * 1.01)
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      })
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.15, 32), ringMat)
      ring.position.copy(pos)
      ring.lookAt(new THREE.Vector3(0, 0, 0))

      const coreMat = new THREE.MeshBasicMaterial({ color: colorHex })
      const core = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), coreMat)
      core.position.copy(pos)
      core.lookAt(new THREE.Vector3(0, 0, 0))

      globeGroup.add(ring)
      globeGroup.add(core)
      pulsingRingsRef.current.push({ mesh: ring, scale: 1, region })
    }

    addPulsingRing(38.0, -97.0, 'usa', 0xb8893b)
    addPulsingRing(22.5, 79.0, 'india', 0x2f7f8f)

    fetch('/assets/geo/world-countries.json')
      .then((res) => res.json())
      .then((data) => {
        if (!data || !data.features) return
        countriesDataRef.current = data.features

        if (ctx) {
          ctx.lineWidth = 1.0
          data.features.forEach((feature: CountryFeature) => {
            const geom = feature.geometry
            if (!geom) return
            const id = String(feature.id)
            const isUsa = id === '840' || feature.properties?.name === 'United States'
            const isIndia = id === '356' || feature.properties?.name === 'India'

            const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates

            polys.forEach((ringGroup: any) => {
              ringGroup.forEach((ring: any, ringIdx: number) => {
                ctx.beginPath()
                ring.forEach(([lon, lat]: [number, number], ptIdx: number) => {
                  const px = ((lon + 180) / 360) * 2048
                  const py = ((90 - lat) / 180) * 1024
                  if (ptIdx === 0) ctx.moveTo(px, py)
                  else ctx.lineTo(px, py)
                })
                ctx.closePath()

                if (ringIdx === 0) {
                  if (isUsa) {
                    ctx.fillStyle = '#3a6652'
                  } else if (isIndia) {
                    ctx.fillStyle = '#2f5e49'
                  } else {
                    ctx.fillStyle = '#254b38'
                  }
                  ctx.fill()
                }

                ctx.strokeStyle = isUsa ? '#B8893B' : isIndia ? '#2F7F8F' : '#3E6179'
                ctx.stroke()
              })
            })
          })

          ctx.strokeStyle = 'rgba(230, 241, 247, 0.45)'
          ctx.beginPath()
          ctx.arc(1024, 60, 48, 0, Math.PI * 2)
          ctx.stroke()

          canvasTexture.needsUpdate = true
        }

        data.features.forEach((feature: CountryFeature) => {
          const geom = feature.geometry
          if (!geom) return
          const id = String(feature.id)
          const isUsa = id === '840' || feature.properties?.name === 'United States'
          const isIndia = id === '356' || feature.properties?.name === 'India'

          const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
          const defaultColor = isUsa ? 0xb8893b : isIndia ? 0x2f7f8f : 0x51768f

          polys.forEach((ringGroup: any) => {
            ringGroup.forEach((ring: any) => {
              const pts: THREE.Vector3[] = []
              ring.forEach(([lon, lat]: [number, number]) => {
                pts.push(latLonToVector3(lat, lon, sphereRadius * 1.003))
              })
              const lineGeo = new THREE.BufferGeometry().setFromPoints(pts)
              const lineMat = new THREE.LineBasicMaterial({
                color: defaultColor,
                transparent: true,
                opacity: isUsa || isIndia ? 0.95 : 0.4,
              })
              const lineMesh = new THREE.Line(lineGeo, lineMat)
              globeGroup.add(lineMesh)
              countryLinesRef.current.push({ id, line: lineMesh, defaultColor })
            })
          })
        })
      })
      .catch(() => {})

    const raycaster = new THREE.Raycaster()
    const mousePos = new THREE.Vector2()

    const onPointerMove = (e: MouseEvent) => {
      lastInteractionTimeRef.current = performance.now()
      const rect = renderer.domElement.getBoundingClientRect()
      mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      mouseNormRef.current.x = mousePos.x
      mouseNormRef.current.y = mousePos.y

      if (isDraggingRef.current) {
        const dx = e.clientX - prevMousePosRef.current.x
        const dy = e.clientY - prevMousePosRef.current.y
        prevMousePosRef.current = { x: e.clientX, y: e.clientY }

        velocityRef.current.x = dx * 0.0045
        velocityRef.current.y = dy * 0.0045

        globeGroup.rotation.y += velocityRef.current.x
        globeGroup.rotation.x = Math.max(-0.9, Math.min(0.9, globeGroup.rotation.x + velocityRef.current.y))
        return
      }

      if (phase !== 'idle') return

      raycaster.setFromCamera(mousePos, camera)
      if (!earthMeshRef.current) return
      const intersects = raycaster.intersectObject(earthMeshRef.current)

      if (intersects.length > 0) {
        const hit = intersects[0]
        const localPoint = globeGroup.worldToLocal(hit.point.clone())

        const r = localPoint.length()
        const phi = Math.acos(Math.max(-1, Math.min(1, localPoint.y / r)))
        const theta = Math.atan2(localPoint.z, -localPoint.x)

        const lat = 90 - (phi * 180) / Math.PI
        const lon = (theta * 180) / Math.PI - 180

        let foundCountry: CountryFeature | null = null
        for (const feature of countriesDataRef.current) {
          try {
            if (d3Geo.geoContains(feature as any, [lon, lat])) {
              foundCountry = feature
              break
            }
          } catch {
            // pass
          }
        }

        if (foundCountry) {
          renderer.domElement.style.cursor = 'pointer'
          const id = String(foundCountry.id)
          const isUsa = id === '840' || foundCountry.properties?.name === 'United States'
          const isIndia = id === '356' || foundCountry.properties?.name === 'India'

          setHoveredCountry({
            name: foundCountry.properties?.name || 'Country',
            status: isUsa ? 'active' : isIndia ? 'prototype' : 'none',
            x: e.clientX,
            y: e.clientY,
          })

          countryLinesRef.current.forEach((item) => {
            const mat = item.line.material as THREE.LineBasicMaterial
            if (item.id === id) {
              mat.color.setHex(0xffffff)
              mat.opacity = 1.0
            } else {
              mat.color.setHex(item.defaultColor)
              mat.opacity = item.defaultColor === 0xb8893b || item.defaultColor === 0x2f7f8f ? 0.95 : 0.35
            }
          })
          return
        }
      }

      renderer.domElement.style.cursor = 'grab'
      setHoveredCountry(null)
      countryLinesRef.current.forEach((item) => {
        const mat = item.line.material as THREE.LineBasicMaterial
        mat.color.setHex(item.defaultColor)
        mat.opacity = item.defaultColor === 0xb8893b || item.defaultColor === 0x2f7f8f ? 0.95 : 0.4
      })
    }

    const onPointerDown = (e: MouseEvent) => {
      isDraggingRef.current = true
      prevMousePosRef.current = { x: e.clientX, y: e.clientY }
      velocityRef.current = { x: 0, y: 0 }
      lastInteractionTimeRef.current = performance.now()
      renderer.domElement.style.cursor = 'grabbing'
    }

    const onPointerUp = (e: MouseEvent) => {
      const wasDragging = isDraggingRef.current
      isDraggingRef.current = false
      renderer.domElement.style.cursor = 'grab'

      const dx = Math.abs(e.clientX - prevMousePosRef.current.x)
      const dy = Math.abs(e.clientY - prevMousePosRef.current.y)
      if (wasDragging && dx < 4 && dy < 4) {
        raycaster.setFromCamera(mousePos, camera)
        if (earthMeshRef.current) {
          const intersects = raycaster.intersectObject(earthMeshRef.current)
          if (intersects.length > 0) {
            const hit = intersects[0]
            const localPoint = globeGroup.worldToLocal(hit.point.clone())
            const r = localPoint.length()
            const phi = Math.acos(Math.max(-1, Math.min(1, localPoint.y / r)))
            const theta = Math.atan2(localPoint.z, -localPoint.x)
            const lat = 90 - (phi * 180) / Math.PI
            const lon = (theta * 180) / Math.PI - 180

            let clicked: CountryFeature | null = null
            for (const f of countriesDataRef.current) {
              try {
                if (d3Geo.geoContains(f as any, [lon, lat])) {
                  clicked = f
                  break
                }
              } catch {
                // pass
              }
            }
            handleCountryClick(clicked)
          }
        }
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      lastInteractionTimeRef.current = performance.now()
      camera.position.z = Math.max(2.8, Math.min(7.8, camera.position.z + e.deltaY * 0.0035))
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDraggingRef.current = true
        prevMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        velocityRef.current = { x: 0, y: 0 }
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        touchStartDistRef.current = Math.hypot(dx, dy)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      lastInteractionTimeRef.current = performance.now()
      if (e.touches.length === 1 && isDraggingRef.current) {
        const dx = e.touches[0].clientX - prevMousePosRef.current.x
        const dy = e.touches[0].clientY - prevMousePosRef.current.y
        prevMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        globeGroup.rotation.y += dx * 0.0045
        globeGroup.rotation.x = Math.max(-0.9, Math.min(0.9, globeGroup.rotation.x + dy * 0.0045))
      } else if (e.touches.length === 2 && touchStartDistRef.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        const delta = touchStartDistRef.current - dist
        camera.position.z = Math.max(2.8, Math.min(7.8, camera.position.z + delta * 0.01))
        touchStartDistRef.current = dist
      }
    }

    const onTouchEnd = () => {
      isDraggingRef.current = false
      touchStartDistRef.current = null
    }

    const domEl = renderer.domElement
    domEl.addEventListener('pointermove', onPointerMove)
    domEl.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    domEl.addEventListener('wheel', onWheel, { passive: false })
    domEl.addEventListener('touchstart', onTouchStart, { passive: true })
    domEl.addEventListener('touchmove', onTouchMove, { passive: true })
    domEl.addEventListener('touchend', onTouchEnd, { passive: true })

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    let lastTick = performance.now()

    const animateLoop = (now: number) => {
      animFrameRef.current = requestAnimationFrame(animateLoop)
      const dt = (now - lastTick) / 1000
      lastTick = now

      if (phase === 'idle') {
        const idleDuration = (now - lastInteractionTimeRef.current) / 1000
        if (!isDraggingRef.current) {
          velocityRef.current.x *= Math.pow(0.92, dt * 60)
          velocityRef.current.y *= Math.pow(0.92, dt * 60)
          globeGroup.rotation.y += velocityRef.current.x
          globeGroup.rotation.x = Math.max(-0.9, Math.min(0.9, globeGroup.rotation.x + velocityRef.current.y))

          if (idleDuration > 3.0) {
            globeGroup.rotation.y += 0.0012
          }
        }

        const parallaxTargetX = mouseNormRef.current.x * 0.18
        const parallaxTargetY = -mouseNormRef.current.y * 0.12
        camera.position.x += (parallaxTargetX - camera.position.x) * 0.05
        camera.position.y += (parallaxTargetY - camera.position.y) * 0.05
        camera.lookAt(0, 0, 0)
      }

      pulsingRingsRef.current.forEach((item, idx) => {
        const pulse = 1.0 + Math.sin(now * 0.004 + idx * Math.PI) * 0.22
        item.mesh.scale.set(pulse, pulse, pulse)
      })

      if (starsRef.current) {
        starsRef.current.rotation.y += 0.00015
      }

      renderer.render(scene, camera)
    }

    animFrameRef.current = requestAnimationFrame(animateLoop)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      domEl.removeEventListener('pointermove', onPointerMove)
      domEl.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      domEl.removeEventListener('wheel', onWheel)
      domEl.removeEventListener('touchstart', onTouchStart)
      domEl.removeEventListener('touchmove', onTouchMove)
      domEl.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('resize', onResize)

      if (domEl.parentNode) domEl.parentNode.removeChild(domEl)
      renderer.dispose()
    }
  }, [phase, handleCountryClick, onSelectRegion])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0A1622] select-none text-[#F3EBDD]">
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Intro Header & Region Selection Bar */}
      <div
        className={`absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-30 transition-opacity duration-700 pointer-events-auto ${
          phase !== 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#1F2A33]/80 backdrop-blur-md border border-[#DDD1BF]/30 shadow-lg">
          <Globe2 className="w-4 h-4 text-[#2F7F8F]" />
          <span className="font-extrabold text-sm tracking-wide text-[#F3EBDD]">
            DELTA<span className="text-[#2F7F8F]">-</span>SWARM
          </span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FAF6EE]/10 text-[#DDD1BF] border border-[#DDD1BF]/20">
            EARTH EXPLORER
          </span>
        </div>

        <div className="flex items-center gap-2 bg-[#1F2A33]/70 backdrop-blur-md p-1.5 rounded-2xl border border-[#DDD1BF]/25 shadow-md">
          <button
            onClick={() => triggerCinematicTransition('usa', 38.0, -97.0)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF6EE] text-[#1F2A33] hover:bg-[#FAF6EE]/90 transition text-xs font-bold shadow-xs cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#B8893B] animate-pulse"></span>
            <span>United States</span>
            <span className="text-[10px] font-mono text-[#526573] bg-[#EAE1D2] px-1.5 py-0.2 rounded font-semibold">
              22 USGS Stations
            </span>
          </button>

          <button
            onClick={() => triggerCinematicTransition('india', 22.5, 79.0)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF6EE]/15 hover:bg-[#FAF6EE]/25 text-[#F3EBDD] transition text-xs font-semibold cursor-pointer border border-[#DDD1BF]/20"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#2F7F8F] animate-pulse"></span>
            <span>India</span>
            <span className="text-[10px] font-mono text-[#DDD1BF] bg-[#FAF6EE]/10 px-1.5 py-0.2 rounded">
              Prototype
            </span>
          </button>
        </div>
      </div>

      {/* Floating Instructions & Skip Button */}
      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-between gap-6 w-full max-w-xl px-4 z-30 transition-opacity duration-700 pointer-events-auto ${
          phase !== 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-3 text-xs text-[#DDD1BF]/80 bg-[#1F2A33]/70 backdrop-blur-md px-3.5 py-2 rounded-xl border border-[#DDD1BF]/20">
          <span>Drag to rotate</span>
          <span>&bull;</span>
          <span>Scroll to zoom</span>
          <span>&bull;</span>
          <span>Click highlighted country</span>
        </div>

        <button
          onClick={onSkipIntro}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1F2A33]/80 hover:bg-[#FAF6EE] text-[#DDD1BF] hover:text-[#1F2A33] transition text-xs font-bold border border-[#DDD1BF]/30 shadow-md cursor-pointer"
        >
          <FastForward className="w-3.5 h-3.5" />
          <span>Skip Intro</span>
        </button>
      </div>

      {/* Hover Tooltip */}
      {hoveredCountry && phase === 'idle' && (
        <div
          className="absolute z-40 pointer-events-none -translate-x-1/2 -translate-y-12 bg-[#1F2A33]/90 backdrop-blur-md text-[#F3EBDD] px-3 py-1.5 rounded-lg border border-[#DDD1BF]/30 shadow-xl text-xs flex items-center gap-2"
          style={{ left: hoveredCountry.x, top: hoveredCountry.y }}
        >
          <span className="font-bold">{hoveredCountry.name}</span>
          {hoveredCountry.status === 'active' ? (
            <span className="text-[10px] font-mono bg-[#B8893B]/20 text-[#B8893B] border border-[#B8893B]/40 px-1.5 py-0.2 rounded font-bold">
              22 USGS Stations
            </span>
          ) : hoveredCountry.status === 'prototype' ? (
            <span className="text-[10px] font-mono bg-[#2F7F8F]/20 text-[#2F7F8F] border border-[#2F7F8F]/40 px-1.5 py-0.2 rounded font-bold">
              Prototype Region
            </span>
          ) : (
            <span className="text-[10px] text-[#DDD1BF]/60 font-mono">No stations here</span>
          )}
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-[#1F2A33]/95 backdrop-blur-md text-[#F3EBDD] text-xs px-4 py-2 rounded-xl border border-[#DDD1BF]/40 shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-3.5 h-3.5 text-[#B8893B]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Circular Iris-Wipe & Crossfade Layer */}
      {fadeAlpha > 0 && (
        <div
          className="absolute inset-0 pointer-events-none z-50 transition-opacity"
          style={{
            backgroundColor: `rgba(243, 235, 221, ${fadeAlpha})`,
            maskImage:
              irisScale > 0
                ? `radial-gradient(circle at center, transparent 0%, transparent ${irisScale}%, black ${irisScale + 1}%)`
                : undefined,
            WebkitMaskImage:
              irisScale > 0
                ? `radial-gradient(circle at center, transparent 0%, transparent ${irisScale}%, black ${irisScale + 1}%)`
                : undefined,
          }}
        />
      )}
    </div>
  )
}
export default RealEarthGlobe
