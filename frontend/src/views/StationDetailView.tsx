import React from 'react'
import type { EnrichedStation, PredictionRow, ValidationPredictionRow } from '../types/data'
import { Hydrograph } from '../components/station/Hydrograph'
import { Award, Droplet, Flame, Gauge, MapPin } from 'lucide-react'

interface StationDetailViewProps {
  stations: EnrichedStation[]
  selectedStationId: string | null
  onSelectStation: (id: string) => void
  predictions: PredictionRow[]
  validationPredictions: ValidationPredictionRow[]
}

export const StationDetailView: React.FC<StationDetailViewProps> = ({
  stations,
  selectedStationId,
  onSelectStation,
  predictions,
  validationPredictions,
}) => {
  const currentStation = stations.find((s) => s.station_id === selectedStationId) || stations[0]

  if (!currentStation) {
    return <div className="text-slate-400 p-8 text-center font-mono">No stations available.</div>
  }

  const stationValRows = validationPredictions.filter((r) => r.station_id === currentStation.station_id)
  const stationPredRows = predictions.filter((r) => r.station_id === currentStation.station_id)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
              {currentStation.station_id}
            </span>
            {currentStation.isExtreme && (
              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800/60 text-[10px] font-mono font-bold flex items-center gap-1">
                <Flame className="w-3 h-3" /> EXTREME DISCHARGE REACHED
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight mt-1">{currentStation.station_name}</h1>
          <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>{currentStation.river_name || 'River Basin'}, {currentStation.state}</span>
            <span className="text-slate-600">|</span>
            <span className="font-mono text-slate-400">
              {currentStation.latitude.toFixed(4)}°N, {Math.abs(currentStation.longitude).toFixed(4)}°W
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="station-select" className="text-xs font-mono text-slate-400">Station:</label>
          <select
            id="station-select"
            value={currentStation.station_id}
            onChange={(e) => onSelectStation(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-cyan-500"
          >
            {stations.map((s) => (
              <option key={s.station_id} value={s.station_id}>
                {s.station_id} — {s.station_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase">Current Estimate</span>
            <Droplet className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {currentStation.currentDischarge?.toFixed(1) ?? 'N/A'} cfs
          </div>
        </div>

        <div className="bg-slate-900/80 border border-rose-950/50 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase text-rose-300">Extreme Cutoff</span>
            <Flame className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">
            {currentStation.metrics?.extreme_threshold_cfs.toFixed(0) ?? 'N/A'} cfs
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase">Validation RMSE</span>
            <Gauge className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {currentStation.metrics?.rmse.toFixed(1) ?? 'N/A'} cfs
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase">Validation R²</span>
            <Award className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-300">
            {currentStation.metrics?.r2.toFixed(3) ?? 'N/A'}
          </div>
        </div>
      </div>

      <Hydrograph
        stationName={currentStation.station_name}
        stationId={currentStation.station_id}
        validationRows={stationValRows}
        predictionRows={stationPredRows}
        extremeThreshold={currentStation.metrics?.extreme_threshold_cfs}
      />
    </div>
  )
}
