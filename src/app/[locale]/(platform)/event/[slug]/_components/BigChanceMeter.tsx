'use client'

import { useExtracted } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface BigChanceMeterProps {
  marketSlug: string
  className?: string
}

export default function BigChanceMeter({ marketSlug, className }: BigChanceMeterProps) {
  const t = useExtracted()
  const [data, setData] = useState<{ sim: number; nao: number } | null>(null)

  useEffect(() => {
    const fetchPool = async () => {
      try {
        const res = await fetch(`/api/mercado/${marketSlug}`)
        const json = await res.json()
        if (json.success && json.data) {
          const sim = Number(json.data.total_sim) || 0
          const nao = Number(json.data.total_nao) || 0
          const total = sim + nao
          if (total > 0) {
            setData({
              sim: Math.round((sim / total) * 100),
              nao: Math.round((nao / total) * 100),
            })
          } else {
              setData({ sim: 50, nao: 50 })
          }
        }
      } catch (err) {
        console.error('BigChanceMeter fetch error:', err)
      }
    }

    fetchPool()
    const interval = setInterval(fetchPool, 30000)
    return () => clearInterval(interval)
  }, [marketSlug])

  if (!data) return null

  return (
    <div className={cn("w-full bg-[#1e2836] rounded-3xl p-6 border border-white/5 shadow-2xl backdrop-blur-xl", className)}>
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
           <div className="size-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
             <div className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
           </div>
           <span className="text-sm font-black uppercase tracking-widest text-emerald-500">{t('Sim')}</span>
        </div>
        
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">{t('Chance')}</span>

        <div className="flex items-center gap-2">
           <span className="text-sm font-black uppercase tracking-widest text-rose-500">{t('Não')}</span>
           <div className="size-6 rounded-full bg-rose-500/20 flex items-center justify-center">
             <div className="size-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
           </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-8 mb-4">
          <span className="text-5xl font-mono font-black text-white tracking-tighter">{data.sim}%</span>
          <span className="text-5xl font-mono font-black text-white tracking-tighter">{data.nao}%</span>
      </div>

      <div className="relative h-4 w-full bg-zinc-800 rounded-full overflow-hidden flex shadow-inner">
          <div 
            className="h-full bg-emerald-500 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(16,185,129,0.4)]" 
            style={{ width: `${data.sim}%` }} 
          />
          <div 
            className="h-full bg-rose-500 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(244,63,94,0.4)]" 
            style={{ width: `${data.nao}%` }} 
          />
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-zinc-900/50 -translate-x-1/2" />
      </div>
    </div>
  )
}
