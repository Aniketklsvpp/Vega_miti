import React from 'react'
import { Droplets } from 'lucide-react'

export const LoadingState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
        <Droplets className="w-6 h-6 text-cyan-400 absolute animate-pulse" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium tracking-wide text-slate-200">Ingesting River Telemetry...</p>
        <p className="text-xs text-slate-500 font-mono">Calibrating catchment forecasts and validation matrices</p>
      </div>
    </div>
  )
}
