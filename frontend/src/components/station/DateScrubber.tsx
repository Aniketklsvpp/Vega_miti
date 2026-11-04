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
    <div className="bg-white border border-[#DCE4E9] rounded-xl p-4 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DCE4E9] pb-3">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-4 h-4 text-[#28A6A1]" />
          <span className="text-[#647786]">Observation Date:</span>
          <span className="text-sm font-bold text-[#19364A]">{currentDate}</span>
          {isExtreme && (
            <span className="px-2 py-0.5 rounded bg-[#FFF1F2] text-[#C94C55] border border-[#FECDD3] text-[10px] font-bold">
              EXTREME DISCHARGE
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs">
          {currentActual !== undefined && currentActual !== null && (
            <div>
              <span className="text-[#19364A] font-semibold">Observed Actual:</span>{' '}
              <span className="text-[#19364A] font-bold">{currentActual.toFixed(1)} cfs</span>
            </div>
          )}
          {currentPredicted !== undefined && currentPredicted !== null && (
            <div>
              <span className="text-[#28A6A1] font-semibold">Model Estimate:</span>{' '}
              <span className="text-[#19364A] font-bold">{currentPredicted.toFixed(1)} cfs</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-1.5 rounded-lg bg-[#EAF0F3] hover:bg-[#DCE4E9] text-[#19364A] transition"
          title={isPlaying ? 'Pause replay' : 'Play timeline'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => onSelectIndex(Math.max(selectedIndex - 1, 0))}
          disabled={selectedIndex === 0}
          className="p-1.5 rounded-lg bg-[#EAF0F3] hover:bg-[#DCE4E9] text-[#19364A] disabled:opacity-30 transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <input
          type="range"
          min={0}
          max={dates.length - 1}
          value={selectedIndex}
          onChange={(e) => onSelectIndex(Number(e.target.value))}
          className="flex-1 accent-[#28A6A1] cursor-pointer h-1.5 bg-[#EAF0F3] rounded-lg appearance-none"
        />

        <button
          onClick={() => onSelectIndex(Math.min(selectedIndex + 1, dates.length - 1))}
          disabled={selectedIndex === dates.length - 1}
          className="p-1.5 rounded-lg bg-[#EAF0F3] hover:bg-[#DCE4E9] text-[#19364A] disabled:opacity-30 transition"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
