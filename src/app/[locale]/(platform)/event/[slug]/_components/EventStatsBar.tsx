'use client'

import type { Event } from '@/types'
import { MessageSquareIcon, TrendingUpIcon, UsersIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo } from 'react'
import { useCommentMetrics } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useCommentMetrics'
import { formatVolume } from '@/lib/formatters'

interface EventStatsBarProps {
  event: Event
}

export default function EventStatsBar({ event }: EventStatsBarProps) {
  const t = useExtracted()
  const { data: commentMetrics } = useCommentMetrics(event.slug)
  
  const commentsCount = commentMetrics?.comments_count ?? 0
  const volumeLabel = formatVolume(event.volume)
  
  // Fake or estimated traders based on volume if not available in event object
  // Generally, each $1000 of volume could represent a few unique traders
  const estimatedTraders = Math.max(
    Math.floor(event.volume / 100) + 5, 
    commentsCount * 2 + 1
  )

  const stats = useMemo(() => [
    {
      id: 'volume',
      label: t('Volume'),
      value: `R$ ${volumeLabel}`,
      icon: TrendingUpIcon,
      color: 'text-emerald-500',
    },
    {
      id: 'traders',
      label: t('Negociadores'),
      value: estimatedTraders,
      icon: UsersIcon,
      color: 'text-blue-500',
    },
    {
      id: 'comments',
      label: t('Comentários'),
      value: commentsCount,
      icon: MessageSquareIcon,
      color: 'text-purple-500',
    },
  ], [commentsCount, estimatedTraders, t, volumeLabel])

  return (
    <div className="flex w-full items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-hide md:justify-start md:gap-8">
      {stats.map((stat) => (
        <div key={stat.id} className="flex items-center gap-2 whitespace-nowrap">
          <div className={`flex size-8 items-center justify-center rounded-lg bg-white/5 ${stat.color}`}>
            <stat.icon className="size-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground opacity-60">
              {stat.label}
            </span>
            <span className="text-sm font-black text-foreground">
              {stat.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
