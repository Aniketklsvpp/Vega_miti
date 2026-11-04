import Papa from 'papaparse'
import type {
  AppDataPayload,
  EnrichedStation,
  ModelResults,
  PredictionRow,
  StationMetadata,
  ValidationPredictionRow,
} from '../types/data'
import { validateCsvColumns, validateModelResults } from './validators'

async function tryFetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function tryFetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function loadRiverIntelligenceData(): Promise<
  { success: true; payload: AppDataPayload } | { success: false; error: string; missingField?: string; file?: string }
> {
  let isDemo = false
  let metaRaw = await tryFetchText('/data/station_metadata.csv')
  let predRaw = await tryFetchText('/data/predictions.csv')
  let valRaw = await tryFetchText('/data/validation_predictions.csv')
  let modelRaw = await tryFetchJson('/data/model_results.json')

  if (!metaRaw || !predRaw || !valRaw || !modelRaw) {
    isDemo = true
    metaRaw = await tryFetchText('/demo/station_metadata.csv')
    predRaw = await tryFetchText('/demo/predictions.csv')
    valRaw = await tryFetchText('/demo/validation_predictions.csv')
    modelRaw = await tryFetchJson('/demo/model_results.json')
  }

  const prefix = isDemo ? '/demo/' : '/data/'

  if (!metaRaw) {
    return { success: false, error: `Could not load ${prefix}station_metadata.csv`, file: 'station_metadata.csv' }
  }
  if (!predRaw) {
    return { success: false, error: `Could not load ${prefix}predictions.csv`, file: 'predictions.csv' }
  }
  if (!valRaw) {
    return { success: false, error: `Could not load ${prefix}validation_predictions.csv`, file: 'validation_predictions.csv' }
  }
  if (!modelRaw) {
    return { success: false, error: `Could not load ${prefix}model_results.json`, file: 'model_results.json' }
  }

  const metaParsed = Papa.parse<Record<string, string>>(metaRaw.trim(), { header: true, skipEmptyLines: true })
  const metaVal = validateCsvColumns('station_metadata.csv', metaParsed.meta.fields || [], [
    'station_id',
    'station_name',
    'latitude',
    'longitude',
    'state',
    'river_name',
  ])
  if (!metaVal.valid) {
    return { success: false, error: metaVal.error, missingField: metaVal.missingField, file: 'station_metadata.csv' }
  }

  const predParsed = Papa.parse<Record<string, string>>(predRaw.trim(), { header: true, skipEmptyLines: true })
  const predVal = validateCsvColumns('predictions.csv', predParsed.meta.fields || [], [
    'station_id',
    'date',
    'discharge_cfs',
  ])
  if (!predVal.valid) {
    return { success: false, error: predVal.error, missingField: predVal.missingField, file: 'predictions.csv' }
  }

  const valParsed = Papa.parse<Record<string, string>>(valRaw.trim(), { header: true, skipEmptyLines: true })
  const valVal = validateCsvColumns('validation_predictions.csv', valParsed.meta.fields || [], [
    'station_id',
    'date',
    'actual',
    'predicted',
  ])
  if (!valVal.valid) {
    return {
      success: false,
      error: valVal.error,
      missingField: valVal.missingField,
      file: 'validation_predictions.csv',
    }
  }

  const modelVal = validateModelResults('model_results.json', modelRaw)
  if (!modelVal.valid) {
    return { success: false, error: modelVal.error, missingField: modelVal.missingField, file: 'model_results.json' }
  }

  const modelResults: ModelResults = modelVal.data
  const metadataMap = new Map<string, StationMetadata>()

  for (const row of metaParsed.data) {
    if (!row.station_id) continue
    metadataMap.set(row.station_id.trim(), {
      station_id: row.station_id.trim(),
      station_name: (row.station_name || row.station_id).trim(),
      latitude: Number.parseFloat(row.latitude) || 0,
      longitude: Number.parseFloat(row.longitude) || 0,
      state: (row.state || '').trim(),
      river_name: (row.river_name || '').trim(),
    })
  }

  const predictions: PredictionRow[] = []
  for (const row of predParsed.data) {
    if (!row.station_id || !row.date) continue
    predictions.push({
      station_id: row.station_id.trim(),
      date: row.date.trim(),
      discharge_cfs: Number.parseFloat(row.discharge_cfs) || 0,
    })
  }

  const validationPredictions: ValidationPredictionRow[] = []
  for (const row of valParsed.data) {
    if (!row.station_id || !row.date) continue
    validationPredictions.push({
      station_id: row.station_id.trim(),
      date: row.date.trim(),
      actual: Number.parseFloat(row.actual) || 0,
      predicted: Number.parseFloat(row.predicted) || 0,
    })
  }

  const latestPredByStation = new Map<string, number>()
  for (const p of predictions) {
    latestPredByStation.set(p.station_id, p.discharge_cfs)
  }

  const stationMetricMap = new Map<string, (typeof modelResults.per_station)[0]>()
  for (const sm of modelResults.per_station) {
    stationMetricMap.set(sm.station_id, sm)
  }

  const currentValues = Array.from(latestPredByStation.values()).sort((a, b) => a - b)

  const stations: EnrichedStation[] = Array.from(metadataMap.values()).map((meta) => {
    const curDischarge = latestPredByStation.get(meta.station_id) ?? 0
    const metric = stationMetricMap.get(meta.station_id)
    const extremeThreshold = metric?.extreme_threshold_cfs ?? Number.POSITIVE_INFINITY
    const isExtreme = curDischarge >= extremeThreshold

    let percentileRank = 0
    if (currentValues.length > 0) {
      const idx = currentValues.indexOf(curDischarge)
      percentileRank = Math.round(((idx + 1) / currentValues.length) * 100)
    }

    return {
      ...meta,
      metrics: metric,
      currentDischarge: curDischarge,
      percentileRank,
      isExtreme,
    }
  })

  return {
    success: true,
    payload: {
      isDemo,
      stations,
      metadataMap,
      predictions,
      validationPredictions,
      modelResults,
    },
  }
}
