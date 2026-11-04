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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-[#DCE4E9] shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMap}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAF0F3] hover:bg-[#DCE4E9] text-[#19364A] text-xs font-semibold border border-[#DCE4E9] transition"
            title="Return to river map"
          >
            <ChevronLeft className="w-4 h-4 text-[#28A6A1]" />
            <span>River Map</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#28A6A1] uppercase">{station.station_id}</span>
              {station.isExtreme && (
                <span className="px-2 py-0.5 rounded bg-[#FFF1F2] text-[#C94C55] border border-[#FECDD3] text-[10px] font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3" /> EXTREME DISCHARGE REACHED
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-[#19364A]">{station.station_name}</h2>
            <div className="flex items-center gap-2 text-xs text-[#647786] mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#28A6A1]" />
              <span>{station.river_name || 'Catchment Basin'}, {station.state}</span>
              <span className="text-[#DCE4E9]">|</span>
              <span className="font-mono">{station.latitude.toFixed(4)}°N, {Math.abs(station.longitude).toFixed(4)}°E</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="station-dropdown" className="text-xs font-medium text-[#647786]">Switch Station:</label>
          <select
            id="station-dropdown"
            value={station.station_id}
            onChange={(e) => onSelectStation(e.target.value)}
            className="bg-white border border-[#DCE4E9] text-[#19364A] text-xs font-semibold rounded-lg px-3 py-2 focus:outline-none focus:border-[#28A6A1] shadow-xs"
          >
            {stations.map((s) => (
              <option key={s.station_id} value={s.station_id}>
                {s.station_name} ({s.station_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#DCE4E9] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#647786] mb-1">
            <span className="text-[11px] font-medium uppercase">Model estimate (selected date)</span>
            <Droplet className="w-3.5 h-3.5 text-[#28A6A1]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#19364A]">
            {dischargeValue.toFixed(1)} cfs
          </div>
          <div className="text-[10.5px] text-[#647786] mt-0.5">{selectedDate} Estimate</div>
        </div>

        <div className="bg-white border border-[#FECDD3] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#647786] mb-1">
            <span className="text-[11px] font-medium uppercase text-[#C94C55]">Extreme Cutoff (10%)</span>
            <Flame className="w-3.5 h-3.5 text-[#C94C55]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#C94C55]">
            {station.metrics?.extreme_threshold_cfs.toFixed(0) ?? 'N/A'} cfs
          </div>
          <div className="text-[10.5px] text-[#647786] mt-0.5">90th %ile Threshold</div>
        </div>

        <div className="bg-white border border-[#DCE4E9] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#647786] mb-1">
            <span className="text-[11px] font-medium uppercase">Validation RMSE</span>
            <Gauge className="w-3.5 h-3.5 text-[#398DB5]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#19364A]">
            {station.metrics?.rmse.toFixed(1) ?? 'N/A'} cfs
          </div>
          <div className="text-[10.5px] text-[#647786] mt-0.5">Held-Out Error</div>
        </div>

        <div className="bg-white border border-[#DCE4E9] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#647786] mb-1">
            <span className="text-[11px] font-medium uppercase">Validation R²</span>
            <Award className="w-3.5 h-3.5 text-[#28A6A1]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#19364A]">
            {station.metrics?.r2.toFixed(3) ?? 'N/A'}
          </div>
          <div className="text-[10.5px] text-[#647786] mt-0.5">Goodness of Fit</div>
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
