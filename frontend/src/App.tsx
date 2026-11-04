import React from 'react'
import { RiverDataProvider, useRiverData } from './context/RiverDataContext'
import { Header } from './components/layout/Header'
import { LoadingState } from './components/common/LoadingState'
import { ErrorBanner } from './components/common/ErrorBanner'
import { OverviewView } from './views/OverviewView'
import { StationDetailPanel } from './components/station/StationDetailPanel'
import { ModelTrustView } from './views/ModelTrustView'
import { PeakComparison } from './components/spotlight/PeakComparison'
import { GlobeScene } from './components/globe/GlobeScene'

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
      <GlobeScene
        onSelectRegion={(reg) => {
          setRegion(reg)
          setScene('map')
        }}
        onSkipIntro={() => {
          setScene('map')
        }}
      />
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
