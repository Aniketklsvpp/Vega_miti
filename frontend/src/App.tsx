import React from 'react'
import { RiverDataProvider, useRiverData } from './context/RiverDataContext'
import { Header } from './components/layout/Header'
import { LoadingState } from './components/common/LoadingState'
import { ErrorBanner } from './components/common/ErrorBanner'
import { OverviewView } from './views/OverviewView'
import { StationDetailPanel } from './components/station/StationDetailPanel'
import { ModelTrustView } from './views/ModelTrustView'
import { PeakComparison } from './components/spotlight/PeakComparison'
import { CesiumGlobe } from './components/globe/CesiumGlobe'

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
      <CesiumGlobe
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
      <div className="min-h-screen bg-[#F5F7F8] text-[#19364A] flex flex-col font-sans selection:bg-[#28A6A1]/20 selection:text-[#19364A]">
        <Header />
        <div className="flex-1">
          <AppContent />
        </div>
        <footer className="border-t border-[#DCE4E9] bg-white py-4 px-6 text-center text-xs text-[#647786]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-semibold text-[#19364A]">VEGA_MITI &middot; FLOODCAST CHALLENGE</span>
            <span className="text-[11px] text-[#647786]">
              Scientific ML discharge estimation from weather & catchment topologies. Historical held-out validation.
            </span>
          </div>
        </footer>
      </div>
    </RiverDataProvider>
  )
}

export default App
