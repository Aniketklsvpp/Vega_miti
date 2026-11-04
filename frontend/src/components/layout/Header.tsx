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

  const swarmTabs: { id: AnalysisTab; label: string; icon: React.ReactNode }[] = [
    { id: 'flood', label: 'Flood Intelligence', icon: <Gauge className="w-4 h-4" /> },
    { id: 'swarm', label: 'Swarm Command', icon: <Layers className="w-4 h-4" /> },
    { id: 'missions', label: 'Mission Control', icon: <Target className="w-4 h-4" /> },
    { id: 'resilience', label: 'Network Resilience', icon: <Network className="w-4 h-4" /> },
    { id: 'benchmarks', label: 'Evaluation & Eval', icon: <Scale className="w-4 h-4" /> },
    { id: 'map', label: 'River Map', icon: <MapPin className="w-4 h-4" /> },
    { id: 'trust', label: 'Model Trust', icon: <ShieldCheck className="w-4 h-4" /> },
  ]

  const isReady = status.status === 'ready'
  const isDemo = isReady ? status.data.isDemo : true
  const isPrototype = isReady ? status.data.isPrototype : region === 'india'

  return (
    <header className="border-b border-[#DCE4E9] bg-white sticky top-0 z-50 px-4 sm:px-6 py-2.5 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {scene === 'map' && (
            <button
              onClick={() => setScene('globe')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAF0F3] hover:bg-[#DCE4E9] text-[#19364A] text-xs font-semibold border border-[#DCE4E9] transition"
              title="Return to Earth Globe"
            >
              <Globe2 className="w-4 h-4 text-[#28A6A1]" />
              <span>Globe View</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#19364A] flex items-center justify-center text-white shadow-xs">
              <Layers className="w-4 h-4 text-[#28A6A1]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-[#19364A]">
                  DELTA<span className="text-[#28A6A1]">-</span>SWARM
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] font-mono font-bold border border-[#DCE4E9]">
                  BASINSHIFT
                </span>
              </div>
              <p className="text-[10px] text-[#647786]">Flood Intelligence & Autonomous Swarm Coordination</p>
            </div>
          </div>
        </div>

        {scene === 'map' && (
          <nav className="flex items-center gap-1 bg-[#F5F7F8] p-1 rounded-xl border border-[#DCE4E9] overflow-x-auto max-w-full">
            {swarmTabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-[#19364A] shadow-xs border border-[#DCE4E9] font-bold'
                      : 'text-[#647786] hover:text-[#19364A] hover:bg-white/60'
                  }`}
                >
                  <span className={isActive ? 'text-[#28A6A1]' : ''}>{tab.icon}</span>
                  {tab.label}
                </button>
              )
            })}
          </nav>
        )}

        <div className="flex items-center gap-2.5 self-end xl:self-auto">
          <div className="flex items-center bg-[#F5F7F8] border border-[#DCE4E9] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setRegion('india')}
              className={`px-2.5 py-1 rounded transition text-xs ${
                region === 'india'
                  ? 'bg-white text-[#19364A] font-bold border border-[#DCE4E9] shadow-xs'
                  : 'text-[#647786] hover:text-[#19364A]'
              }`}
            >
              India (Primary)
            </button>
            <button
              onClick={() => setRegion('usa')}
              className={`px-2.5 py-1 rounded transition text-xs ${
                region === 'usa'
                  ? 'bg-white text-[#19364A] font-bold border border-[#DCE4E9] shadow-xs'
                  : 'text-[#647786] hover:text-[#19364A]'
              }`}
            >
              USA (Demo)
            </button>
          </div>

          <DemoBadge isDemo={isDemo} isPrototype={isPrototype} region={region} />

          <button
            onClick={reload}
            title="Reload telemetry datasets"
            className="p-1.5 rounded-lg bg-white hover:bg-[#EAF0F3] text-[#19364A] border border-[#DCE4E9] transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
