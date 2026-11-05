import type { ModelResults, StationModelResult } from '../types/data'

export type CsvValidationSuccess = {
  valid: true
  error?: never
  missingField?: never
}

export type CsvValidationFailure = {
  valid: false
  error: string
  missingField: string
}

export type CsvValidationResult = CsvValidationSuccess | CsvValidationFailure

export type ModelValidationSuccess = {
  valid: true
  data: ModelResults
  error?: never
  missingField?: never
}

export type ModelValidationFailure = {
  valid: false
  error: string
  missingField: string
  data?: never
}

export type ModelValidationResult = ModelValidationSuccess | ModelValidationFailure

export function validateCsvColumns(
  filename: string,
  headers: string[],
  requiredColumns: (string | string[])[]
): CsvValidationResult {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase())
  for (const colOption of requiredColumns) {
    const options = Array.isArray(colOption) ? colOption : [colOption]
    const matched = options.some((opt) => normalizedHeaders.includes(opt.toLowerCase()))
    if (!matched) {
      const primary = options[0]
      return {
        valid: false,
        missingField: primary,
        error: `File ${filename} is missing required column: "${primary}". Found: [${headers.join(', ')}]`,
      }
    }
  }
  return { valid: true }
}

export function validateModelResults(
  filename: string,
  data: unknown
): ModelValidationResult {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      missingField: 'root',
      error: `File ${filename} did not contain a valid JSON object.`,
    }
  }

  const obj = data as Record<string, any>

  if (obj.aggregate_metrics && obj.per_station_metrics) {
    const agg = obj.aggregate_metrics
    const perStation: StationModelResult[] = []

    for (const [stnId, metrics] of Object.entries(obj.per_station_metrics as Record<string, any>)) {
      perStation.push({
        station_id: stnId,
        rmse: Number(metrics.overall_rmse ?? metrics.rmse ?? 0),
        mae: Number(metrics.mae ?? 0),
        r2: Number(metrics.r2 ?? 0),
        extreme_threshold_cfs: Number(metrics.extreme_threshold_cfs ?? 1500),
      })
    }

    const normalized: ModelResults = {
      model_name: String(obj.model_name || 'ExtraTrees (Raw)'),
      validation_strategy: String(obj.validation_method || obj.validation_strategy || 'LeaveOneGroupOut'),
      overall: {
        rmse: Number(agg.overall_rmse ?? agg.rmse ?? 0),
        mae: Number(agg.mae ?? 0),
        r2: Number(agg.r2 ?? 0),
      },
      extreme: {
        rmse: Number(agg.extreme_rmse ?? 0),
        threshold_definition: String(
          obj.extreme?.threshold_definition || '90th percentile historical daily discharge (top 10% events)'
        ),
      },
      per_station: perStation,
      generated_at: String(obj.training_timestamp || obj.generated_at || new Date().toISOString()),
    }

    return { valid: true, data: normalized }
  }

  const requiredRootKeys = ['model_name', 'overall', 'extreme', 'per_station']
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
  if (!extreme || typeof extreme.rmse !== 'number') {
    return {
      valid: false,
      missingField: 'extreme.rmse',
      error: `File ${filename} missing "extreme.rmse" (number)`,
    }
  }

  if (!Array.isArray(obj.per_station)) {
    return {
      valid: false,
      missingField: 'per_station',
      error: `File ${filename} expects "per_station" to be an array`,
    }
  }

  return { valid: true, data: data as ModelResults }
}
