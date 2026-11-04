import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, '../../outputs')
const destDir = path.resolve(__dirname, '../public/data')

if (!fs.existsSync(srcDir)) {
  process.exit(0)
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true })
}

const files = fs.readdirSync(srcDir)
for (const file of files) {
  const srcPath = path.join(srcDir, file)
  const destPath = path.join(destDir, file)
  if (fs.statSync(srcPath).isFile()) {
    fs.copyFileSync(srcPath, destPath)
  }
}

