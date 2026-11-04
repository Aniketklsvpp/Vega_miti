import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cesiumSrc = path.resolve(__dirname, '../node_modules/cesium/Build/Cesium')
const cesiumDest = path.resolve(__dirname, '../public/cesium')

if (!fs.existsSync(cesiumDest)) {
  fs.mkdirSync(cesiumDest, { recursive: true })
}

const copyDir = (src, dest) => {
  if (!fs.existsSync(src)) return
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

for (const dir of ['Assets', 'ThirdParty', 'Widgets', 'Workers']) {
  copyDir(path.join(cesiumSrc, dir), path.join(cesiumDest, dir))
}

