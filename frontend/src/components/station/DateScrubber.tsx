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
    <div className="bg-[#141824] border border-slate-800 rounded-xl p-4 shadow-lg space-y-3 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400">Telemetry Date:</span>
          <span className="text-sm font-bold text-slate-100">{currentDate}</span>
          {isExtreme && (
            <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800/60 text-[10px] font-bold">
              EXTREME FLOW
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs">
          {currentActual !== undefined && currentActual !== null && (
            <div>
              <span className="text-purple-400 font-semibold">Actual:</span>{' '}
              <span className="text-slate-200 font-bold">{currentActual.toFixed(1)} cfs</span>
            </div>
          )}
          {currentPredicted !== undefined && currentPredicted !== null && (
            <div>
              <span className="text-cyan-400 font-semibold">Estimate:</span>{' '}
              <span className="text-slate-200 font-bold">{currentPredicted.toFixed(1)} cfs</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          title={isPlaying ? 'Pause replay' : 'Play replay'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => onSelectIndex(Math.max(selectedIndex - 1, 0))}
          disabled={selectedIndex === 0}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <input
          type="range"
          min={0}
          max={dates.length - 1}
          value={selectedIndex}
          onChange={(e) => onSelectIndex(Number(e.target.value))}
          className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
        />

        <button
          onClick={() => onSelectIndex(Math.min(selectedIndex + 1, dates.length - 1))}
          disabled={selectedIndex === dates.length - 1}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-30 transition"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
