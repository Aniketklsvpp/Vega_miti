import React, { useState, useMemo } from 'react'
import type { EnrichedStation, ModelResults, PredictionRow, ValidationPredictionRow } from '../../types/data'
import { Hydrograph } from './Hydrograph'
import { DateScrubber } from './DateScrubber'
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
  isPrototype = false,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#FAF6EE] border border-[#DDD1BF] shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMap}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAE1D2] hover:bg-[#DDD1BF] text-[#1F2A33] text-xs font-semibold border border-[#DDD1BF] transition cursor-pointer"
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
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#EAF0F3] text-[#19364A] border border-[#DCE4E9]">
                {isYamuna ? 'CWC INDIA' : 'USGS NWIS'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-[#1F2A33]">{station.station_name}</h2>
            <div className="flex items-center gap-2 text-xs text-[#526573] mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#2F7F8F]" />
              <span>{station.river_name || 'Catchment Basin'}, {station.state}</span>
              <span className="text-[#DDD1BF]">|</span>
              <span className="font-mono">
                {station.latitude.toFixed(4)}°N, {Math.abs(station.longitude).toFixed(4)}°{station.longitude >= 0 ? 'E' : 'W'}
              </span>
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
            className="bg-[#FAF6EE] border border-[#DDD1BF] text-[#1F2A33] text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-[#2F7F8F] shadow-xs cursor-pointer"
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
            <span className="text-[11px] font-medium uppercase">
              {isYamuna ? 'River Stage Level' : 'Model Estimate Flow'}
            </span>
            <Droplet className="w-3.5 h-3.5 text-[#2F7F8F]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#1F2A33]">
            {dischargeValue != null ? (
              isYamuna ? (
                `${dischargeValue.toFixed(2)} m MSL`
              ) : (
                `${dischargeValue.toFixed(1)} cfs`
              )
            ) : (
              <span className="text-amber-700 text-sm font-semibold">DATA UNAVAILABLE</span>
            )}
          </div>
          <div className="text-[10.5px] text-[#526573] mt-0.5">
            {selectedDate ? `${selectedDate} Telemetry` : 'Current Observation'}
          </div>
        </div>

        <div className="bg-[#FAF6EE] border border-[#D8432B]/30 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#526573] mb-1">
            <span className="text-[11px] font-medium uppercase text-[#D8432B]">
              {isYamuna ? 'CWC Danger Mark' : 'Extreme Cutoff (10%)'}
            </span>
            <Flame className="w-3.5 h-3.5 text-[#D8432B]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#D8432B]">
            {isYamuna
              ? '205.33 m MSL'
              : thresholdCfs != null
                ? `${thresholdCfs.toFixed(0)} cfs`
                : 'N/A'}
          </div>
          <div className="text-[10.5px] text-[#526573] mt-0.5">
            {isYamuna ? 'Statutory CWC Evacuation Threshold' : '90th %ile Extreme Threshold'}
          </div>
        </div>

        <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#526573] mb-1">
            <span className="text-[11px] font-medium uppercase">Validation RMSE</span>
            <Gauge className="w-3.5 h-3.5 text-[#2F7F8F]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#1F2A33]">
            {station.metrics?.rmse != null ? `${station.metrics.rmse.toFixed(1)} cfs` : 'N/A (Provisional)'}
          </div>
          <div className="text-[10.5px] text-[#526573] mt-0.5">Held-Out Catchment Error</div>
        </div>

        <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#526573] mb-1">
            <span className="text-[11px] font-medium uppercase">Validation R²</span>
            <Award className="w-3.5 h-3.5 text-[#2F7F8F]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#1F2A33]">
            {station.metrics?.r2 != null ? station.metrics.r2.toFixed(3) : 'N/A'}
          </div>
          <div className="text-[10.5px] text-[#526573] mt-0.5">Hydrological Goodness of Fit</div>
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
                <span className="font-mono font-bold text-[#1F2A33]">
                  {isYamuna ? '18,900 sq km (Upper Yamuna)' : '24,100 sq mi'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#B8893B]" /> Datum Elevation:
                </span>
                <span className="font-mono font-bold text-[#1F2A33]">
                  {isYamuna ? '200.0 m MSL' : '320 m ASL'}
                </span>
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
                  {modelResults?.model_name || 'HistGradientBoostingRegressor (Config A)'}
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
