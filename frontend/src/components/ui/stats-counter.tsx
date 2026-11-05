import { useEffect, useRef, useState } from 'react'
import { useInView, useMotionValue, useSpring } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface StatsCounterProps {
  value: number | null | undefined
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
  fallback?: string
}

export default function StatsCounter({
  value,
  duration = 1.2,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
  fallback = '—',
}: StatsCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, { duration: duration * 1000, bounce: 0 })
  const [displayValue, setDisplayValue] = useState<number>(0)

  const isNumeric = typeof value === 'number' && !isNaN(value) && isFinite(value)

  useEffect(() => {
    if (isInView && isNumeric) {
      motionValue.set(value)
    }
  }, [isInView, isNumeric, value, motionValue])

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      setDisplayValue(latest)
    })
    return unsubscribe
  }, [springValue])

  if (!isNumeric) {
    return (
      <span ref={ref} className={cn('tabular-nums', className)}>
        {fallback}
      </span>
    )
  }

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  )
}

export { StatsCounter }
