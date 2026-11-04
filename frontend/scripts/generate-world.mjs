import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as topojson from 'topojson-client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const atlasPath = path.resolve(__dirname, '../node_modules/world-atlas/countries-110m.json')
const destPath = path.resolve(__dirname, '../public/assets/geo/world-countries.json')

const topology = JSON.parse(fs.readFileSync(atlasPath, 'utf8'))
const geojson = topojson.feature(topology, topology.objects.countries)

const countryNames = {
  '840': 'United States',
  '356': 'India',
}

for (const feature of geojson.features) {
  const id = String(feature.id)
  feature.properties = {
    ...feature.properties,
    id,
    name: countryNames[id] || feature.properties?.name || `Country ${id}`,
    hasData: id === '840' || id === '356',
    status: id === '840' ? 'active' : id === '356' ? 'prototype' : 'none',
  }
}

fs.writeFileSync(destPath, JSON.stringify(geojson))

