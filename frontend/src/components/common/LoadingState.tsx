import React from 'react'
import { Droplets } from 'lucide-react'

export const LoadingState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="relative flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-2 border-[#DCE4E9] border-t-[#28A6A1] animate-spin" />
        <Droplets className="w-5 h-5 text-[#28A6A1] absolute animate-pulse" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-[#19364A]">Ingesting River Telemetry...</p>
        <p className="text-xs text-[#647786]">Calibrating catchment forecasts and validation matrices</p>
      </div>
    </div>
  )
}
