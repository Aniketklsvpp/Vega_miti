import React, { useState, useMemo } from 'react'
import type { EnrichedStation, PredictionRow, ValidationPredictionRow } from '../../types/data'
import { Hydrograph } from './Hydrograph'
import { DateScrubber } from './DateScrubber'
import { Award, ChevronLeft, Droplet, Flame, Gauge, MapPin } from 'lucide-react'

interface StationDetailPanelProps {
  station: EnrichedStation
  stations: EnrichedStation[]
  selectedStationId?: string | null
  onSelectStation: (id: string) => void
  onBackToMap: () => void
  validationRows: ValidationPredictionRow[]
  predictionRows: PredictionRow[]
}

export const StationDetailPanel: React.FC<StationDetailPanelProps> = ({
  station,
  stations,
  onSelectStation,
  onBackToMap,
  validationRows,
  predictionRows,
}) => {
  const stationValRows = useMemo(
    () => validationRows.filter((r) => r.station_id === station.station_id),
    [validationRows, station.station_id]
  )

  const stationPredRows = useMemo(
    () => predictionRows.filter((r) => r.station_id === station.station_id),
    [predictionRows, station.station_id]
  )

  const allDates = useMemo(() => {
    const dates = [
      ...stationValRows.map((r) => r.date),
      ...stationPredRows.map((r) => r.date),
    ]
    return Array.from(new Set(dates)).sort()
  }, [stationValRows, stationPredRows])

  const [scrubberIndex, setScrubberIndex] = useState<number>(
    Math.max(0, stationValRows.length - 1)
  )

  const selectedDate = allDates[scrubberIndex]
  const curVal = stationValRows.find((r) => r.date === selectedDate)
  const curPred = stationPredRows.find((r) => r.date === selectedDate)
  const dischargeValue = curVal?.predicted ?? curPred?.discharge_cfs ?? station.currentDischarge ?? 0
  const isExtremeAtDate = station.metrics
    ? dischargeValue >= station.metrics.extreme_threshold_cfs
    : false

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0f1420] border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMap}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
            title="Return to survey map"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Survey Map</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase">{station.station_id}</span>
              {station.isExtreme && (
                <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800/60 text-[10px] font-mono font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3" /> EXTREME DISCHARGE
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-100">{station.station_name}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>{station.river_name || 'Catchment Basin'}, {station.state}</span>
              <span className="text-slate-600">|</span>
              <span>{station.latitude.toFixed(4)}°N, {Math.abs(station.longitude).toFixed(4)}°W</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="station-dropdown" className="text-xs font-mono text-slate-400">Switch Station:</label>
          <select
            id="station-dropdown"
            value={station.station_id}
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
        <div className="bg-[#0f1420] border border-slate-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase">Current Discharge</span>
            <Droplet className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {station.currentDischarge?.toFixed(1) ?? 'N/A'} cfs
          </div>
          <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">Model Estimate</div>
        </div>

        <div className="bg-[#0f1420] border border-rose-950/60 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase text-rose-300">Extreme Cutoff (10%)</span>
            <Flame className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">
            {station.metrics?.extreme_threshold_cfs.toFixed(0) ?? 'N/A'} cfs
          </div>
          <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">90th %ile Threshold</div>
        </div>

        <div className="bg-[#0f1420] border border-slate-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase">Validation RMSE</span>
            <Gauge className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {station.metrics?.rmse.toFixed(1) ?? 'N/A'} cfs
          </div>
          <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">Held-Out Error</div>
        </div>

        <div className="bg-[#0f1420] border border-slate-800 rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-mono uppercase">Validation R²</span>
            <Award className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-300">
            {station.metrics?.r2.toFixed(3) ?? 'N/A'}
          </div>
          <div className="text-[10.5px] text-slate-500 font-mono mt-0.5">Goodness of Fit</div>
        </div>
      </div>

      <DateScrubber
        dates={allDates}
        selectedIndex={scrubberIndex}
        onSelectIndex={setScrubberIndex}
        currentActual={curVal?.actual ?? null}
        currentPredicted={curVal?.predicted ?? curPred?.discharge_cfs ?? null}
        isExtreme={isExtremeAtDate}
      />

      <Hydrograph
        stationName={station.station_name}
        stationId={station.station_id}
        validationRows={stationValRows}
        predictionRows={stationPredRows}
        extremeThreshold={station.metrics?.extreme_threshold_cfs}
      />
    </div>
  )
}
