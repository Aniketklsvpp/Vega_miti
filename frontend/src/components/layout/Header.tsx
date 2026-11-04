import React from 'react'
import { Activity, BarChart3, Globe2, Layers, MapPin, RefreshCw, ShieldCheck } from 'lucide-react'
import { useRiverData } from '../../context/RiverDataContext'
import type { AnalysisTab } from '../../types/data'
import { DemoBadge } from '../common/DemoBadge'

export const Header: React.FC = () => {
  const { status, scene, setScene, region, setRegion, activeTab, setActiveTab, reload } = useRiverData()

  const tabs: { id: AnalysisTab; label: string; icon: React.ReactNode }[] = [
    { id: 'map', label: 'Survey Sheet Map', icon: <MapPin className="w-4 h-4" /> },
    { id: 'station', label: 'Station Hydrograph', icon: <Activity className="w-4 h-4" /> },
    { id: 'trust', label: 'Model Trust Panel', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'spotlight', label: 'Peak Spotlight', icon: <BarChart3 className="w-4 h-4" /> },
  ]

  const isReady = status.status === 'ready'
  const isDemo = isReady ? status.data.isDemo : true
  const isPrototype = isReady ? status.data.isPrototype : region === 'india'

  return (
    <header className="border-b border-slate-800 bg-[#080c14]/95 backdrop-blur sticky top-0 z-50 px-4 sm:px-6 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {scene === 'map' && (
            <button
              onClick={() => setScene('globe')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium border border-slate-700 transition"
              title="Return to 3D Globe"
            >
              <Globe2 className="w-4 h-4 text-cyan-400" />
              <span>Globe</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wider text-slate-100 font-mono">
                  VEGA<span className="text-cyan-400">_</span>MITI
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">
                  FLOODCAST
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">River Intelligence Platform</p>
            </div>
          </div>
        </div>

        {scene === 'map' && (
          <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    isActive
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              )
            })}
          </nav>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setRegion('usa')}
              className={`px-2.5 py-1 rounded transition ${
                region === 'usa' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              USA (Real)
            </button>
            <button
              onClick={() => setRegion('india')}
              className={`px-2.5 py-1 rounded transition ${
                region === 'india' ? 'bg-indigo-950 text-indigo-300 font-bold border border-indigo-800/60' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              India (Proto)
            </button>
          </div>

          <DemoBadge isDemo={isDemo} isPrototype={isPrototype} region={region} />

          <button
            onClick={reload}
            title="Reload dataset outputs"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
