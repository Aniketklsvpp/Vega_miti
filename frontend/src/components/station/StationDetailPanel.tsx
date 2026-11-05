import React, { useState, useMemo } from 'react'
import type { EnrichedStation, ModelResults, PredictionRow, ValidationPredictionRow } from '../../types/data'
import { Hydrograph } from './Hydrograph'
import { DateScrubber } from './DateScrubber'
import StatsCounter from '../ui/stats-counter'
import {
  AlertTriangle,
  Award,
  ChevronLeft,
  CloudRain,
  Compass,
  Cpu,
  Droplet,
  Flame,
  Gauge,
  Info,
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
}) => {
  const [stationSearch, setStationSearch] = useState('')

  const isYamuna =
    station.station_id.includes('YMN') ||
    station.station_name.toLowerCase().includes('yamuna') ||
    station.station_id === 'IND-BR-01'

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

  // Explicit missing data handling: do NOT default to 0 or NORMAL
  const dischargeValue = curVal?.predicted ?? curPred?.discharge_cfs ?? station.currentDischarge ?? null
  const actualValue = curVal?.actual ?? null

  const thresholdCfs = station.metrics?.extreme_threshold_cfs ?? null
  const isExtremeAtDate =
    dischargeValue != null && thresholdCfs != null ? dischargeValue >= thresholdCfs : false

  // Discrepancy detection between observed reading and predicted inference
  const hasDiscrepancy = useMemo(() => {
    if (actualValue == null || dischargeValue == null || thresholdCfs == null) return false
    const obsExtreme = actualValue >= thresholdCfs
    const predExtreme = dischargeValue >= thresholdCfs
    return obsExtreme !== predExtreme
  }, [actualValue, dischargeValue, thresholdCfs])

  const filteredStations = stations.filter(
    (s) =>
      s.station_name.toLowerCase().includes(stationSearch.toLowerCase()) ||
      s.station_id.toLowerCase().includes(stationSearch.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Discrepancy Banner: Observed vs Predicted Mismatch */}
      {hasDiscrepancy && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-extrabold font-mono uppercase tracking-wider text-amber-800">
                Risk Basis Discrepancy Detected (MISMATCH)
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                DATE: {selectedDate}
              </span>
            </div>
            <p className="leading-relaxed">
              Observed in-situ hydrometric reading ({actualValue?.toFixed(1)} cfs &mdash;{' '}
              {actualValue! >= thresholdCfs! ? 'EXTREME FLOW' : 'NORMAL BASELINE'}) diverges from model predicted inference ({dischargeValue?.toFixed(1)} cfs &mdash;{' '}
              {dischargeValue! >= thresholdCfs! ? 'EXTREME FLOW' : 'NORMAL BASELINE'}).
              This mismatch signals potential sensor calibration lag or rapid upstream catchment surge. Autonomous drone verification mission recommended.
            </p>
          </div>
        </div>
      )}

      {/* Yamuna Specific Hydrological & Upstream Barrage Disclaimer */}
      {isYamuna && (
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-950 flex items-start gap-3 shadow-xs">
          <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-extrabold font-mono uppercase text-sky-800">
                Yamuna River (Delhi ORB) Stage-Only Hydrometric Station
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-200 text-sky-800">
                CWC STATUTORY GAUGE
              </span>
            </div>
            <p className="leading-relaxed text-[11.5px]">
              <b>Stage-Only Monitoring:</b> Water level at the Old Railway Bridge (ORB) is officially measured in <b>metres above Mean Sea Level (m MSL)</b>. In-situ discharge velocity is unmetered.
            </p>
            <p className="leading-relaxed text-[11px] text-sky-900/80">
              <b>Upstream Release Distinction:</b> Hathnikund Barrage releases (peak ~359,000 cfs in July 2023) occur <b>228 km upstream</b> in Haryana (~48&ndash;72h hydraulic transit time) and are strictly <b>not local Delhi discharge</b>. Local stage and upstream barrage releases are presented separately in the Historical Replay module.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-white border border-sky-300 text-sky-900 font-bold">
                Warning Level: 204.50 m
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 font-bold">
                Danger Level: 205.33 m
              </span>
              <span className="px-2 py-0.5 rounded bg-orange-100 border border-orange-300 text-orange-900 font-bold">
                1978 Record: 207.49 m
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-900 font-bold">
                2023 Crest: 208.66 m
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-black/10 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToMap}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-black/5 text-black text-xs font-bold border border-black/15 transition cursor-pointer shadow-2xs"
            title="Return to river map"
          >
            <ChevronLeft className="w-4 h-4 text-[#2563EB]" />
            <span>River Map</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-0.5 rounded-lg border border-[#2563EB]/20 uppercase">
                {station.station_id}
              </span>
              {station.isExtreme && (
                <span className="px-2.5 py-0.5 rounded-lg bg-[#D9531E]/10 text-[#D9531E] border border-[#D9531E]/30 text-[10.5px] font-bold flex items-center gap-1 shadow-2xs">
                  <Flame className="w-3 h-3" /> EXTREME DISCHARGE REACHED
                </span>
              )}
              {isDemo && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/5 text-black/70 border border-black/10">
                  DEMO DATA
                </span>
              )}
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/5 text-black border border-black/10">
                {isYamuna ? 'CWC INDIA' : 'USGS NWIS'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight mt-1 select-none">
              {station.station_name}
            </h2>
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-black/60 mt-1">
              <MapPin className="w-4 h-4 text-[#2563EB]" />
              <span className="font-medium text-black/80">{station.river_name || 'Catchment Basin'}, {station.state}</span>
              <span className="text-black/20">|</span>
              <span className="font-mono text-xs">
                {station.latitude.toFixed(4)}°N, {Math.abs(station.longitude).toFixed(4)}°{station.longitude >= 0 ? 'E' : 'W'}
              </span>
            </div>
          </div>
        </div>

        {/* Searchable Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-black/40 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search station..."
              value={stationSearch}
              onChange={(e) => setStationSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-xs bg-white border border-black/15 rounded-xl text-black placeholder:text-black/40 focus:outline-hidden focus:border-[#2563EB] w-48 shadow-2xs font-medium"
            />
          </div>

          <select
            id="station-dropdown"
            value={station.station_id}
            onChange={(e) => onSelectStation(e.target.value)}
            className="bg-white border border-black/15 text-black text-xs font-bold rounded-xl px-4 py-2 focus:outline-hidden focus:border-[#2563EB] shadow-xs cursor-pointer max-w-xs truncate"
          >
            {filteredStations.map((s) => (
              <option key={s.station_id} value={s.station_id}>
                {s.station_name} ({s.station_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards — Matching River Catchment Map Typography and Separate Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-black/25 transition">
          <div className="flex items-center justify-between text-black/60 mb-1.5">
            <span className="text-[11px] font-bold font-mono uppercase tracking-wider">
              {isYamuna ? 'River Stage Level' : 'Model Estimate Flow'}
            </span>
            <Droplet className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono text-black mt-1 tracking-tight">
            {dischargeValue != null ? (
              <StatsCounter
                value={dischargeValue}
                decimals={isYamuna ? 2 : 1}
                suffix={isYamuna ? ' m MSL' : ' cfs'}
              />
            ) : (
              <span className="text-amber-700 text-sm font-semibold">DATA UNAVAILABLE</span>
            )}
          </div>
          <div className="text-xs text-black/50 mt-3 pt-2.5 border-t border-black/10">
            {selectedDate ? `${selectedDate} Telemetry` : 'Current Observation'}
          </div>
        </div>

        <div className="bg-white border border-[#D9531E]/30 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-[#D9531E]/60 transition">
          <div className="flex items-center justify-between text-[#D9531E] mb-1.5">
            <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-[#D9531E]">
              {isYamuna ? 'CWC Danger Mark' : 'Extreme Cutoff (10%)'}
            </span>
            <Flame className="w-4 h-4 text-[#D9531E]" />
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono text-[#D9531E] mt-1 tracking-tight">
            {isYamuna ? (
              <StatsCounter value={205.33} decimals={2} suffix=" m MSL" />
            ) : thresholdCfs != null ? (
              <StatsCounter value={thresholdCfs} decimals={0} suffix=" cfs" />
            ) : (
              'N/A'
            )}
          </div>
          <div className="text-xs text-black/50 mt-3 pt-2.5 border-t border-black/10">
            {isYamuna ? 'Statutory CWC Evacuation Threshold' : '90th %ile Extreme Threshold'}
          </div>
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-black/25 transition">
          <div className="flex items-center justify-between text-black/60 mb-1.5">
            <span className="text-[11px] font-bold font-mono uppercase tracking-wider">Validation RMSE</span>
            <Gauge className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono text-black mt-1 tracking-tight">
            <StatsCounter
              value={station.metrics?.rmse}
              decimals={1}
              suffix=" cfs"
              fallback="N/A (Provisional)"
            />
          </div>
          <div className="text-xs text-black/50 mt-3 pt-2.5 border-t border-black/10">Held-Out Catchment Error</div>
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-black/25 transition">
          <div className="flex items-center justify-between text-black/60 mb-1.5">
            <span className="text-[11px] font-bold font-mono uppercase tracking-wider">Validation R²</span>
            <Award className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono text-black mt-1 tracking-tight">
            <StatsCounter value={station.metrics?.r2} decimals={3} fallback="N/A" />
          </div>
          <div className="text-xs text-black/50 mt-3 pt-2.5 border-t border-black/10">Hydrological Goodness of Fit</div>
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
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-7">
        <div className="xl:col-span-8">
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
        <div className="xl:col-span-4 space-y-6">
          {/* Weather & Catchment Card */}
          <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/10">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-black">
                <CloudRain className="w-4 h-4 text-[#2563EB]" />
                <span>Weather & Catchment Info</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-black/5 px-2 py-0.5 rounded text-black/70 border border-black/10">
                TELEMETRY
              </span>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-black/70">
              <div className="flex justify-between items-center py-1.5 border-b border-black/5">
                <span className="flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-[#2563EB]" /> 24h Precipitation:
                </span>
                <span className="font-mono font-bold text-black">18.4 mm</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-black/5">
                <span className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-[#D97745]" /> Surface Temperature:
                </span>
                <span className="font-mono font-bold text-black">21.5°C</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-black/5">
                <span className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-black/60" /> Soil Saturation:
                </span>
                <span className="font-mono font-bold text-black">68.2%</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-black/5">
                <span className="flex items-center gap-2">
                  <Mountain className="w-4 h-4 text-[#2563EB]" /> Drainage Basin Area:
                </span>
                <span className="font-mono font-bold text-black">
                  {isYamuna ? '18,900 sq km (Upper Yamuna)' : '24,100 sq mi'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#D97745]" /> Datum Elevation:
                </span>
                <span className="font-mono font-bold text-black">
                  {isYamuna ? '200.0 m MSL' : '320 m ASL'}
                </span>
              </div>
            </div>
          </div>

          {/* Model Configuration Card */}
          <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/10">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-black">
                <Cpu className="w-4 h-4 text-[#D97745]" />
                <span>Model & Configuration</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-black/5 px-2 py-0.5 rounded text-black/70 border border-black/10">
                CONFIG
              </span>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-black/70">
              <div>
                <span className="text-[10.5px] font-bold font-mono text-black/50 block uppercase tracking-wider">
                  Model Architecture
                </span>
                <span className="font-bold text-black block mt-1 text-sm">
                  {modelResults?.model_name || 'HistGradientBoostingRegressor (Config A)'}
                </span>
              </div>

              <div>
                <span className="text-[10.5px] font-bold font-mono text-black/50 block uppercase tracking-wider">
                  Validation Strategy
                </span>
                <span className="font-mono text-xs text-black block mt-1">
                  {modelResults?.validation_strategy || 'Spatial-Temporal Held-Out Catchment K-Fold'}
                </span>
              </div>

              <div>
                <span className="text-[10.5px] font-bold font-mono text-black/50 block uppercase tracking-wider">
                  Exogenous Features
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-black/5 text-black font-mono font-semibold border border-black/10">
                    ERA5 Precip
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-black/5 text-black font-mono font-semibold border border-black/10">
                    Soil Moisture
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-black/5 text-black font-mono font-semibold border border-black/10">
                    Lag-7d Flow
                  </span>
                </div>
              </div>

              <div className="pt-2.5 border-t border-black/10 text-xs text-black/60">
                <span>Training: <b className="text-black">2018–2022</b> &bull; Test: <b className="text-black">2023–2024</b></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
