import React from 'react'
import { RiverDataProvider, useRiverData } from './context/RiverDataContext'
import { Header } from './components/layout/Header'
import { LoadingState } from './components/common/LoadingState'
import { ErrorBanner } from './components/common/ErrorBanner'
import { OverviewView } from './views/OverviewView'
import { StationDetailPanel } from './components/station/StationDetailPanel'
import { ModelTrustView } from './views/ModelTrustView'
import { PeakComparison } from './components/spotlight/PeakComparison'
import { ArrowRight, Globe2, MapPin } from 'lucide-react'

const AppContent: React.FC = () => {
  const { status, scene, setScene, setRegion, activeTab, setActiveTab, selectedStationId, setSelectedStationId, reload } = useRiverData()

  if (status.status === 'loading') {
    return <LoadingState />
  }

  if (status.status === 'error') {
    return (
      <ErrorBanner
        message={status.message}
        missingField={status.missingField}
        file={status.file}
        onRetry={reload}
      />
    )
  }

  const { data } = status
  const currentStation = data.stations.find((s) => s.station_id === selectedStationId) || data.stations[0]

  if (scene === 'globe') {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center px-4 text-center space-y-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/20 to-sky-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-2xl">
            <Globe2 className="w-12 h-12 animate-pulse" />
          </div>
          <div className="absolute -inset-4 rounded-full bg-cyan-500/10 blur-xl -z-10" />
        </div>

        <div className="max-w-xl space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100 font-mono">
            GLOBAL RIVER DISCHARGE INTELLIGENCE
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Select an operational river catchment region to inspect cartographic survey sheets, telemetry hydrographs, and validation models.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg pt-4">
          <button
            onClick={() => {
              setRegion('usa')
              setScene('map')
            }}
            className="p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/40 hover:border-cyan-400 text-left transition group shadow-lg shadow-cyan-950/20"
          >
            <div className="flex items-center justify-between text-xs font-mono text-cyan-400 font-bold mb-2">
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> USA REGION</span>
              <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 text-[10px]">REAL DATA</span>
            </div>
            <h3 className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition">United States River Catchments</h3>
            <p className="text-xs text-slate-400 mt-1">Official evaluation stations across US gauging networks.</p>
            <div className="mt-3 text-xs font-mono text-cyan-400 flex items-center gap-1 font-semibold">
              Enter Survey Sheet <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </button>

          <button
            onClick={() => {
              setRegion('india')
              setScene('map')
            }}
            className="p-5 rounded-2xl bg-slate-900/90 border border-indigo-500/40 hover:border-indigo-400 text-left transition group shadow-lg shadow-indigo-950/20"
          >
            <div className="flex items-center justify-between text-xs font-mono text-indigo-400 font-bold mb-2">
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> INDIA REGION</span>
              <span className="px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 text-[10px]">PROTOTYPE</span>
            </div>
            <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition">India River Basins</h3>
            <p className="text-xs text-slate-400 mt-1">Concept prototype transfer across Ganga, Yamuna, Narmada.</p>
            <div className="mt-3 text-xs font-mono text-indigo-400 flex items-center gap-1 font-semibold">
              Enter Survey Sheet <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {activeTab === 'map' && (
        <OverviewView
          region={data.region}
          stations={data.stations}
          selectedStationId={selectedStationId}
          onSelectStation={setSelectedStationId}
          onNavigateToStation={(id) => {
            setSelectedStationId(id)
            setActiveTab('station')
          }}
        />
      )}

      {activeTab === 'station' && currentStation && (
        <StationDetailPanel
          station={currentStation}
          stations={data.stations}
          selectedStationId={selectedStationId}
          onSelectStation={setSelectedStationId}
          onBackToMap={() => setActiveTab('map')}
          validationRows={data.validationPredictions}
          predictionRows={data.predictions}
        />
      )}

      {activeTab === 'trust' && (
        <ModelTrustView
          results={data.modelResults}
          stations={data.stations}
          onSelectStation={(id) => {
            setSelectedStationId(id)
            setActiveTab('station')
          }}
        />
      )}

      {activeTab === 'spotlight' && (
        <PeakComparison
          validationRows={data.validationPredictions}
          stations={data.stations}
          onSelectStation={(id) => {
            setSelectedStationId(id)
            setActiveTab('station')
          }}
        />
      )}
    </main>
  )
}

export function App() {
  return (
    <RiverDataProvider>
      <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
        <Header />
        <div className="flex-1">
          <AppContent />
        </div>
        <footer className="border-t border-slate-900 bg-[#06080e] py-4 px-6 text-center text-xs font-mono text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>VEGA_MITI &middot; FLOODCAST CHALLENGE</span>
            <span className="text-slate-600 text-[11px]">
              Scientific ML discharge estimation from weather & catchment topologies. Historical held-out validation.
            </span>
          </div>
        </footer>
      </div>
    </RiverDataProvider>
  )
}

export default App
