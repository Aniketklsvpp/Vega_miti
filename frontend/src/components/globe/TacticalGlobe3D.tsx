import React, { useEffect, useRef, useState, useMemo, useId } from 'react'
import type { RegionType } from '../../types/data'
import { Compass, ChevronRight } from 'lucide-react'

// Country dictionary mapping numeric ISO string to [ISO3, Country Name]
const CD: Record<string, [string, string]> = {
  "004": ["AFG", "Afghanistan"], "008": ["ALB", "Albania"], "012": ["DZA", "Algeria"], "024": ["AGO", "Angola"],
  "032": ["ARG", "Argentina"], "036": ["AUS", "Australia"], "040": ["AUT", "Austria"], "031": ["AZE", "Azerbaijan"],
  "050": ["BGD", "Bangladesh"], "056": ["BEL", "Belgium"], "204": ["BEN", "Benin"], "064": ["BTN", "Bhutan"],
  "068": ["BOL", "Bolivia"], "070": ["BIH", "Bosnia and Herz."], "072": ["BWA", "Botswana"], "076": ["BRA", "Brazil"],
  "096": ["BRN", "Brunei"], "100": ["BGR", "Bulgaria"], "854": ["BFA", "Burkina Faso"], "108": ["BDI", "Burundi"],
  "116": ["KHM", "Cambodia"], "120": ["CMR", "Cameroon"], "124": ["CAN", "Canada"], "140": ["CAF", "Central African Rep."],
  "148": ["TCD", "Chad"], "152": ["CHL", "Chile"], "156": ["CHN", "China"], "170": ["COL", "Colombia"],
  "178": ["COG", "Congo"], "180": ["COD", "Dem. Rep. Congo"], "188": ["CRI", "Costa Rica"], "384": ["CIV", "Cote d'Ivoire"],
  "191": ["HRV", "Croatia"], "192": ["CUB", "Cuba"], "196": ["CYP", "Cyprus"], "203": ["CZE", "Czechia"],
  "208": ["DNK", "Denmark"], "262": ["DJI", "Djibouti"], "214": ["DOM", "Dominican Rep."], "218": ["ECU", "Ecuador"],
  "818": ["EGY", "Egypt"], "222": ["SLV", "El Salvador"], "226": ["GNQ", "Eq. Guinea"], "232": ["ERI", "Eritrea"],
  "233": ["EST", "Estonia"], "748": ["SWZ", "Eswatini"], "231": ["ETH", "Ethiopia"], "242": ["FJI", "Fiji"],
  "246": ["FIN", "Finland"], "250": ["FRA", "France"], "266": ["GAB", "Gabon"], "270": ["GMB", "Gambia"],
  "268": ["GEO", "Georgia"], "276": ["DEU", "Germany"], "288": ["GHA", "Ghana"], "300": ["GRC", "Greece"],
  "304": ["GRL", "Greenland"], "320": ["GTM", "Guatemala"], "324": ["GIN", "Guinea"], "624": ["GNB", "Guinea-Bissau"],
  "328": ["GUY", "Guyana"], "332": ["HTI", "Haiti"], "340": ["HND", "Honduras"], "348": ["HUN", "Hungary"],
  "352": ["ISL", "Iceland"], "356": ["IND", "India"], "360": ["IDN", "Indonesia"], "364": ["IRN", "Iran"],
  "368": ["IRQ", "Iraq"], "372": ["IRL", "Ireland"], "376": ["ISR", "Israel"], "380": ["ITA", "Italy"],
  "388": ["JAM", "Jamaica"], "392": ["JPN", "Japan"], "400": ["JOR", "Jordan"], "398": ["KAZ", "Kazakhstan"],
  "404": ["KEN", "Kenya"], "408": ["PRK", "North Korea"], "410": ["KOR", "South Korea"], "414": ["KWT", "Kuwait"],
  "417": ["KGZ", "Kyrgyzstan"], "418": ["LAO", "Laos"], "428": ["LVA", "Latvia"], "422": ["LBN", "Lebanon"],
  "426": ["LSO", "Lesotho"], "430": ["LBR", "Liberia"], "434": ["LBY", "Libya"], "440": ["LTU", "Lithuania"],
  "442": ["LUX", "Luxembourg"], "450": ["MDG", "Madagascar"], "454": ["MWI", "Malawi"], "458": ["MYS", "Malaysia"],
  "466": ["MLI", "Mali"], "478": ["MRT", "Mauritania"], "484": ["MEX", "Mexico"], "498": ["MDA", "Moldova"],
  "496": ["MNG", "Mongolia"], "499": ["MNE", "Montenegro"], "504": ["MAR", "Morocco"], "508": ["MOZ", "Mozambique"],
  "104": ["MMR", "Myanmar"], "516": ["NAM", "Namibia"], "524": ["NPL", "Nepal"], "528": ["NLD", "Netherlands"],
  "554": ["NZL", "New Zealand"], "558": ["NIC", "Nicaragua"], "562": ["NER", "Niger"], "566": ["NGA", "Nigeria"],
  "578": ["NOR", "Norway"], "512": ["OMN", "Oman"], "586": ["PAK", "Pakistan"], "591": ["PAN", "Panama"],
  "598": ["PNG", "Papua New Guinea"], "600": ["PRY", "Paraguay"], "604": ["PER", "Peru"], "608": ["PHL", "Philippines"],
  "616": ["POL", "Poland"], "620": ["PRT", "Portugal"], "634": ["QAT", "Qatar"], "642": ["ROU", "Romania"],
  "643": ["RUS", "Russia"], "646": ["RWA", "Rwanda"], "682": ["SAU", "Saudi Arabia"], "686": ["SEN", "Senegal"],
  "688": ["SRB", "Serbia"], "694": ["SLE", "Sierra Leone"], "702": ["SGP", "Singapore"], "703": ["SVK", "Slovakia"],
  "705": ["SVN", "Slovenia"], "706": ["SOM", "Somalia"], "710": ["ZAF", "South Africa"], "728": ["SSD", "South Sudan"],
  "724": ["ESP", "Spain"], "144": ["LKA", "Sri Lanka"], "729": ["SDN", "Sudan"], "740": ["SUR", "Suriname"],
  "752": ["SWE", "Sweden"], "756": ["CHE", "Switzerland"], "760": ["SYR", "Syria"], "158": ["TWN", "Taiwan"],
  "762": ["TJK", "Tajikistan"], "834": ["TZA", "Tanzania"], "764": ["THA", "Thailand"], "626": ["TLS", "Timor-Leste"],
  "768": ["TGO", "Togo"], "780": ["TTO", "Trinidad and Tobago"], "788": ["TUN", "Tunisia"], "792": ["TUR", "Turkey"],
  "795": ["TKM", "Turkmenistan"], "800": ["UGA", "Uganda"], "804": ["UKR", "Ukraine"], "784": ["ARE", "UAE"],
  "826": ["GBR", "United Kingdom"], "840": ["USA", "United States"], "858": ["URY", "Uruguay"], "860": ["UZB", "Uzbekistan"],
  "862": ["VEN", "Venezuela"], "704": ["VNM", "Vietnam"], "887": ["YEM", "Yemen"], "894": ["ZMB", "Zambia"],
  "716": ["ZWE", "Zimbabwe"], "275": ["PSE", "Palestine"], "807": ["MKD", "North Macedonia"], "051": ["ARM", "Armenia"],
  "112": ["BLR", "Belarus"], "174": ["COM", "Comoros"], "084": ["BLZ", "Belize"], "090": ["SLB", "Solomon Islands"],
  "540": ["NCL", "New Caledonia"], "548": ["VUT", "Vanuatu"], "010": ["ATA", "Antarctica"], "-99": ["XKX", "Kosovo"]
}

