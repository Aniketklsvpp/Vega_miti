export type RegionType = 'usa' | 'india'
export type SceneType = 'globe' | 'map'
export type AnalysisTab = 'map' | 'station' | 'trust' | 'spotlight'

export interface StationMetadata {
  station_id: string
  station_name: string
  latitude: number
  longitude: number
  state: string
  river_name: string
}

export interface PredictionRow {
  station_id: string
  date: string
  discharge_cfs: number
}

export interface ValidationPredictionRow {
  station_id: string
  date: string
  actual: number
  predicted: number
}

export interface StationModelResult {
  station_id: string
  rmse: number
  mae: number
  r2: number
  extreme_threshold_cfs: number
}

export interface ModelResults {
  model_name: string
  validation_strategy: string
  overall: {
    rmse: number
    mae: number
    r2: number
  }
  extreme: {
    rmse: number
    threshold_definition: string
  }
  per_station: StationModelResult[]
  generated_at: string
}

export interface EnrichedStation extends StationMetadata {
  metrics?: StationModelResult
  currentDischarge?: number
  percentileRank?: number
  isExtreme?: boolean
}

export interface AppDataPayload {
  region: RegionType
  isDemo: boolean
  isPrototype: boolean
  stations: EnrichedStation[]
  metadataMap: Map<string, StationMetadata>
  predictions: PredictionRow[]
  validationPredictions: ValidationPredictionRow[]
  modelResults: ModelResults
}

export type AdapterStatus =
  | { status: 'loading' }
  | { status: 'error'; message: string; missingField?: string; file?: string }
  | { status: 'ready'; data: AppDataPayload }
