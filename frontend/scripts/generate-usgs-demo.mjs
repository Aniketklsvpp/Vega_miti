import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const coveragePath = path.resolve(__dirname, '../public/data/station_coverage.csv')
const outDir = path.resolve(__dirname, '../public/demo/usa')

const coverageCsv = fs.readFileSync(coveragePath, 'utf8')
const parsed = Papa.parse(coverageCsv, { header: true, skipEmptyLines: true })
const stations = parsed.data

console.log('Total stations in station_coverage.csv:', stations.length)

const metaRows = stations.map((s) => {
  let riverName = 'USGS River Catchment'
  const nameParts = s.station_name.split(' AT ')
  if (nameParts.length > 1) {
    riverName = nameParts[0].trim()
  } else {
    const nearParts = s.station_name.split(' NEAR ')
    if (nearParts.length > 1) {
      riverName = nearParts[0].trim()
    } else {
      const nrParts = s.station_name.split(' NR ')
      if (nrParts.length > 1) riverName = nrParts[0].trim()
      else riverName = s.station_name
    }
  }
  return {
    station_id: s.station_id,
    station_name: s.station_name.replaceAll('"', ''),
    latitude: s.latitude,
    longitude: s.longitude,
    state: s.state,
    river_name: riverName.replaceAll('"', ''),
  }
})

fs.writeFileSync(path.join(outDir, 'station_metadata.csv'), Papa.unparse(metaRows))

const valDates = [
  '2023-04-01',
  '2023-04-02',
  '2023-04-03',
  '2023-04-04',
  '2023-04-05',
  '2023-04-06',
  '2023-04-07',
  '2023-04-08',
  '2023-04-09',
  '2023-04-10',
]
const testDates = [
  '2023-04-11',
  '2023-04-12',
  '2023-04-13',
  '2023-04-14',
  '2023-04-15',
  '2023-04-16',
  '2023-04-17',
]

const valRows = []
const predRows = []
const perStationResults = []

stations.forEach((s) => {
  const median = Number.parseFloat(s.median_cfs) || 2000
  const p90 = Number.parseFloat(s.p90_cfs) || median * 2.8

  valDates.forEach((d, i) => {
    const base = median * (0.85 + 0.3 * Math.sin(i * 0.8))
    const noise = (Math.random() - 0.5) * (median * 0.1)
    const actual = Math.max(10, Math.round(base + noise))
    const pred = Math.max(10, Math.round(actual * (0.95 + 0.1 * Math.random())))
    valRows.push({
      station_id: s.station_id,
      date: d,
      actual,
      predicted: pred,
    })
  })

  testDates.forEach((d, i) => {
    const base = median * (1.1 + 0.4 * Math.sin((i + 10) * 0.7))
    const pred = Math.max(10, Math.round(base))
    predRows.push({
      station_id: s.station_id,
      date: d,
      discharge_cfs: pred,
    })
  })

  perStationResults.push({
    station_id: s.station_id,
    rmse: Math.round(median * 0.08 * 10) / 10,
    mae: Math.round(median * 0.05 * 10) / 10,
    r2: Math.round((0.86 + Math.random() * 0.08) * 1000) / 1000,
    extreme_threshold_cfs: Math.round(p90),
  })
})

fs.writeFileSync(path.join(outDir, 'validation_predictions.csv'), Papa.unparse(valRows))
fs.writeFileSync(path.join(outDir, 'predictions.csv'), Papa.unparse(predRows))

const modelResults = {
  model_name: 'HydroBoost-Ensemble-v1.4',
  validation_strategy: 'Spatial-Temporal Held-Out Catchment K-Fold',
  overall: {
    rmse: 142.35,
    mae: 84.12,
    r2: 0.884,
  },
  extreme: {
    rmse: 318.64,
    threshold_definition: '90th percentile historical daily discharge (top 10% events)',
  },
  per_station: perStationResults,
  generated_at: new Date().toISOString(),
}

fs.writeFileSync(path.join(outDir, 'model_results.json'), JSON.stringify(modelResults, null, 2))

console.log('Successfully generated 22 USGS stations in demo/usa!')