/* ========================================================================== */
/* 3D Sphere Mathematics & Orthographic Projection                           */
/* ========================================================================== */
const D2R = Math.PI / 180
const R2D = 180 / Math.PI

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

interface ProjectedPoint {
  sx: number
  sy: number
  rx: number
  ry: number
  rz: number
  v: boolean
}

function project(lng: number, lat: number, lambda: number, phi: number, gamma: number, R: number, cx: number, cy: number): ProjectedPoint {
  const lr = (lng - lambda) * D2R
  const la = lat * D2R
  const cl = Math.cos(la)
  const x0 = cl * Math.cos(lr)
  const y0 = cl * Math.sin(lr)
  const z0 = Math.sin(la)

  const cp = Math.cos(phi * D2R)
  const sp = Math.sin(phi * D2R)
  const x1 = x0 * cp + z0 * sp
  const y1 = y0
  const z1 = -x0 * sp + z0 * cp

  const cg = Math.cos(gamma * D2R)
  const sg = Math.sin(gamma * D2R)
  const rx = x1
  const ry = y1 * cg - z1 * sg
  const rz = y1 * sg + z1 * cg

  return {
    sx: cx + R * ry,
    sy: cy - R * rz,
    rx,
    ry,
    rz,
    v: rx >= 0,
  }
}

function unproject(px: number, py: number, lambda: number, phi: number, gamma: number, R: number, cx: number, cy: number): { lng: number; lat: number } | null {
  const Ry = (px - cx) / R
  const Rz = -(py - cy) / R
  const r2 = Ry * Ry + Rz * Rz
  if (r2 > 1) return null

  const cg = Math.cos(gamma * D2R)
  const sg = Math.sin(gamma * D2R)
  const y1 = Ry * cg + Rz * sg
  const z1 = -Ry * sg + Rz * cg

  const x1 = Math.sqrt(Math.max(0, 1 - r2))
  const cp = Math.cos(phi * D2R)
  const sp = Math.sin(phi * D2R)
  const x0 = x1 * cp - z1 * sp
  const y0 = y1
  const z0 = x1 * sp + z1 * cp

  const lat = Math.asin(clamp(z0, -1, 1)) * R2D
  let lng = Math.atan2(y0, x0) * R2D + lambda
  lng = ((lng + 180) % 360 + 360) % 360 - 180
  return { lng, lat }
}

function limbIntersect(a: ProjectedPoint, b: ProjectedPoint, R: number, cx: number, cy: number): ProjectedPoint | null {
  const dr = a.rx - b.rx
  if (Math.abs(dr) < 1e-12) return null
  const t = a.rx / dr
  if (t < 0 || t > 1) return null

  let ry = a.ry + t * (b.ry - a.ry)
  let rz = a.rz + t * (b.rz - a.rz)
  const norm = Math.sqrt(ry * ry + rz * rz)
  if (norm < 1e-9) return null
  ry /= norm
  rz /= norm
  return { sx: cx + R * ry, sy: cy - R * rz, rx: 0, ry, rz, v: true }
}

function ringToSegments(ring: number[][], lambda: number, phi: number, gamma: number, R: number, cx: number, cy: number): ProjectedPoint[][] {
  const n = ring.length
  if (n < 3) return []
  const proj = new Array<ProjectedPoint>(n)
  let visCount = 0

  for (let i = 0; i < n; i++) {
    const p = ring[i]
    proj[i] = project(p[0], p[1], lambda, phi, gamma, R, cx, cy)
    if (proj[i].v) visCount++
  }

  if (visCount === 0) return []
  if (visCount === n) return [proj.slice()]

  let startIdx = -1
  for (let i = 0; i < n; i++) {
    if (!proj[i].v && proj[(i + 1) % n].v) {
      startIdx = i
      break
    }
  }

  if (startIdx === -1) return [proj.slice()]

  const segments: ProjectedPoint[][] = []
  let cur: ProjectedPoint[] = []

  for (let k = 0; k < n; k++) {
    const i = (startIdx + k) % n
    const j = (startIdx + k + 1) % n
    const A = proj[i]
    const B = proj[j]

    if (A.v && B.v) {
      cur.push(B)
    } else if (A.v && !B.v) {
      const inter = limbIntersect(A, B, R, cx, cy)
      if (inter) cur.push(inter)
      if (cur.length >= 2) segments.push(cur)
      cur = []
    } else if (!A.v && B.v) {
      const inter = limbIntersect(A, B, R, cx, cy)
      if (inter) cur.push(inter)
      cur.push(B)
    }
  }

  return segments
}

