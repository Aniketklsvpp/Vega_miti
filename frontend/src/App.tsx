import React from 'react'
import { RiverDataProvider, useRiverData } from './context/RiverDataContext'
import { Header } from './components/layout/Header'
import { LoadingState } from './components/common/LoadingState'
import { ErrorBanner } from './components/common/ErrorBanner'
import { OverviewView } from './views/OverviewView'
import { StationDetailPanel } from './components/station/StationDetailPanel'
import { ModelTrustView } from './views/ModelTrustView'
import { PeakComparison } from './components/spotlight/PeakComparison'
import { FloodIntelligenceView } from './views/FloodIntelligenceView'
import { SwarmCommandView } from './views/SwarmCommandView'
import { MissionControlView } from './views/MissionControlView'
import { NetworkResilienceView } from './views/NetworkResilienceView'
import { EvaluationBenchmarkView } from './views/EvaluationBenchmarkView'
import { RealEarthGlobe } from './components/globe/RealEarthGlobe'

const AppContent: React.FC = () => {
  const {
    status,
    scene,
    setScene,
    setRegion,
    activeTab,
    setActiveTab,
    selectedStationId,
    setSelectedStationId,
    reload,
  } = useRiverData()

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
  const currentStation =
    data.stations.find((s) => s.station_id === selectedStationId) || data.stations[0]

  if (scene === 'globe') {
    return (
      <RealEarthGlobe
        onSelectRegion={(reg) => {
          setRegion(reg)
          setActiveTab('map')
          setScene('map')
        }}
        onSkipIntro={() => {
          setActiveTab('map')
          setScene('map')
        }}
      />
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Permanent Banner if region is India */}
      {data.isPrototype && (
        <div className="mb-6 p-3.5 bg-[#FAF6EE] border-2 border-[#B8893B] rounded-xl text-xs text-[#1F2A33] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B8893B] animate-pulse"></span>
            <span className="font-bold">Prototype region: concept demo, model trained on US data.</span>
          </div>
          <span className="text-[10px] font-mono font-bold bg-[#B8893B]/20 text-[#B8893B] px-2 py-0.5 rounded border border-[#B8893B]/30">
            INDIA PROTOTYPE
          </span>
        </div>
      )}

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
          modelResults={data.modelResults}
          isDemo={data.isDemo}
          isPrototype={data.isPrototype}
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

      {activeTab === 'flood' && (
        <FloodIntelligenceView
          stations={data.stations}
          selectedStationId={selectedStationId || data.stations[0]?.station_id || 'IND-BR-01'}
          onSelectStation={setSelectedStationId}
          onNavigateToSwarm={() => setActiveTab('swarm')}
        />
      )}

      {activeTab === 'swarm' && (
        <SwarmCommandView
          onNavigateToMissions={() => setActiveTab('missions')}
          onNavigateToResilience={() => setActiveTab('resilience')}
        />
      )}

      {activeTab === 'missions' && <MissionControlView />}

      {activeTab === 'resilience' && <NetworkResilienceView />}

      {activeTab === 'benchmarks' && <EvaluationBenchmarkView />}
    </main>
  )
}

export function App() {
  return (
    <RiverDataProvider>
      <div className="min-h-screen bg-[#F3EBDD] text-[#1F2A33] flex flex-col font-sans selection:bg-[#2F7F8F]/20 selection:text-[#1F2A33]">
        <Header />
        <div className="flex-1">
          <AppContent />
        </div>
        <footer className="border-t border-[#DDD1BF] bg-[#FAF6EE] py-4 px-6 text-center text-xs text-[#526573]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-semibold text-[#1F2A33]">
              DELTA-SWARM &middot; BASINSHIFT GLOBAL FLOOD INTELLIGENCE CHALLENGE
            </span>
            <span className="text-[11px] text-[#526573]">
              Cartographer Edition &bull; 22 USGS Catchments &bull; Real 3D Earth Globe
            </span>
          </div>
        </footer>
      </div>
    </RiverDataProvider>
  )
}

export default App
