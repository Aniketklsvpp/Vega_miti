import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { AdapterStatus, AnalysisTab, RegionType, SceneType } from '../types/data'
import { loadRiverIntelligenceData } from '../adapter/dataAdapter'

interface RiverDataContextValue {
  status: AdapterStatus
  scene: SceneType
  setScene: (scene: SceneType) => void
  region: RegionType
  setRegion: (region: RegionType) => void
  activeTab: AnalysisTab
  setActiveTab: (tab: AnalysisTab) => void
  selectedStationId: string | null
  setSelectedStationId: (id: string | null) => void
  switchRegionAndEnterMap: (r: RegionType) => void
  returnToGlobe: () => void
  reload: () => void
}

const RiverDataContext = createContext<RiverDataContextValue | null>(null)

export const RiverDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scene, setScene] = useState<SceneType>('globe')
  const [region, setRegion] = useState<RegionType>('usa')
  const [activeTab, setActiveTab] = useState<AnalysisTab>('map')
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [status, setStatus] = useState<AdapterStatus>({ status: 'loading' })

  const reload = useCallback(() => {
    setStatus({ status: 'loading' })
    loadRiverIntelligenceData(region).then((res) => {
      if (res.success) {
        setStatus({ status: 'ready', data: res.payload })
        if (res.payload.stations.length > 0) {
          setSelectedStationId(res.payload.stations[0].station_id)
        }
      } else {
        setStatus({
          status: 'error',
          message: res.error,
          missingField: res.missingField,
          file: res.file,
        })
      }
    })
  }, [region])

  useEffect(() => {
    reload()
  }, [reload])

  const switchRegionAndEnterMap = useCallback((r: RegionType) => {
    setRegion(r)
    setActiveTab('map')
    setScene('map')
  }, [])

  const returnToGlobe = useCallback(() => {
    setScene('globe')
  }, [])

  return (
    <RiverDataContext.Provider
      value={{
        status,
        scene,
        setScene,
        region,
        setRegion,
        activeTab,
        setActiveTab,
        selectedStationId,
        setSelectedStationId,
        switchRegionAndEnterMap,
        returnToGlobe,
        reload,
      }}
    >
      {children}
    </RiverDataContext.Provider>
  )
}

export function useRiverData(): RiverDataContextValue {
  const ctx = useContext(RiverDataContext)
  if (!ctx) {
    throw new Error('useRiverData must be used within RiverDataProvider')
  }
  return ctx
}
