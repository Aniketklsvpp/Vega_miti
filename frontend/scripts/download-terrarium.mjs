import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'
import { PNG } from 'pngjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/assets/terrain')

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          return
        }
        const chunks = []
        res.on('data', (d) => chunks.push(d))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      })
      .on('error', reject)
  })
}

function lonToTileX(lon, z) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z))
}

function latToTileY(lat, z) {
  const rad = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * Math.pow(2, z))
}

function tileXToLon(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180
}

function tileYToLat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

function decodeElevation(r, g, b) {
  return r * 256 + g + b / 256 - 32768
}

async function processRegion(name, bounds, zoom) {
  console.log(`\n=== Processing ${name} at zoom ${zoom} ===`)
  const minX = lonToTileX(bounds.minLon, zoom)
  const maxX = lonToTileX(bounds.maxLon, zoom)
  const minY = latToTileY(bounds.maxLat, zoom) // top
  const maxY = latToTileY(bounds.minLat, zoom) // bottom

  const cols = maxX - minX + 1
  const rows = maxY - minY + 1
  console.log(`Tiles grid: ${cols} cols x ${rows} rows (${cols * rows} tiles)`)

  const actualBounds = {
    minLon: tileXToLon(minX, zoom),
    maxLon: tileXToLon(maxX + 1, zoom),
    maxLat: tileYToLat(minY, zoom),
    minLat: tileYToLat(maxY + 1, zoom),
  }

  const outWidth = cols * 256
  const outHeight = rows * 256

  const rawElevationGrid = new Float32Array(outWidth * outHeight)
  let minElev = Number.POSITIVE_INFINITY
  let maxElev = Number.NEGATIVE_INFINITY
  let successCount = 0

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileX = minX + c
      const tileY = minY + r
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${tileX}/${tileY}.png`

      try {
        const buf = await fetchBuffer(url)
        const png = PNG.sync.read(buf)
        successCount++

        for (let py = 0; py < 256; py++) {
          for (let px = 0; px < 256; px++) {
            const srcIdx = (py * 256 + px) * 4
            const rVal = png.data[srcIdx]
            const gVal = png.data[srcIdx + 1]
            const bVal = png.data[srcIdx + 2]
            const elev = Math.max(0, decodeElevation(rVal, gVal, bVal)) // clamp oceans to 0

            const destX = c * 256 + px
            const destY = r * 256 + py
            const destIdx = destY * outWidth + destX

            rawElevationGrid[destIdx] = elev
            if (elev < minElev) minElev = elev
            if (elev > maxElev) maxElev = elev
          }
        }
      } catch (err) {
        console.warn(`Tile failed (${tileX}, ${tileY}):`, err.message)
      }
    }
  }

  console.log(`Downloaded ${successCount}/${cols * rows} tiles. Elev range: ${minElev.toFixed(1)}m to ${maxElev.toFixed(1)}m`)

  if (minElev >= maxElev) {
    minElev = 0
    maxElev = 3000
  }

  const outPng = new PNG({ width: outWidth, height: outHeight })
  const elevRange = maxElev - minElev || 1

  for (let i = 0; i < outWidth * outHeight; i++) {
    const elev = rawElevationGrid[i]
    const norm = Math.max(0, Math.min(1, (elev - minElev) / elevRange))
    const byteVal = Math.round(norm * 255)

    const pixelIdx = i * 4
    outPng.data[pixelIdx] = byteVal     // R: normalized elevation
    outPng.data[pixelIdx + 1] = byteVal // G
    outPng.data[pixelIdx + 2] = byteVal // B
    outPng.data[pixelIdx + 3] = 255     // A
  }

  const pngPath = path.join(outDir, `${name.toLowerCase()}-heightmap.png`)
  fs.writeFileSync(pngPath, PNG.sync.write(outPng))
  console.log(`Saved heightmap: ${pngPath} (${outWidth}x${outHeight})`)

  return {
    source: 'Terrarium SRTM-derived AWS',
    isProcedural: false,
    bounds: actualBounds,
    elevation: {
      min: Math.round(minElev),
      max: Math.round(maxElev),
    },
    width: outWidth,
    height: outHeight,
    zoom,
  }
}

function generateProceduralFallback(name, bounds) {
  console.log(`Generating procedural fallback for ${name}...`)
  const width = 1024
  const height = 1024
  const outPng = new PNG({ width, height })

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width - 0.5
      const ny = y / height - 0.5
      const dist = Math.sqrt(nx * nx + ny * ny)

      const f1 = Math.sin(nx * 12 + ny * 8) * 0.5 + 0.5
      const f2 = Math.cos(nx * 24 - ny * 16) * 0.25 + 0.25
      const f3 = Math.sin(nx * 48 + ny * 36) * 0.125 + 0.125
      const mountains = Math.pow(f1 + f2 + f3, 2.2) * Math.max(0, 1 - dist * 1.8)

      const byteVal = Math.round(Math.max(0, Math.min(255, mountains * 255)))
      const idx = (y * width + x) * 4
      outPng.data[idx] = byteVal
      outPng.data[idx + 1] = byteVal
      outPng.data[idx + 2] = byteVal
      outPng.data[idx + 3] = 255
    }
  }

  const pngPath = path.join(outDir, `${name.toLowerCase()}-heightmap.png`)
  fs.writeFileSync(pngPath, PNG.sync.write(outPng))
  return {
    source: 'Stylised terrain (procedural)',
    isProcedural: true,
    bounds,
    elevation: { min: 0, max: 4500 },
    width,
    height,
  }
}

async function main() {
  const metadata = {}

  // 1. India: lat 6-37, lon 68-98 (zoom 5)
  try {
    metadata.india = await processRegion('india', { minLat: 6, maxLat: 37, minLon: 68, maxLon: 98 }, 5)
  } catch (e) {
    console.error('India download failed, using fallback:', e.message)
    metadata.india = generateProceduralFallback('india', { minLat: 6, maxLat: 37, minLon: 68, maxLon: 98 })
  }

  // 2. USA: lat 24-50, lon -125 to -66 (zoom 5)
  try {
    metadata.usa = await processRegion('usa', { minLat: 24, maxLat: 50, minLon: -125, maxLon: -66 }, 5)
  } catch (e) {
    console.error('USA download failed, using fallback:', e.message)
    metadata.usa = generateProceduralFallback('usa', { minLat: 24, maxLat: 50, minLon: -125, maxLon: -66 })
  }

  fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2))
  console.log('\nSaved terrain metadata:', path.join(outDir, 'metadata.json'))
}

main().catch(console.error)