function segmentsToPath(segs: ProjectedPoint[][]): string {
  if (segs.length === 0) return ''
  let out = ''
  for (const seg of segs) {
    for (let i = 0; i < seg.length; i++) {
      const p = seg[i]
      out += (i === 0 ? 'M' : 'L') + p.sx.toFixed(1) + ',' + p.sy.toFixed(1)
    }
    out += 'Z'
  }
  return out
}

function buildSphericalPath(type: string, coords: any, lambda: number, phi: number, gamma: number, R: number, cx: number, cy: number): string {
  if (!coords) return ''
  if (type === 'Polygon') {
    let out = ''
    for (const ring of coords as number[][][]) {
      out += segmentsToPath(ringToSegments(ring, lambda, phi, gamma, R, cx, cy))
    }
    return out
  }
  if (type === 'MultiPolygon') {
    let out = ''
    for (const poly of coords as number[][][][]) {
      for (const ring of poly) {
        out += segmentsToPath(ringToSegments(ring, lambda, phi, gamma, R, cx, cy))
      }
    }
    return out
  }
  return ''
}

function decArcs(t: any): number[][][] {
  const tf = t.transform
  if (!tf) return t.arcs
  const sx = tf.scale[0]
  const sy = tf.scale[1]
  const dx = tf.translate[0]
  const dy = tf.translate[1]
  return t.arcs.map((a: number[][]) => {
    let x = 0
    let y = 0
    return a.map((p: number[]) => {
      x += p[0]
      y += p[1]
      return [x * sx + dx, y * sy + dy]
    })
  })
}

function resolveRing(idx: number[], arcs: number[][][]): number[][] {
  const out: number[][] = []
  for (const i of idx) {
    const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse()
    for (let j = out.length > 0 ? 1 : 0; j < a.length; j++) {
      out.push(a[j])
    }
  }
  return out
}

interface RawFeature {
  id: string
  type: string
  coords: any
}

function extractFeatures(t: any): RawFeature[] {
  const arcs = decArcs(t)
  const gs = t.objects.countries?.geometries
  if (!gs) return []
  return gs.map((g: any) => {
    let c: any = null
    if (g.type === 'Polygon') {
      c = g.arcs.map((r: number[]) => resolveRing(r, arcs))
    } else if (g.type === 'MultiPolygon') {
      c = g.arcs.map((p: number[][]) => p.map((r: number[]) => resolveRing(r, arcs)))
    }
    return {
      id: String(g.id ?? ''),
      type: g.type,
      coords: c,
    }
  })
}

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

interface CountryRecord {
  id: string
  name: string
  type: string
  coords: any
  rings: number[][][]
  bbox: { minLng: number; maxLng: number; minLat: number; maxLat: number }
}

function findCountryAt(lng: number, lat: number, index: CountryRecord[]): CountryRecord | null {
  for (const c of index) {
    if (lng < c.bbox.minLng || lng > c.bbox.maxLng) continue
    if (lat < c.bbox.minLat || lat > c.bbox.maxLat) continue
    let inside = false
    for (const ring of c.rings) {
      if (pointInRing(lng, lat, ring)) inside = !inside
    }
    if (inside) return c
  }
  return null
}

function rgba(c: string, a: number): string {
  if (typeof c !== 'string' || !c) return 'rgba(0,0,0,' + a + ')'
  const s = c.trim()
  if (s.indexOf('rgb') === 0) {
    const m = s.match(/-?[\d.]+/g)
    if (m && m.length >= 3) return 'rgba(' + m[0] + ',' + m[1] + ',' + m[2] + ',' + a + ')'
    return 'rgba(0,0,0,' + a + ')'
  }
  const h = s.replace('#', '')
  if (h.length !== 3 && h.length !== 6 && h.length !== 8) {
    return 'rgba(0,0,0,' + a + ')'
  }
  const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6)
  return (
    'rgba(' +
    parseInt(f.slice(0, 2), 16) +
    ',' +
    parseInt(f.slice(2, 4), 16) +
    ',' +
    parseInt(f.slice(4, 6), 16) +
    ',' +
    a +
    ')'
  )
}

function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 1831565813) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildGraticule(lambda: number, phi: number, gamma: number, R: number, cx: number, cy: number): string {
  let out = ''
  for (let lat = -60; lat <= 60; lat += 30) {
    let started = false
    let prev: ProjectedPoint | null = null
    for (let lng = -180; lng <= 180; lng += 4) {
      const p = project(lng, lat, lambda, phi, gamma, R, cx, cy)
      if (p.v) {
        if (!started || (prev && !prev.v)) {
          out += 'M' + p.sx.toFixed(1) + ',' + p.sy.toFixed(1)
          started = true
        } else {
          out += 'L' + p.sx.toFixed(1) + ',' + p.sy.toFixed(1)
        }
      }
      prev = p
    }
  }
  for (let lng = -180; lng < 180; lng += 30) {
    let started = false
    let prev: ProjectedPoint | null = null
    for (let lat = -80; lat <= 80; lat += 4) {
      const p = project(lng, lat, lambda, phi, gamma, R, cx, cy)
      if (p.v) {
        if (!started || (prev && !prev.v)) {
          out += 'M' + p.sx.toFixed(1) + ',' + p.sy.toFixed(1)
          started = true
        } else {
          out += 'L' + p.sx.toFixed(1) + ',' + p.sy.toFixed(1)
        }
      }
      prev = p
    }
  }
  return out
}

