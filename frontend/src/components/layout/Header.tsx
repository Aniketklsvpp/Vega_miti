import React from 'react'
import {
  Gauge,
  Globe2,
  Layers,
  MapPin,
  Network,
  RefreshCw,
  Scale,
  ShieldCheck,
  Target,
} from 'lucide-react'
import { useRiverData } from '../../context/RiverDataContext'
import type { AnalysisTab } from '../../types/data'
import { DemoBadge } from '../common/DemoBadge'

export const Header: React.FC = () => {
  const { status, scene, setScene, region, setRegion, activeTab, setActiveTab, reload } = useRiverData()

  const tabs: { id: AnalysisTab; label: string; icon: React.ReactNode }[] = [
    { id: 'map', label: 'River Catchment Map', icon: <MapPin className="w-4 h-4" /> },
    { id: 'station', label: 'Station Hydrograph', icon: <Gauge className="w-4 h-4" /> },
    { id: 'trust', label: 'Model Trust', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'flood', label: 'Flood Intelligence', icon: <Layers className="w-4 h-4" /> },
    { id: 'swarm', label: 'Swarm Command', icon: <Target className="w-4 h-4" /> },
    { id: 'missions', label: 'Missions', icon: <Target className="w-4 h-4" /> },
    { id: 'resilience', label: 'Resilience', icon: <Network className="w-4 h-4" /> },
    { id: 'benchmarks', label: 'Benchmarks', icon: <Scale className="w-4 h-4" /> },
  ]

  const isReady = status.status === 'ready'
  const isDemo = isReady ? status.data.isDemo : true
  const isPrototype = isReady ? status.data.isPrototype : region === 'india'

  return (
    <header className="border-b border-[#DDD1BF] bg-[#FAF6EE] sticky top-0 z-50 px-4 sm:px-6 py-2.5 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScene('globe')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAE1D2] hover:bg-[#DDD1BF] text-[#1F2A33] text-xs font-semibold border border-[#DDD1BF] transition cursor-pointer"
            title="Return to 3D Earth Globe"
          >
            <Globe2 className="w-4 h-4 text-[#2F7F8F]" />
            <span>3D Earth Globe</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1F2A33] flex items-center justify-center text-[#FAF6EE] shadow-xs">
              <Layers className="w-4 h-4 text-[#2F7F8F]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-[#1F2A33]">
                  DELTA<span className="text-[#2F7F8F]">-</span>SWARM
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EAE1D2] text-[#1F2A33] font-mono font-bold border border-[#DDD1BF]">
                  BASINSHIFT
                </span>
              </div>
              <p className="text-[10px] text-[#526573]">Flood Intelligence & Multi-Agent Coordination</p>
            </div>
          </div>
        </div>

        {scene === 'map' && (
          <nav className="flex items-center gap-1 bg-[#F3EBDD] p-1 rounded-xl border border-[#DDD1BF] overflow-x-auto max-w-full">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#FAF6EE] text-[#1F2A33] shadow-xs border border-[#DDD1BF] font-bold'
                      : 'text-[#526573] hover:text-[#1F2A33] hover:bg-[#FAF6EE]/60'
                  }`}
                >
                  <span className={isActive ? 'text-[#2F7F8F]' : ''}>{tab.icon}</span>
                  {tab.label}
                </button>
              )
            })}
          </nav>
        )}

        <div className="flex items-center gap-2.5 self-end xl:self-auto">
          <div className="flex items-center bg-[#F3EBDD] border border-[#DDD1BF] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setRegion('usa')}
              className={`px-2.5 py-1 rounded transition text-xs cursor-pointer ${
                region === 'usa'
                  ? 'bg-[#FAF6EE] text-[#1F2A33] font-bold border border-[#DDD1BF] shadow-xs'
                  : 'text-[#526573] hover:text-[#1F2A33]'
              }`}
            >
              USA (22 Stations)
            </button>
            <button
              onClick={() => setRegion('india')}
              className={`px-2.5 py-1 rounded transition text-xs cursor-pointer ${
                region === 'india'
                  ? 'bg-[#FAF6EE] text-[#1F2A33] font-bold border border-[#DDD1BF] shadow-xs'
                  : 'text-[#526573] hover:text-[#1F2A33]'
              }`}
            >
              India (Prototype)
            </button>
          </div>

          <DemoBadge isDemo={isDemo} isPrototype={isPrototype} region={region} />

          <button
            onClick={reload}
            title="Reload telemetry datasets"
            className="p-1.5 rounded-lg bg-[#FAF6EE] hover:bg-[#EAE1D2] text-[#1F2A33] border border-[#DDD1BF] transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
