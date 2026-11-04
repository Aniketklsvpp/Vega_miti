import React, { useState, useMemo } from 'react'
import type { EnrichedStation, ModelResults, PredictionRow, ValidationPredictionRow } from '../../types/data'
import { Hydrograph } from './Hydrograph'
import { DateScrubber } from './DateScrubber'
import {
  Award,
  ChevronLeft,
  CloudRain,
  Compass,
  Cpu,
  Droplet,
  Flame,
  Gauge,
  MapPin,
  Mountain,
  Search,
  Thermometer,
  Wind,
} from 'lucide-react'

interface StationDetailPanelProps {
  station: EnrichedStation
  stations: EnrichedStation[]
  selectedStationId?: string | null
  onSelectStation: (id: string) => void
  onBackToMap: () => void
  validationRows: ValidationPredictionRow[]
  predictionRows: PredictionRow[]
  modelResults?: ModelResults
  isDemo?: boolean
  isPrototype?: boolean
}

export const StationDetailPanel: React.FC<StationDetailPanelProps> = ({
  station,
  stations,
  onSelectStation,
  onBackToMap,
  validationRows,
  predictionRows,
  modelResults,
  isDemo = true,
  isPrototype = false,
}) => {
  const [stationSearch, setStationSearch] = useState('')

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

  const filteredStations = stations.filter((s) =>
    s.station_name.toLowerCase().includes(stationSearch.toLowerCase()) ||
    s.station_id.toLowerCase().includes(stationSearch.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Prototype Banner for India */}
      {isPrototype && (
        <div className="p-3.5 bg-[#FAF6EE] border-2 border-[#B8893B] rounded-xl text-xs text-[#1F2A33] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B8893B] animate-pulse"></span>
            <span className="font-bold">Prototype region: concept demo, model trained on US data.</span>
          </div>
          <span className="text-[10px] font-mono font-bold bg-[#B8893B]/20 text-[#B8893B] px-2 py-0.5 rounded border border-[#B8893B]/30">
            PROTOTYPE ACTIVE
          </span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#FAF6EE] border border-[#DDD1BF] shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMap}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAE1D2] hover:bg-[#DDD1BF] text-[#1F2A33] text-xs font-semibold border border-[#DDD1BF] transition"
            title="Return to river map"
          >
            <ChevronLeft className="w-4 h-4 text-[#2F7F8F]" />
            <span>River Map</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#2F7F8F] uppercase">{station.station_id}</span>
              {station.isExtreme && (
                <span className="px-2 py-0.5 rounded bg-[#FBECE9] text-[#D8432B] border border-[#D8432B]/30 text-[10px] font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3" /> EXTREME DISCHARGE REACHED
                </span>
              )}
              {isDemo && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#B8893B]/15 text-[#B8893B] border border-[#B8893B]/30">
                  DEMO DATA
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-[#1F2A33]">{station.station_name}</h2>
            <div className="flex items-center gap-2 text-xs text-[#526573] mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#2F7F8F]" />
              <span>{station.river_name || 'Catchment Basin'}, {station.state}</span>
              <span className="text-[#DDD1BF]">|</span>
              <span className="font-mono">{station.latitude.toFixed(4)}°N, {Math.abs(station.longitude).toFixed(4)}°E</span>
            </div>
          </div>
        </div>

        {/* Searchable Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#526573] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search station..."
              value={stationSearch}
              onChange={(e) => setStationSearch(e.target.value)}
              className="pl-8 pr-2 py-1.5 text-xs bg-[#F3EBDD] border border-[#DDD1BF] rounded-lg text-[#1F2A33] focus:outline-hidden focus:border-[#2F7F8F] w-40"
            />
          </div>

          <select
            id="station-dropdown"
            value={station.station_id}
            onChange={(e) => onSelectStation(e.target.value)}
            className="bg-[#FAF6EE] border border-[#DDD1BF] text-[#1F2A33] text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-[#2F7F8F] shadow-xs"
          >
            {filteredStations.map((s) => (
              <option key={s.station_id} value={s.station_id}>
                {s.station_name} ({s.station_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#526573] mb-1">
            <span className="text-[11px] font-medium uppercase">Model estimate (selected date)</span>
            <Droplet className="w-3.5 h-3.5 text-[#2F7F8F]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#1F2A33]">
            {dischargeValue.toFixed(1)} cfs
          </div>
          <div className="text-[10.5px] text-[#526573] mt-0.5">{selectedDate} Estimate</div>
        </div>

        <div className="bg-[#FAF6EE] border border-[#D8432B]/30 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#526573] mb-1">
            <span className="text-[11px] font-medium uppercase text-[#D8432B]">Extreme Cutoff (10%)</span>
            <Flame className="w-3.5 h-3.5 text-[#D8432B]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#D8432B]">
            {station.metrics?.extreme_threshold_cfs.toFixed(0) ?? 'N/A'} cfs
          </div>
          <div className="text-[10.5px] text-[#526573] mt-0.5">90th %ile Threshold</div>
        </div>

        <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#526573] mb-1">
            <span className="text-[11px] font-medium uppercase">Validation RMSE</span>
            <Gauge className="w-3.5 h-3.5 text-[#2F7F8F]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#1F2A33]">
            {station.metrics?.rmse.toFixed(1) ?? 'N/A'} cfs
          </div>
          <div className="text-[10.5px] text-[#526573] mt-0.5">Held-Out Error</div>
        </div>

        <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#526573] mb-1">
            <span className="text-[11px] font-medium uppercase">Validation R²</span>
            <Award className="w-3.5 h-3.5 text-[#2F7F8F]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#1F2A33]">
            {station.metrics?.r2.toFixed(3) ?? 'N/A'}
          </div>
          <div className="text-[10.5px] text-[#526573] mt-0.5">Goodness of Fit</div>
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

      {/* Main Hydrograph Chart with Weather & Model info beside it */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <Hydrograph
            stationName={station.station_name}
            stationId={station.station_id}
            validationRows={stationValRows}
            predictionRows={stationPredRows}
            extremeThreshold={station.metrics?.extreme_threshold_cfs}
            isDemo={isDemo}
          />
        </div>

        {/* Side Panel: Weather, Catchment & Model Configuration */}
        <div className="lg:col-span-4 space-y-4">
          {/* Weather & Catchment Card */}
          <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DDD1BF]">
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#1F2A33]">
                <CloudRain className="w-4 h-4 text-[#2F7F8F]" />
                <span>Weather & Catchment Info</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-[#EAE1D2] px-1.5 py-0.2 rounded text-[#526573]">
                TELEMETRY
              </span>
            </div>

            <div className="space-y-2 text-xs text-[#526573]">
              <div className="flex justify-between items-center py-1 border-b border-[#DDD1BF]/50">
                <span className="flex items-center gap-1.5">
                  <CloudRain className="w-3.5 h-3.5 text-[#2F7F8F]" /> 24h Precipitation:
                </span>
                <span className="font-mono font-bold text-[#1F2A33]">18.4 mm</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DDD1BF]/50">
                <span className="flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-[#B8893B]" /> Surface Temperature:
                </span>
                <span className="font-mono font-bold text-[#1F2A33]">21.5°C</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DDD1BF]/50">
                <span className="flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-[#526573]" /> Soil Saturation:
                </span>
                <span className="font-mono font-bold text-[#1F2A33]">68.2%</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DDD1BF]/50">
                <span className="flex items-center gap-1.5">
                  <Mountain className="w-3.5 h-3.5 text-[#2F7F8F]" /> Drainage Basin Area:
                </span>
                <span className="font-mono font-bold text-[#1F2A33]">24,100 sq mi</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#B8893B]" /> Elevation:
                </span>
                <span className="font-mono font-bold text-[#1F2A33]">320 m ASL</span>
              </div>
            </div>
          </div>

          {/* Model Configuration Card */}
          <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DDD1BF]">
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#1F2A33]">
                <Cpu className="w-4 h-4 text-[#B8893B]" />
                <span>Model & Configuration</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-[#EAE1D2] px-1.5 py-0.2 rounded text-[#526573]">
                CONFIG
              </span>
            </div>

            <div className="space-y-2 text-xs text-[#526573]">
              <div>
                <span className="text-[10px] font-semibold text-[#526573] block uppercase tracking-wider">
                  Model Architecture
                </span>
                <span className="font-bold text-[#1F2A33] block mt-0.5">
                  {modelResults?.model_name || 'HydroBoost Ensemble v1.4'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-[#526573] block uppercase tracking-wider">
                  Validation Strategy
                </span>
                <span className="font-mono text-[11px] text-[#1F2A33] block mt-0.5">
                  {modelResults?.validation_strategy || 'Spatial-Temporal Held-Out Catchment K-Fold'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-[#526573] block uppercase tracking-wider">
                  Exogenous Features
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EAE1D2] text-[#1F2A33] font-mono">
                    ERA5 Precip
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EAE1D2] text-[#1F2A33] font-mono">
                    Soil Moisture
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EAE1D2] text-[#1F2A33] font-mono">
                    Lag-7d Flow
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#DDD1BF]/60 text-[11px] text-[#526573]">
                <span>Training: <b>2018–2022</b> &bull; Test: <b>2023–2024</b></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
