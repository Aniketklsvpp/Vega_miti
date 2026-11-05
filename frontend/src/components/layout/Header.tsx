import React, { useState } from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'
import { useRiverData } from '../../context/RiverDataContext'
import type { AnalysisTab } from '../../types/data'

export const Header: React.FC = () => {
  const {
    scene,
    setScene,
    region,
    activeTab,
    setActiveTab,
    switchRegionAndEnterMap,
    reload,
  } = useRiverData()

  const [regionMenuOpen, setRegionMenuOpen] = useState(false)

  // When on catchment map or deeper analysis, show analysis tabs matching Image 2
  const isCatchmentView = activeTab === 'map' || activeTab === 'station' || activeTab === 'trust' || activeTab === 'flood'

  const dashboardTabs = [
    { id: 'dashboard' as AnalysisTab, label: 'Dashboard' },
    { id: 'map' as AnalysisTab, label: 'Globe' },
    { id: 'swarm' as AnalysisTab, label: 'Swarm' },
    { id: 'missions' as AnalysisTab, label: 'Missions' },
    { id: 'replay' as AnalysisTab, label: 'Replay' },
    { id: 'benchmarks' as AnalysisTab, label: 'Evaluation' },
    { id: 'station' as AnalysisTab, label: 'Data' },
  ]

  const catchmentTabs = [
    { id: 'dashboard' as AnalysisTab, label: 'Dashboard' },
    { id: 'globe' as const, label: 'Globe' },
    { id: 'map' as AnalysisTab, label: 'Catchment Map' },
    { id: 'station' as AnalysisTab, label: 'Station Hydrograph' },
    { id: 'trust' as AnalysisTab, label: 'Model Trust' },
    { id: 'flood' as AnalysisTab, label: 'Flood Intelligence' },
  ]

  return (
    <header className="bg-white px-4 sm:px-8 lg:px-12 py-4 border-b border-black/5 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <button
          onClick={() => {
            setActiveTab('dashboard')
            setScene('map')
          }}
          className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
        >
          <div className="w-10 h-10 flex items-center justify-center">
            {/* Custom organic double-wave logo in vibrant blue matching reference */}
            <svg
              className="w-9 h-9 text-[#2563EB] transition-transform group-hover:scale-105"
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 20C7 11 12 11 16 20C20 29 25 29 29 20C31 15.5 33 15 35 17"
                stroke="#2563EB"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div className="font-black text-xl tracking-tight text-black leading-none">
              VEGA-MITI
            </div>
            <div className="text-[11px] text-black/60 font-medium tracking-tight mt-0.5">
              Flood Intelligence & Swarm Coordination
            </div>
          </div>
        </button>

        {/* Minimal Rounded Pill Navigation matching Reference Images 1 & 2 */}
        <div className="flex flex-wrap items-center gap-2">
          {!isCatchmentView ? (
            // Reference Image 1 Pills
            dashboardTabs.map((t) => {
              const isActive = (activeTab === 'dashboard' && t.id === 'dashboard') ||
                               (activeTab === t.id && t.id !== 'dashboard')
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (t.id === 'map') {
                      switchRegionAndEnterMap(region)
                    } else {
                      setActiveTab(t.id)
                      setScene('map')
                    }
                  }}
                  className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-white text-black border border-black/30 hover:border-black hover:bg-black/5'
                  }`}
                >
                  {t.label}
                </button>
              )
            })
          ) : (
            // Reference Image 2 Pills
            <>
              {catchmentTabs.map((t) => {
                const isActive = t.id === 'globe'
                  ? scene === 'globe'
                  : activeTab === t.id && scene !== 'globe'

                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (t.id === 'globe') {
                        setScene('globe')
                      } else if (t.id === 'dashboard') {
                        setActiveTab('dashboard')
                        setScene('map')
                      } else {
                        setActiveTab(t.id)
                        setScene('map')
                      }
                    }}
                    className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-black text-white shadow-xs'
                        : 'bg-white text-black border border-black/30 hover:border-black hover:bg-black/5'
                    }`}
                  >
                    {t.label}
                  </button>
                )
              })}

              <div className="h-5 w-[1px] bg-black/25 mx-1 hidden sm:block" />

              {/* Region Selector Pill matching Image 2 */}
              <div className="relative">
                <button
                  onClick={() => setRegionMenuOpen(!regionMenuOpen)}
                  className="px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold bg-white text-black border border-black/30 hover:border-black flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>Region: {region === 'india' ? 'India' : 'USA'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-black/70" />
                </button>

                {regionMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-black/20 rounded-2xl shadow-xl py-1 z-50">
                    <button
                      onClick={() => {
                        switchRegionAndEnterMap('usa')
                        setRegionMenuOpen(false)
                      }}
                      className={`w-full px-4 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-black/5 cursor-pointer ${
                        region === 'usa' ? 'text-[#2563EB] font-bold' : 'text-black'
                      }`}
                    >
                      <span>USA (22 Stations)</span>
                      {region === 'usa' && <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />}
                    </button>
                    <button
                      onClick={() => {
                        switchRegionAndEnterMap('india')
                        setRegionMenuOpen(false)
                      }}
                      className={`w-full px-4 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-black/5 cursor-pointer ${
                        region === 'india' ? 'text-[#2563EB] font-bold' : 'text-black'
                      }`}
                    >
                      <span>India (Catchment Demo)</span>
                      {region === 'india' && <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Quick Telemetry Refresh */}
          <button
            onClick={reload}
            title="Refresh hydrological telemetry"
            className="p-2 rounded-full text-black hover:bg-black/5 border border-black/20 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
