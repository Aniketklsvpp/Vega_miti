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
import { HistoricalReplayView } from './views/HistoricalReplayView'
import { TacticalGlobe3D } from './components/globe/TacticalGlobe3D'
import { ArrowUpRight } from 'lucide-react'

const AppContent: React.FC = () => {
  const {
    status,
    scene,
    setScene,
    region,
    activeTab,
    setActiveTab,
    selectedStationId,
    setSelectedStationId,
    switchRegionAndEnterMap,
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

  // Fullscreen Globe Mode if explicitly toggled to scene='globe'
  if (scene === 'globe') {
    return (
      <div className="relative w-full h-[calc(100vh-80px)]">
        <TacticalGlobe3D
          onSelectRegion={(reg) => {
            switchRegionAndEnterMap(reg)
          }}
          onSkipIntro={() => {
            setActiveTab('map')
            setScene('map')
          }}
        />
      </div>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-8">
      {/* 1. MAIN DASHBOARD: EXACT MATCH TO REFERENCE IMAGE 1 */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center min-h-[calc(100vh-180px)]">
          {/* Left Column: Bold Typography & Description matching Reference Image 1 */}
          <div className="lg:col-span-5 flex flex-col justify-center space-y-5">
            <h1 className="font-black italic uppercase tracking-tighter text-5xl sm:text-6xl xl:text-7xl text-black leading-[0.88] select-none">
              REAL-TIME<br />
              FLOOD<br />
              INTELLIGENCE.
            </h1>

            {/* Blue Wave Accent Line matching Reference Image 1 */}
            <div className="py-1">
              <svg
                className="w-24 h-4 text-[#2563EB]"
                viewBox="0 0 96 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 8C8 2 16 2 22 8C28 14 36 14 42 8C48 2 56 2 62 8C68 14 76 14 82 8C88 2 94 2 94 8"
                  stroke="#2563EB"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <p className="text-base sm:text-lg font-medium text-black/80 leading-relaxed max-w-md">
              Monitor rivers, predict risks and coordinate autonomous swarms for faster response.
            </p>

            <div className="pt-3">
              <button
                onClick={() => switchRegionAndEnterMap(region)}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-black text-white hover:bg-black/90 font-bold text-sm shadow-md transition-all group cursor-pointer"
              >
                <span>Explore Globe</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Right Column: Large Rounded Globe Container matching Reference Image 1 */}
          <div className="lg:col-span-7">
            <div className="w-full rounded-[2.5rem] border border-black/80 overflow-hidden bg-[#111417] shadow-2xl relative aspect-[16/11] min-h-[480px]">
              <TacticalGlobe3D
                onSelectRegion={(reg) => {
                  switchRegionAndEnterMap(reg)
                }}
                onSkipIntro={() => {
                  setActiveTab('map')
                  setScene('map')
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. RIVER CATCHMENT MAP: EXACT MATCH TO REFERENCE IMAGE 2 */}
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

      {/* 3. STATION HYDROGRAPH & DETAIL VIEW */}
      {activeTab === 'station' && currentStation && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-black/10">
            <div>
              <h2 className="text-2xl font-black text-black">Station Hydrograph Telemetry</h2>
              <p className="text-xs text-black/60 font-medium">Real-time discharge observations vs predictive AI baseline</p>
            </div>
            <button
              onClick={() => setActiveTab('map')}
              className="px-4 py-2 rounded-full border border-black/20 hover:border-black text-xs font-bold text-black transition cursor-pointer"
            >
              &larr; Return to Catchment Map
            </button>
          </div>

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
        </div>
      )}

      {/* 4. MODEL TRUST */}
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

      {/* 5. SPOTLIGHT & PEAK COMPARISON */}
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

      {/* 6. FLOOD INTELLIGENCE VIEW */}
      {activeTab === 'flood' && (
        <FloodIntelligenceView
          stations={data.stations}
          selectedStationId={selectedStationId || data.stations[0]?.station_id || 'IND-BR-01'}
          onSelectStation={setSelectedStationId}
          onNavigateToSwarm={() => setActiveTab('swarm')}
        />
      )}

      {/* 7. HISTORICAL REPLAY */}
      {activeTab === 'replay' && <HistoricalReplayView />}

      {/* 8. SWARM COMMAND VIEW */}
      {activeTab === 'swarm' && (
        <SwarmCommandView
          onNavigateToMissions={() => setActiveTab('missions')}
          onNavigateToResilience={() => setActiveTab('resilience')}
        />
      )}

      {/* 9. MISSIONS */}
      {activeTab === 'missions' && <MissionControlView />}

      {/* 10. RESILIENCE */}
      {activeTab === 'resilience' && <NetworkResilienceView />}

      {/* 11. BENCHMARKS */}
      {activeTab === 'benchmarks' && <EvaluationBenchmarkView />}
    </main>
  )
}

export function App() {
  return (
    <RiverDataProvider>
      <div className="min-h-screen bg-white text-black flex flex-col font-sans selection:bg-[#2563EB]/20 selection:text-black">
        <Header />
        <div className="flex-1">
          <AppContent />
        </div>
        <footer className="border-t border-black/10 bg-white py-6 px-6 sm:px-12 text-xs text-black/50">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="font-bold text-black text-xs">
              VEGA-MITI &middot; Real-Time Flood Intelligence & Multi-Agent Swarm Coordination
            </span>
            <span className="text-[11px] text-black/50 font-mono">
              USGS Gauging Network &bull; High-Resolution 3D Relief Terrain &bull; Interactive Global Earth
            </span>
          </div>
        </footer>
      </div>
    </RiverDataProvider>
  )
}

export default App
