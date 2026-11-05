import React from 'react'
import { Calendar, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react'

interface DateScrubberProps {
  dates: string[]
  selectedIndex: number
  onSelectIndex: (index: number) => void
  currentActual?: number | null
  currentPredicted?: number | null
  isExtreme?: boolean
}

export const DateScrubber: React.FC<DateScrubberProps> = ({
  dates,
  selectedIndex,
  onSelectIndex,
  currentActual,
  currentPredicted,
  isExtreme,
}) => {
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false)
  const timerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        onSelectIndex((selectedIndex + 1) % dates.length)
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, selectedIndex, dates.length, onSelectIndex])

  if (dates.length === 0) return null

  const currentDate = dates[selectedIndex] || dates[0]

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-5 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/10 pb-3">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-4 h-4 text-[#2563EB]" />
          <span className="text-black/60 font-medium">Observation Date:</span>
          <span className="text-sm font-bold font-mono text-black">{currentDate}</span>
          {isExtreme && (
            <span className="px-2 py-0.5 rounded-lg bg-[#D9531E]/10 text-[#D9531E] border border-[#D9531E]/30 text-[10px] font-bold">
              EXTREME DISCHARGE
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs">
          {currentActual !== undefined && currentActual !== null && (
            <div>
              <span className="text-black/60 font-medium">Observed Actual:</span>{' '}
              <span className="text-black font-bold font-mono">{currentActual.toFixed(1)} cfs</span>
            </div>
          )}
          {currentPredicted !== undefined && currentPredicted !== null && (
            <div>
              <span className="text-[#2563EB] font-semibold">Model Estimate:</span>{' '}
              <span className="text-black font-bold font-mono">{currentPredicted.toFixed(1)} cfs</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-2 rounded-xl bg-white hover:bg-black/5 text-black border border-black/15 transition cursor-pointer shadow-2xs"
          title={isPlaying ? 'Pause replay' : 'Play timeline'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => onSelectIndex(Math.max(selectedIndex - 1, 0))}
          disabled={selectedIndex === 0}
          className="p-2 rounded-xl bg-white hover:bg-black/5 text-black border border-black/15 disabled:opacity-30 transition cursor-pointer shadow-2xs"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <input
          type="range"
          min={0}
          max={dates.length - 1}
          value={selectedIndex}
          onChange={(e) => onSelectIndex(Number(e.target.value))}
          className="flex-1 accent-[#2563EB] cursor-pointer h-2 bg-black/10 rounded-lg appearance-none"
        />

        <button
          onClick={() => onSelectIndex(Math.min(selectedIndex + 1, dates.length - 1))}
          disabled={selectedIndex === dates.length - 1}
          className="p-2 rounded-xl bg-white hover:bg-black/5 text-black border border-black/15 disabled:opacity-30 transition cursor-pointer shadow-2xs"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
