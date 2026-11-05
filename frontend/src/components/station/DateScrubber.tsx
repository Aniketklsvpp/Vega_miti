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
    <div className="bg-[#FAF6EE] border border-[#DDD1BF] rounded-xl p-4 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DDD1BF] pb-3">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-4 h-4 text-[#2F7F8F]" />
          <span className="text-[#526573]">Observation Date:</span>
          <span className="text-sm font-bold text-[#1F2A33]">{currentDate}</span>
          {isExtreme && (
            <span className="px-2 py-0.5 rounded bg-[#FBECE9] text-[#D8432B] border border-[#D8432B]/30 text-[10px] font-bold">
              EXTREME DISCHARGE
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs">
          {currentActual !== undefined && currentActual !== null && (
            <div>
              <span className="text-[#1F2A33] font-semibold">Observed Actual:</span>{' '}
              <span className="text-[#1F2A33] font-bold font-mono">{currentActual.toFixed(1)} cfs</span>
            </div>
          )}
          {currentPredicted !== undefined && currentPredicted !== null && (
            <div>
              <span className="text-[#2F7F8F] font-semibold">Model Estimate:</span>{' '}
              <span className="text-[#1F2A33] font-bold font-mono">{currentPredicted.toFixed(1)} cfs</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-1.5 rounded-lg bg-[#EAE1D2] hover:bg-[#DDD1BF] text-[#1F2A33] transition cursor-pointer"
          title={isPlaying ? 'Pause replay' : 'Play timeline'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => onSelectIndex(Math.max(selectedIndex - 1, 0))}
          disabled={selectedIndex === 0}
          className="p-1.5 rounded-lg bg-[#EAE1D2] hover:bg-[#DDD1BF] text-[#1F2A33] disabled:opacity-30 transition cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <input
          type="range"
          min={0}
          max={dates.length - 1}
          value={selectedIndex}
          onChange={(e) => onSelectIndex(Number(e.target.value))}
          className="flex-1 accent-[#2F7F8F] cursor-pointer h-1.5 bg-[#EAE1D2] rounded-lg appearance-none"
        />

        <button
          onClick={() => onSelectIndex(Math.min(selectedIndex + 1, dates.length - 1))}
          disabled={selectedIndex === dates.length - 1}
          className="p-1.5 rounded-lg bg-[#EAE1D2] hover:bg-[#DDD1BF] text-[#1F2A33] disabled:opacity-30 transition cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
