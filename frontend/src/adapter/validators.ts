import type { ModelResults } from '../types/data'

export function validateCsvColumns(
  filename: string,
  headers: string[],
  requiredColumns: string[]
): { valid: true } | { valid: false; error: string; missingField: string } {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase())
  for (const col of requiredColumns) {
    if (!normalizedHeaders.includes(col.toLowerCase())) {
      return {
        valid: false,
        missingField: col,
        error: `File ${filename} is missing required column: "${col}". Found: [${headers.join(', ')}]`,
      }
    }
  }
  return { valid: true }
}

export function validateModelResults(
  filename: string,
  data: unknown
): { valid: true; data: ModelResults } | { valid: false; error: string; missingField: string } {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      missingField: 'root',
      error: `File ${filename} did not contain a valid JSON object.`,
    }
  }

  const obj = data as Record<string, unknown>

  const requiredRootKeys = ['model_name', 'validation_strategy', 'overall', 'extreme', 'per_station', 'generated_at']
  for (const key of requiredRootKeys) {
    if (!(key in obj)) {
      return {
        valid: false,
        missingField: key,
        error: `File ${filename} is missing required root key: "${key}"`,
      }
    }
  }

  const overall = obj.overall as Record<string, unknown> | undefined
  if (!overall || typeof overall !== 'object') {
    return {
      valid: false,
      missingField: 'overall',
      error: `File ${filename} is missing object key: "overall"`,
    }
  }

  for (const metric of ['rmse', 'mae', 'r2']) {
    if (typeof overall[metric] !== 'number') {
      return {
        valid: false,
        missingField: `overall.${metric}`,
        error: `File ${filename} missing numeric key: "overall.${metric}"`,
      }
    }
  }

  const extreme = obj.extreme as Record<string, unknown> | undefined
  if (!extreme || typeof extreme.rmse !== 'number' || typeof extreme.threshold_definition !== 'string') {
    return {
      valid: false,
      missingField: 'extreme',
      error: `File ${filename} missing "extreme.rmse" (number) or "extreme.threshold_definition" (string)`,
    }
  }

  if (!Array.isArray(obj.per_station)) {
    return {
      valid: false,
      missingField: 'per_station',
      error: `File ${filename} expects "per_station" to be an array`,
    }
  }

  for (let i = 0; i < obj.per_station.length; i++) {
    const stn = obj.per_station[i] as Record<string, unknown>
    for (const stnKey of ['station_id', 'rmse', 'mae', 'r2', 'extreme_threshold_cfs']) {
      if (!(stnKey in stn)) {
        return {
          valid: false,
          missingField: `per_station[${i}].${stnKey}`,
          error: `File ${filename} per_station entry at index ${i} is missing "${stnKey}"`,
        }
      }
    }
  }

  return { valid: true, data: data as ModelResults }
}

