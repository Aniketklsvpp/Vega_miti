import React from 'react'
import { Activity, BarChart3, Globe2, Layers, MapPin, RefreshCw, ShieldCheck } from 'lucide-react'
import { useRiverData } from '../../context/RiverDataContext'
import type { AnalysisTab } from '../../types/data'
import { DemoBadge } from '../common/DemoBadge'

export const Header: React.FC = () => {
  const { status, scene, setScene, region, setRegion, activeTab, setActiveTab, reload } = useRiverData()

  const tabs: { id: AnalysisTab; label: string; icon: React.ReactNode }[] = [
    { id: 'map', label: 'River Monitoring Map', icon: <MapPin className="w-4 h-4" /> },
    { id: 'station', label: 'Station Hydrograph', icon: <Activity className="w-4 h-4" /> },
    { id: 'trust', label: 'Model Trust Panel', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'spotlight', label: 'Peak Spotlight', icon: <BarChart3 className="w-4 h-4" /> },
  ]

  const isReady = status.status === 'ready'
  const isDemo = isReady ? status.data.isDemo : true
  const isPrototype = isReady ? status.data.isPrototype : region === 'india'

  return (
    <header className="border-b border-[#DCE4E9] bg-white sticky top-0 z-50 px-4 sm:px-6 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            <div className="w-8 h-8 rounded-lg bg-[#EAF0F3] border border-[#DCE4E9] flex items-center justify-center text-[#28A6A1]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-[#19364A]">
                  VEGA<span className="text-[#28A6A1]">_</span>MITI
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EAF0F3] text-[#19364A] font-mono font-bold border border-[#DCE4E9]">
                  FLOODCAST
                </span>
              </div>
              <p className="text-[11px] text-[#647786]">River Discharge Intelligence Platform</p>
            </div>
          </div>
        </div>

        {scene === 'map' && (
          <nav className="flex items-center gap-1 bg-[#F5F7F8] p-1 rounded-xl border border-[#DCE4E9]">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
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

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#F5F7F8] border border-[#DCE4E9] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setRegion('india')}
              className={`px-3 py-1 rounded transition ${
                region === 'india'
                  ? 'bg-white text-[#19364A] font-bold border border-[#DCE4E9] shadow-xs'
                  : 'text-[#647786] hover:text-[#19364A]'
              }`}
            >
              India (Primary)
            </button>
            <button
              onClick={() => setRegion('usa')}
              className={`px-3 py-1 rounded transition ${
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
