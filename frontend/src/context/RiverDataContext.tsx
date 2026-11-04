import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { AdapterStatus } from '../types/data'
import { loadRiverIntelligenceData } from '../adapter/dataAdapter'

export type TabType = 'overview' | 'station' | 'trust' | 'spotlight'

interface RiverDataContextValue {
  status: AdapterStatus
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  selectedStationId: string | null
  setSelectedStationId: (id: string | null) => void
  reload: () => void
}

const RiverDataContext = createContext<RiverDataContextValue | null>(null)

export const RiverDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AdapterStatus>({ status: 'loading' })
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)

  const reload = useCallback(() => {
    setStatus({ status: 'loading' })
    loadRiverIntelligenceData().then((res) => {
      if (res.success) {
        setStatus({ status: 'ready', data: res.payload })
        if (res.payload.stations.length > 0) {
          setSelectedStationId((prev) => prev ?? res.payload.stations[0].station_id)
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
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <RiverDataContext.Provider
      value={{
        status,
        activeTab,
        setActiveTab,
        selectedStationId,
        setSelectedStationId,
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

