'use client'

import { useExtracted } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface EventMarketCountdownProps {
  endDate: string | null | undefined
  className?: string
}

export default function EventMarketCountdown({ endDate, className }: EventMarketCountdownProps) {
  const t = useExtracted()
  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
    total: number
  } | null>(null)

  useEffect(() => {
    if (!endDate) return

    const targetDate = new Date(endDate).getTime()

    const updateCountdown = () => {
      const now = new Date().getTime()
      const diff = targetDate - now

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 })
        return
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        total: diff,
      })
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [endDate])

  if (!timeLeft || timeLeft.total <= 0) return null

  const isLowTime = timeLeft.total < 1000 * 60 * 60 * 24 // Menos de 24h

  return (
    <div className={cn("flex flex-col items-center gap-2 py-4", className)}>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
        {t('O mercado fechará em')}
      </span>
      
      <div className="flex items-center gap-3">
        {[
          { label: t('Dias'), value: timeLeft.days },
          { label: t('Horas'), value: timeLeft.hours },
          { label: t('Min'), value: timeLeft.minutes },
          { label: t('Seg'), value: timeLeft.seconds },
        ].map((item, idx, arr) => (
          <div key={item.label} className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <span className={cn(
                "font-mono text-xl font-black tabular-nums leading-none",
                isLowTime ? "text-rose-500" : "text-white"
              )}>
                {item.value.toString().padStart(2, '0')}
              </span>
              <span className="text-[9px] font-bold uppercase text-zinc-600 mt-1">
                {item.label}
              </span>
            </div>
            {idx < arr.length - 1 && (
              <span className="text-zinc-700 font-bold mb-4">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