/* ========================================================================== */
/* Tactical Globe Component Props & Interfaces                               */
/* ========================================================================== */
export interface TacticalGlobe3DProps {
  onSelectRegion: (region: RegionType) => void
  onSkipIntro?: () => void
}

interface TacticalMarker {
  id: string
  label: string
  description: string
  latitude: number
  longitude: number
  color: string
  region: RegionType
  code: string
}

const TACTICAL_MARKERS: TacticalMarker[] = [
  {
    id: 'usa',
    label: 'United States • 22 USGS Catchments',
    description: 'BasinShift Flood Intelligence • Validated ML Generalization',
    latitude: 38.0,
    longitude: -97.0,
    color: '#398DB5',
    region: 'usa',
    code: 'USA',
  },
  {
    id: 'india',
    label: 'India • Catchment Prototype',
    description: 'BasinShift Prototype Basin • Concept & Hydrological Demo',
    latitude: 22.5,
    longitude: 79.0,
    color: '#28A6A1',
    region: 'india',
    code: 'IND',
  },
]

export const TacticalGlobe3D: React.FC<TacticalGlobe3DProps> = ({ onSelectRegion, onSkipIntro }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRefs = useRef(new Map<string, SVGPathElement>())
  const ghostPathRefs = useRef(new Map<string, SVGPathElement>())
  const markerRefs = useRef(new Map<number, SVGGElement>())
  const gridPathRef = useRef<SVGPathElement>(null)
  const globeGroupRef = useRef<SVGGElement>(null)

  const rawId = useId()
  const uid = useMemo(() => rawId.replace(/[^a-zA-Z0-9]/g, ''), [rawId])
  const [dims, setDims] = useState({ w: 900, h: 650 })
  const [feats, setFeats] = useState<RawFeature[] | null>(null)
  const [hoveredMarker, setHoveredMarker] = useState<TacticalMarker | null>(null)
  const [hoveredCountry, setHoveredCountry] = useState<{ screenX: number; screenY: number; name: string; code: string } | null>(null)
  const [isAcquiring, setIsAcquiring] = useState<RegionType | null>(null)

  // Spherical Euler Angles
  const rotRef = useRef({ lambda: -40, phi: 20, gamma: 0 })
  const zoomRef = useRef(1.0)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startLambda: 0, startPhi: 0 })
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null)
  const userInteractedRef = useRef(0)

  // Target animation state
  const targetingRef = useRef<{
    active: boolean
    region: RegionType
    startLambda: number
    targetLambda: number
    startPhi: number
    targetPhi: number
    startZoom: number
    targetZoom: number
    startTime: number
    duration: number
  } | null>(null)

  // Auto-resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r && r.width > 0 && r.height > 0) {
        setDims({ w: Math.round(r.width), h: Math.round(r.height) })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Load TopoJSON locally from /assets/geo/countries-110m.json with offline fallback
  useEffect(() => {
    let dead = false
    fetch('/assets/geo/countries-110m.json')
      .then((r) => {
        if (!r.ok) throw new Error('Local file not ok')
        return r.json()
      })
      .then((t) => {
        if (!dead) {
          setFeats(extractFeatures(t))
        }
      })
      .catch(() => {
        if (!dead) {
          fetch('/assets/geo/world-countries.json')
            .then((r) => r.json())
            .then((t) => {
              if (!dead) setFeats(extractFeatures(t))
            })
            .catch(() => {})
        }
      })
    return () => {
      dead = true
    }
  }, [])

  // Geometry
  const { w: W, h: H } = dims
  const pad = 16
  const innerW = Math.max(0, W - pad * 2)
  const innerH = Math.max(0, H - pad * 2)
  const baseR = Math.max(20, Math.min(innerW, innerH) / 2 - 8)
  const cx = W / 2
  const cy = H / 2

  // Build Country Index
  const countryIndex = useMemo<CountryRecord[]>(() => {
    if (!feats) return []
    const out: CountryRecord[] = []
    for (const f of feats) {
      const pad3 = String(f.id).padStart(3, '0')
      const e = CD[pad3]
      const a3 = e ? e[0] : pad3
      const nm = e ? e[1] : a3
      if (a3 === 'ATA') continue

      const rings: number[][][] = []
      let minLng = Infinity
      let maxLng = -Infinity
      let minLat = Infinity
      let maxLat = -Infinity

      const visit = (ring: number[][]) => {
        rings.push(ring)
        for (const p of ring) {
          if (p[0] < minLng) minLng = p[0]
          if (p[0] > maxLng) maxLng = p[0]
          if (p[1] < minLat) minLat = p[1]
          if (p[1] > maxLat) maxLat = p[1]
        }
      }

      if (f.type === 'Polygon') {
        for (const r of f.coords) visit(r)
      } else if (f.type === 'MultiPolygon') {
        for (const poly of f.coords) {
          for (const r of poly) visit(r)
        }
      }

      out.push({
        id: a3,
        name: nm,
        type: f.type,
        coords: f.coords,
        rings,
        bbox: { minLng, maxLng, minLat, maxLat },
      })
    }
    return out
  }, [feats])

  // Stable Starfield
  const stars = useMemo(() => {
    const rnd = mulberry32(1584243068)
    const N = 85
    const out: { x: number; y: number; r: number; o: number }[] = []
    for (let i = 0; i < N; i++) {
      const x = rnd() * W
      const y = rnd() * H
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy < (baseR + 24) * (baseR + 24)) continue
      out.push({ x, y, r: 0.4 + rnd() * 1.1, o: 0.15 + rnd() * 0.65 })
    }
    return out
  }, [W, H, cx, cy, baseR])

  // Coordinate display ref
  const coordsReadoutRef = useRef<HTMLSpanElement>(null)

  // Start animated fly-in transition toward region
  const triggerFlyIn = (target: RegionType) => {
    if (targetingRef.current?.active) return
    setIsAcquiring(target)

    const targetCoord = target === 'india' ? { lng: 79.0, lat: 22.5 } : { lng: -97.0, lat: 38.0 }

    // Calculate shortest angular distance around 360
    const curLambda = rotRef.current.lambda
    let diff = ((targetCoord.lng - curLambda + 180) % 360) - 180
    if (diff < -180) diff += 360
    if (diff > 180) diff -= 360
    const endLambda = curLambda + diff

    targetingRef.current = {
      active: true,
      region: target,
      startLambda: curLambda,
      targetLambda: endLambda,
      startPhi: rotRef.current.phi,
      targetPhi: targetCoord.lat,
      startZoom: zoomRef.current,
      targetZoom: 2.25,
      startTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      duration: 750,
    }
  }

  const lastTimeRef = useRef(0)

  const rafRef = useRef(0)

  // Animation Frame Loop
  useEffect(() => {
    if (countryIndex.length === 0 || W <= 0 || H <= 0 || baseR <= 0) return

    lastTimeRef.current = typeof performance !== 'undefined' ? performance.now() : 0
    const idleMs = 2400

    const step = (now: number) => {
      const lastTime = lastTimeRef.current || now
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTimeRef.current = now

      // 1. Process targeting animation if active
      if (targetingRef.current?.active) {
        const anim = targetingRef.current
        const elapsed = now - anim.startTime
        const p = Math.min(1, elapsed / anim.duration)
        // Cubic ease in-out
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2

        rotRef.current.lambda = anim.startLambda + (anim.targetLambda - anim.startLambda) * ease
        rotRef.current.phi = anim.startPhi + (anim.targetPhi - anim.startPhi) * ease
        zoomRef.current = anim.startZoom + (anim.targetZoom - anim.startZoom) * ease

        if (p >= 1) {
          targetingRef.current = null
          onSelectRegion(anim.region)
          return
        }
      } else {
        // Idle auto-rotate
        const sinceUser = now - userInteractedRef.current
        if (!dragRef.current.active && sinceUser > idleMs) {
          rotRef.current.lambda += 6.5 * dt
        }
      }

      const { lambda, phi, gamma } = rotRef.current
      const currentZoom = zoomRef.current

      // Apply zoom scale transform to the globe group
      if (globeGroupRef.current) {
        globeGroupRef.current.setAttribute(
          'transform',
          `translate(${cx}, ${cy}) scale(${currentZoom.toFixed(4)}) translate(${-cx}, ${-cy})`
        )
      }

      // Update live coordinates readout
      if (coordsReadoutRef.current) {
        const normLng = ((((lambda % 360) + 540) % 360) - 180).toFixed(1)
        const normLat = phi.toFixed(1)
        coordsReadoutRef.current.textContent = `LAT: ${normLat}° | LON: ${normLng}° | ZOOM: ${currentZoom.toFixed(2)}x`
      }

      // Update country paths
      for (const c of countryIndex) {
        const d = buildSphericalPath(c.type, c.coords, lambda, phi, gamma, baseR, cx, cy)
        const p = pathRefs.current.get(c.id)
        if (p) p.setAttribute('d', d)
        const g = ghostPathRefs.current.get(c.id)
        if (g) g.setAttribute('d', d)
      }

      // Update grid lines
      if (gridPathRef.current) {
        gridPathRef.current.setAttribute('d', buildGraticule(lambda, phi, gamma, baseR, cx, cy))
      }

      // Update tactical markers
      for (let i = 0; i < TACTICAL_MARKERS.length; i++) {
        const m = TACTICAL_MARKERS[i]
        const el = markerRefs.current.get(i)
        if (!el) continue
        const p = project(m.longitude, m.latitude, lambda, phi, gamma, baseR, cx, cy)
        if (p.v) {
          const fade = clamp(p.rx * 4, 0, 1)
          el.style.opacity = String(fade)
          el.style.display = ''
          el.setAttribute('transform', `translate(${p.sx.toFixed(1)}, ${p.sy.toFixed(1)})`)
        } else {
          el.style.opacity = '0'
          el.style.display = 'none'
        }
      }

      // Raycast hover check when idle
      if (lastMouseRef.current && !dragRef.current.active && !targetingRef.current?.active) {
        const m = lastMouseRef.current
        const localX = cx + (m.x - cx) / currentZoom
        const localY = cy + (m.y - cy) / currentZoom
        const ll = unproject(localX, localY, lambda, phi, gamma, baseR, cx, cy)
        if (ll) {
          const c = findCountryAt(ll.lng, ll.lat, countryIndex)
          if (c) {
            if (!hoveredCountry || hoveredCountry.code !== c.id) {
              setHoveredCountry({ screenX: m.x, screenY: m.y, name: c.name, code: c.id })
            }
          } else if (hoveredCountry) {
            setHoveredCountry(null)
          }
        } else if (hoveredCountry) {
          setHoveredCountry(null)
        }
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [countryIndex, baseR, cx, cy, W, H, onSelectRegion, hoveredCountry])

  // Sync fills for tactical highlights
  useEffect(() => {
    for (const c of countryIndex) {
      const el = pathRefs.current.get(c.id)
      if (!el) continue
      const isHovered = hoveredCountry?.code === c.id
      const isTargeted = isAcquiring === 'india' ? c.id === 'IND' : isAcquiring === 'usa' ? c.id === 'USA' : false

      let fill = '#23282d'
      if (isTargeted) {
        fill = c.id === 'IND' ? '#28A6A1' : '#398DB5'
      } else if (c.id === 'IND') {
        fill = isHovered ? '#28A6A1' : '#1e383a'
      } else if (c.id === 'USA') {
        fill = isHovered ? '#398DB5' : '#1c3444'
      } else if (isHovered) {
        fill = '#4a535b'
      }
      el.setAttribute('fill', fill)
    }
  }, [countryIndex, hoveredCountry, isAcquiring])

  // Pointer Interaction
  const localMouse = (e: React.PointerEvent) => {
    const r = containerRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (targetingRef.current?.active) return
    const m = localMouse(e)
    const dx = m.x - cx
    const dy = m.y - cy
    const effectiveR = baseR * zoomRef.current
    if (dx * dx + dy * dy > (effectiveR + 24) * (effectiveR + 24)) return

    dragRef.current = {
      active: true,
      startX: m.x,
      startY: m.y,
      startLambda: rotRef.current.lambda,
      startPhi: rotRef.current.phi,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const m = localMouse(e)
    lastMouseRef.current = m

    if (dragRef.current.active) {
      const sens = 0.38 / zoomRef.current
      const dx = m.x - dragRef.current.startX
      const dy = m.y - dragRef.current.startY
      rotRef.current.lambda = dragRef.current.startLambda - dx * sens
      rotRef.current.phi = clamp(dragRef.current.startPhi + dy * sens, -85, 85)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.active) {
      const m = localMouse(e)
      const dist = Math.hypot(m.x - dragRef.current.startX, m.y - dragRef.current.startY)
      dragRef.current.active = false
      userInteractedRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()

      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {}

      // If already targeting and user clicks again, complete transition immediately
      if (dist < 6 && targetingRef.current?.active) {
        const anim = targetingRef.current
        targetingRef.current = null
        onSelectRegion(anim.region)
        return
      }

      // If user performed a click without dragging, detect clicked region
      if (dist < 6 && !targetingRef.current?.active) {
        const { lambda, phi, gamma } = rotRef.current
        const currentZoom = zoomRef.current

        let targetRegion: RegionType | null = null

        // 1. Check tactical markers first
        for (const tm of TACTICAL_MARKERS) {
          const p = project(tm.longitude, tm.latitude, lambda, phi, gamma, baseR, cx, cy)
          if (p.v) {
            const sx = cx + (p.sx - cx) * currentZoom
            const sy = cy + (p.sy - cy) * currentZoom
            if (Math.hypot(m.x - sx, m.y - sy) < 40) {
              targetRegion = tm.region
              break
            }
          }
        }

        // 2. Check unprojected geographic location on globe surface
        if (!targetRegion) {
          const localX = cx + (m.x - cx) / currentZoom
          const localY = cy + (m.y - cy) / currentZoom
          const ll = unproject(localX, localY, lambda, phi, gamma, baseR, cx, cy)
          if (ll) {
            const c = findCountryAt(ll.lng, ll.lat, countryIndex)
            if (c) {
              if (c.id === 'IND') targetRegion = 'india'
              else if (c.id === 'USA') targetRegion = 'usa'
            } else {
              // Precise bounding box fallback
              if (ll.lng >= 68 && ll.lng <= 98 && ll.lat >= 6 && ll.lat <= 38) {
                targetRegion = 'india'
              } else if (ll.lng >= -125 && ll.lng <= -66 && ll.lat >= 24 && ll.lat <= 50) {
                targetRegion = 'usa'
              }
            }
          }
        }

        // 3. Fallback to hovered state if active
        if (!targetRegion) {
          if (hoveredMarker) {
            targetRegion = hoveredMarker.region
          } else if (hoveredCountry?.code === 'IND') {
            targetRegion = 'india'
          } else if (hoveredCountry?.code === 'USA') {
            targetRegion = 'usa'
          }
        }

        if (targetRegion) {
          triggerFlyIn(targetRegion)
        }
      }
    }
  }

  // Mouse wheel scroll to zoom
  const onWheel = (e: React.WheelEvent) => {
    if (targetingRef.current?.active) return
    e.preventDefault()
    const zoomDelta = -e.deltaY * 0.0015
    zoomRef.current = clamp(zoomRef.current + zoomDelta, 0.75, 3.2)
    userInteractedRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
  }

  const onPointerLeave = () => {
    lastMouseRef.current = null
    if (!dragRef.current.active) {
      setHoveredCountry(null)
      setHoveredMarker(null)
    }
  }

  // Unique SVG IDs using React useId
  const fG = 'g' + uid
  const fL = 'l' + uid
  const gO = 'o' + uid
  const gShade = 's' + uid
  const gAtm = 'a' + uid
  const clipDisc = 'c' + uid

  const oceanColor = '#111417'
  const landFill = '#23282d'
  const landStroke = '#4d555d'
  const glowColor = '#7ec8ff'
  const glowIntensity = 0.35

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      className="relative w-full h-full min-h-[620px] overflow-hidden select-none bg-[#0a0c0e] text-[#e7ece9] font-mono"
    >
      {/* Styles for pulse radar pin animations */}
      <style>{`
        .mm-pulse {
          animation: mm-pulse 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes mm-pulse {
          0% { transform: scale(1); opacity: 0.85; }
          70% { transform: scale(2.4); opacity: 0.0; }
          100% { transform: scale(2.4); opacity: 0.0; }
        }
        .mm-c {
          transition: fill 180ms ease, filter 180ms ease;
        }
        .mm-c:hover {
          filter: brightness(1.25);
        }
      `}</style>

      {/* Top Tactical HUD Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-[#0a0c0e]/90 via-[#0a0c0e]/40 to-transparent pointer-events-none">
        <div />

        {/* Live Coordinate Telemetry */}
        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-[#8C9BA5] bg-[#121417]/80 border border-[#39424c]/40 rounded-lg px-3 py-1.5 backdrop-blur-sm">
          <Compass className="w-3.5 h-3.5 text-[#7ec8ff] animate-spin" style={{ animationDuration: '12s' }} />
          <span ref={coordsReadoutRef}>LAT: 20.0° | LON: -40.0° | ZOOM: 1.00x</span>
        </div>

        {/* Skip to Dashboard Button */}
        {onSkipIntro && (
          <button
            onClick={onSkipIntro}
            className="pointer-events-auto text-xs px-3.5 py-1.5 rounded-lg border border-[#39424c] bg-[#171a1e]/80 hover:bg-[#23282d] text-[#d8ddd9] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>Skip to Overview</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#7ec8ff]" />
          </button>
        )}
      </div>

      {/* Main SVG Render Surface */}
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        className="block w-full h-full cursor-grab active:cursor-grabbing will-change-transform"
      >
        <defs>
          <filter id={fG} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id={fL} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.16 0" />
          </filter>

          {/* Spherical lighting & shadow */}
          <radialGradient id={gShade} cx="38%" cy="32%" r="78%">
            <stop offset="0%" stopColor={rgba('#ffffff', 0.14)} />
            <stop offset="55%" stopColor={rgba('#ffffff', 0)} />
            <stop offset="92%" stopColor={rgba('#000000', 0.35)} />
            <stop offset="100%" stopColor={rgba('#000000', 0.65)} />
          </radialGradient>

          {/* Atmosphere halo glow */}
          <radialGradient id={gAtm} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={rgba(glowColor, 0)} />
            <stop offset={`${((baseR / (baseR + 60)) * 100).toFixed(1)}%`} stopColor={rgba(glowColor, 0)} />
            <stop offset={`${(((baseR + 8) / (baseR + 60)) * 100).toFixed(1)}%`} stopColor={rgba(glowColor, 0.45 * glowIntensity)} />
            <stop offset="100%" stopColor={rgba(glowColor, 0)} />
          </radialGradient>

          {/* Ocean depth texture */}
          <linearGradient id={gO} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={rgba('#2c3137', 0.35)} />
            <stop offset="50%" stopColor={rgba('#171a1e', 0.08)} />
            <stop offset="100%" stopColor={rgba('#0f1114', 0.32)} />
          </linearGradient>

          {/* Disc clipping mask */}
          <clipPath id={clipDisc}>
            <circle cx={cx} cy={cy} r={baseR} />
          </clipPath>
        </defs>

        {/* Starfield */}
        {stars.map((s, i) => (
          <circle key={`s${i}`} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} fill={rgba('#ffffff', s.o)} />
        ))}

        {/* Interactive Globe Group with Transform */}
        <g ref={globeGroupRef}>
          {/* Atmosphere Halo */}
          <circle cx={cx} cy={cy} r={baseR + 60} fill={`url(#${gAtm})`} pointerEvents="none" />

          {/* Ocean Base Spheres */}
          <circle cx={cx} cy={cy} r={baseR} fill={oceanColor} />
          <circle cx={cx} cy={cy} r={baseR} fill={`url(#${gO})`} />

          {/* Continent Landmasses & Graticule Clipped to Planetary Horizon */}
          <g clipPath={`url(#${clipDisc})`}>
            {/* Ambient land shadow */}
            <g opacity={0.08} filter={`url(#${fL})`}>
              {countryIndex.map((c) => (
                <path
                  key={`ghost-${c.id}`}
                  ref={(el) => {
                    if (el) ghostPathRefs.current.set(c.id, el)
                    else ghostPathRefs.current.delete(c.id)
                  }}
                  fill={landFill}
                  stroke="none"
                  pointerEvents="none"
                />
              ))}
            </g>

            {/* Latitude/Longitude Graticule Grid */}
            <path
              ref={gridPathRef}
              fill="none"
              stroke="#5b636a"
              strokeWidth={0.5}
              strokeOpacity={0.2}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />

            {/* Rendered Country Polygons */}
            {countryIndex.map((c) => (
              <path
                key={c.id}
                ref={(el) => {
                  if (el) pathRefs.current.set(c.id, el)
                  else pathRefs.current.delete(c.id)
                }}
                className="mm-c"
                fill={c.id === 'IND' ? '#1e383a' : c.id === 'USA' ? '#1c3444' : landFill}
                stroke={c.id === 'IND' ? '#28A6A1' : c.id === 'USA' ? '#398DB5' : landStroke}
                strokeWidth={c.id === 'IND' || c.id === 'USA' ? 1.0 : 0.5}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: c.id === 'IND' || c.id === 'USA' ? 'pointer' : 'default' }}
                onClick={() => {
                  if (c.id === 'IND') triggerFlyIn('india')
                  else if (c.id === 'USA') triggerFlyIn('usa')
                }}
              />
            ))}
          </g>

          {/* Spherical Specular & Terminator Shading */}
          <circle cx={cx} cy={cy} r={baseR} fill={`url(#${gShade})`} pointerEvents="none" />

          {/* Limb Border Glow Outline */}
          <circle
            cx={cx}
            cy={cy}
            r={baseR}
            fill="none"
            stroke={rgba(glowColor, 0.4 * glowIntensity)}
            strokeWidth={1}
            pointerEvents="none"
          />

          {/* Tactical Markers for USA and India */}
          {TACTICAL_MARKERS.map((m, i) => {
            const sz = 6
            const col = m.color
            return (
              <g
                key={`marker-${m.id}`}
                ref={(el) => {
                  if (el) markerRefs.current.set(i, el)
                  else markerRefs.current.delete(i)
                }}
                className="cursor-pointer transition-transform duration-100"
                style={{ opacity: 0 }}
                onClick={(e) => {
                  e.stopPropagation()
                  triggerFlyIn(m.region)
                }}
                onMouseEnter={() => setHoveredMarker(m)}
                onMouseLeave={() => setHoveredMarker(null)}
              >
                {/* Expanding Pulse Ring */}
                <circle className="mm-pulse" r={sz * 2.4} fill={rgba(col, 0.55)} />
                {/* Secondary Ping Wave */}
                <circle r={sz * 3.4} fill={rgba(col, 0.12)} stroke={rgba(col, 0.3)} strokeWidth={0.7} />
                {/* Inner Core */}
                <circle r={sz} fill={col} />
                <circle cx={-sz * 0.3} cy={-sz * 0.3} r={sz * 0.35} fill={rgba('#ffffff', 0.8)} />

                {/* Tactical Marker Callout Tag */}
                <text
                  x={sz * 2.5}
                  y={sz * 0.4 + 1}
                  fill="#e7ece9"
                  fontSize={10}
                  fontWeight={700}
                  letterSpacing="0.05em"
                  stroke={oceanColor}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  className="pointer-events-none select-none drop-shadow-md uppercase"
                >
                  {m.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Targeting In-Flight Reticle Overlay */}
      {isAcquiring && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-black/30 backdrop-blur-[2px] transition-all duration-300">
          <div className="w-48 h-48 border border-[#7ec8ff]/40 rounded-full flex items-center justify-center animate-pulse">
            <div className="w-40 h-40 border border-dashed border-[#7ec8ff]/60 rounded-full animate-spin" style={{ animationDuration: '6s' }} />
            <div className="absolute w-4 h-4 border-t-2 border-l-2 border-[#28A6A1] -top-1 -left-1" />
            <div className="absolute w-4 h-4 border-t-2 border-r-2 border-[#28A6A1] -top-1 -right-1" />
            <div className="absolute w-4 h-4 border-b-2 border-l-2 border-[#28A6A1] -bottom-1 -left-1" />
            <div className="absolute w-4 h-4 border-b-2 border-r-2 border-[#28A6A1] -bottom-1 -right-1" />
          </div>
          <div className="mt-4 text-xs font-mono font-bold tracking-widest text-[#7ec8ff] uppercase bg-[#0a0c0e]/80 border border-[#39424c] px-4 py-1.5 rounded-full shadow-lg">
            TARGETING {isAcquiring === 'india' ? 'INDIA SECTOR' : 'USGS BASIN NETWORK'}...
          </div>
        </div>
      )}

      {/* Floating Tactical Tooltip */}
      {hoveredMarker && (
        <div
          className="absolute z-30 pointer-events-none bg-[#121417]/95 border border-[#39424c] rounded-xl p-3 shadow-2xl backdrop-blur-md max-w-xs transition-opacity duration-150"
          style={{
            left: cx + 20,
            top: cy - 70,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: hoveredMarker.color }}
            />
            <span className="text-xs font-bold text-[#e7ece9] tracking-wider uppercase">
              {hoveredMarker.label}
            </span>
          </div>
          <p className="text-[11px] text-[#8C9BA5] leading-relaxed mb-2">
            {hoveredMarker.description}
          </p>
          <div className="text-[10px] font-mono text-[#7ec8ff] flex items-center gap-1 font-semibold">
            <span>Click marker or button to enter 3D terrain</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      )}

      {/* Country Hover Tooltip (When hovering non-marker landmass) */}
      {!hoveredMarker && hoveredCountry && (
        <div
          className="absolute z-30 pointer-events-none bg-[#121417]/90 border border-[#39424c]/70 rounded-lg px-3 py-1.5 shadow-xl backdrop-blur-sm transition-all duration-75 text-xs"
          style={{
            left: hoveredCountry.screenX + 16,
            top: hoveredCountry.screenY - 24,
          }}
        >
          <div className="font-bold text-[#e7ece9] flex items-center gap-1.5">
            <span>{hoveredCountry.name}</span>
            <span className="text-[10px] text-[#526573] font-mono">[{hoveredCountry.code}]</span>
          </div>
          <div className="text-[10px] text-[#8C9BA5] mt-0.5">
            {hoveredCountry.code === 'IND'
              ? 'Click to inspect India catchment prototype'
              : hoveredCountry.code === 'USA'
              ? 'Click to inspect 22 USGS catchments'
              : 'Standby zone • No hydrological telemetry'}
          </div>
        </div>
      )}

      {/* Bottom Command Dock */}
      <div className="absolute bottom-5 left-0 right-0 z-20 flex flex-col sm:flex-row items-center justify-between px-6 gap-3 pointer-events-none">
        {/* Fast Sector Selectors */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => triggerFlyIn('india')}
            disabled={isAcquiring !== null}
            className="cursor-pointer text-xs font-mono font-bold px-4 py-2 rounded-xl bg-[#121417]/90 border border-[#28A6A1]/50 hover:border-[#28A6A1] hover:bg-[#28A6A1]/10 text-[#d8ddd9] transition-all flex items-center gap-2 shadow-lg backdrop-blur-sm group"
          >
            <span className="w-2 h-2 rounded-full bg-[#28A6A1] group-hover:scale-125 transition-transform" />
            <span>INDIA</span>
            <span className="text-[10px] text-[#28A6A1] bg-[#28A6A1]/20 px-1.5 py-0.5 rounded">PROTOTYPE</span>
          </button>

          <button
            onClick={() => triggerFlyIn('usa')}
            disabled={isAcquiring !== null}
            className="cursor-pointer text-xs font-mono font-bold px-4 py-2 rounded-xl bg-[#121417]/90 border border-[#398DB5]/50 hover:border-[#398DB5] hover:bg-[#398DB5]/10 text-[#d8ddd9] transition-all flex items-center gap-2 shadow-lg backdrop-blur-sm group"
          >
            <span className="w-2 h-2 rounded-full bg-[#398DB5] group-hover:scale-125 transition-transform" />
            <span>UNITED STATES</span>
            <span className="text-[10px] text-[#398DB5] bg-[#398DB5]/20 px-1.5 py-0.5 rounded">22 STATIONS</span>
          </button>
        </div>

        {/* Navigation Guidance Hints */}
        <div className="text-[11px] font-mono text-[#8C9BA5] bg-[#121417]/70 border border-[#39424c]/40 rounded-lg px-3 py-1.5 backdrop-blur-sm flex items-center gap-3">
          <span>Drag to orbit</span>
          <span className="text-[#39424c]">&bull;</span>
          <span>Scroll to zoom</span>
          <span className="text-[#39424c]">&bull;</span>
          <span className="text-[#7ec8ff]">Click active sector to explore 3D terrain</span>
        </div>
      </div>
    </div>
  )
}

export default TacticalGlobe3D
