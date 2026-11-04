import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../')
const srcOutputs = path.resolve(rootDir, 'outputs')
const destDir = path.resolve(__dirname, '../public/data')

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true })
}

if (fs.existsSync(srcOutputs)) {
  const copyRecursive = (src, dest) => {
    if (!fs.existsSync(src)) return
    const entries = fs.readdirSync(src, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true })
        copyRecursive(srcPath, destPath)
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
  copyRecursive(srcOutputs, destDir)
}

const coverageSrc = path.join(srcOutputs, 'data_reports/station_coverage.csv')
if (fs.existsSync(coverageSrc)) {
  fs.copyFileSync(coverageSrc, path.join(destDir, 'station_coverage.csv'))
}

const registrySrc = path.join(rootDir, 'data/metadata/station_registry.csv')
if (fs.existsSync(registrySrc) && !fs.existsSync(path.join(destDir, 'station_metadata.csv'))) {
  fs.copyFileSync(registrySrc, path.join(destDir, 'station_metadata.csv'))
}
