import React from 'react'
import { Activity, AlertTriangle, BarChart3, Database, Layers, MapPin, RefreshCw, ShieldCheck } from 'lucide-react'
import { useRiverData, type TabType } from '../../context/RiverDataContext'

export const Header: React.FC = () => {
  const { status, activeTab, setActiveTab, reload } = useRiverData()
  const isDemo = status.status === 'ready' && status.data.isDemo

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'River Intelligence', icon: <MapPin className="w-4 h-4" /> },
    { id: 'station', label: 'Station Hydrograph', icon: <Activity className="w-4 h-4" /> },
    { id: 'trust', label: 'Model Trust Panel', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'spotlight', label: 'Peak Spotlight', icon: <BarChart3 className="w-4 h-4" /> },
  ]

  return (
    <header className="border-b border-slate-800/80 bg-[#090d14]/95 backdrop-blur sticky top-0 z-50 px-6 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-sky-600/10 to-transparent border border-cyan-500/30 text-cyan-400 shadow-inner">
            <Layers className="w-5 h-5 animate-pulse" />
            <div className="absolute -inset-0.5 rounded-xl bg-cyan-400/20 blur-sm -z-10" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-lg text-slate-100 uppercase font-mono">
                VEGA<span className="text-cyan-400">_</span>MITI
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700/60">
                FLOODCAST
              </span>
            </div>
            <p className="text-xs text-slate-400 tracking-tight">River Discharge Predictive Intelligence</p>
          </div>
        </div>

        <nav className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-slate-800 text-cyan-300 shadow-sm border border-cyan-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-3">
          {isDemo ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>DEMO DATA</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>LIVE OUTPUTS</span>
            </div>
          )}

          <button
            onClick={reload}
            title="Reload data outputs"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

