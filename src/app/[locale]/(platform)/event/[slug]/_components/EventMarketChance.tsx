'use client'

import type { EventMarketRow } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMarketRows'
import { ExternalLinkIcon, TriangleIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import ResolutionTimelinePanel from '@/app/[locale]/(platform)/event/[slug]/_components/ResolutionTimelinePanel'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { buildUmaProposeUrl, buildUmaSettledUrl } from '@/lib/uma'
import { cn } from '@/lib/utils'

interface EventMarketChanceProps {
  market: EventMarketRow['market']
  chanceMeta: EventMarketRow['chanceMeta']
  layout: 'mobile' | 'desktop'
  highlightKey: string
  showInReviewTag?: boolean
}

export default function EventMarketChance({
  market,
  chanceMeta,
  layout,
  highlightKey,
  showInReviewTag = false,
}: EventMarketChanceProps) {
  const t = useExtracted()
  const siteIdentity = useSiteIdentity()
  const [isResolutionDialogOpen, setIsResolutionDialogOpen] = useState(false)
  const [poolChance, setPoolChance] = useState<number | null>(null)

  useEffect(() => {
    if (!market.slug?.startsWith('live_') && !market.slug?.startsWith('poly-')) { return }

    const fetchPool = async () => {
      try {
        const res = await fetch(`/api/mercado/${market.slug}`)
        const json = await res.json()
        if (json.success && json.data) {
          const totalSim = Number(json.data.total_sim) || 0
          const totalNao = Number(json.data.total_nao) || 0
          const total = totalSim + totalNao
          if (total > 0) {
            setPoolChance(Math.round((totalSim / total) * 100))
          }
        }
      }
      catch (err) {
        console.error('Erro ao buscar pool no EventMarketChance:', err)
      }
    }

    fetchPool()
    const interval = setInterval(fetchPool, 30000)
    return () => clearInterval(interval)
  }, [market.slug])

  const chanceDisplayValue = poolChance !== null
    ? `${poolChance}%`
    : (chanceMeta.chanceDisplay === '—' ? (market.price ? `${Math.round(market.price * 100)}%` : '—') : chanceMeta.chanceDisplay)
  const isSubOnePercent = poolChance !== null ? false : chanceMeta.isSubOnePercent

  const chanceChangeColorClass = chanceMeta.isChanceChangePositive ? 'text-yes' : 'text-no'
  const shouldReserveDelta = layout === 'desktop' && !showInReviewTag
  const shouldRenderDelta = !showInReviewTag && (chanceMeta.shouldShowChanceChange || shouldReserveDelta)
  const umaDetailsUrl = useMemo(
    () => buildUmaSettledUrl(market.condition, siteIdentity.name) ?? buildUmaProposeUrl(market.condition, siteIdentity.name),
    [market.condition, siteIdentity.name],
  )

  const baseClass = layout === 'mobile'
    ? 'text-xl font-bold'
    : 'text-3xl font-black tracking-tight'

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-0',
        { 'gap-1': layout === 'desktop' },
      )}
    >
      <div className="flex items-center justify-center gap-1.5">
        <span
          key={`${layout}-chance-${highlightKey}`}
          className={cn(
            baseClass,
            isSubOnePercent ? 'text-muted-foreground' : 'text-foreground',
            'motion-safe:animate-[pulse_0.8s_ease-out] motion-reduce:animate-none',
            'tabular-nums transition-colors duration-500',
            poolChance !== null && poolChance > 50
              ? 'text-emerald-500'
              : poolChance !== null && poolChance < 50
                ? `text-red-500`
                : '',
          )}
        >
          {chanceDisplayValue}
        </span>
        {showInReviewTag && (
          <button
            type="button"
            className={`
              inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-xs/tight font-semibold whitespace-nowrap
              text-primary transition-colors
              hover:bg-primary/15
            `}
            onClick={(event) => {
              event.stopPropagation()
              setIsResolutionDialogOpen(true)
            }}
          >
            {t('In Review')}
          </button>
        )}
      </div>
      {shouldRenderDelta && (
        <div
          className={cn(
            'flex items-center justify-end gap-0.5 text-xs font-semibold',
            chanceChangeColorClass,
            { invisible: !chanceMeta.shouldShowChanceChange },
            { 'w-[5.5ch]': layout === 'desktop' },
          )}
        >
          <TriangleIcon
            className={cn('size-3 fill-current', { 'rotate-180': !chanceMeta.isChanceChangePositive })}
            fill="currentColor"
          />
          <span className="inline-block tabular-nums">
            {chanceMeta.chanceChangeLabel}
          </span>
        </div>
      )}

      {showInReviewTag && (
        <Dialog open={isResolutionDialogOpen} onOpenChange={setIsResolutionDialogOpen}>
          <DialogContent className="sm:max-w-lg sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-bold">{t('Resolution')}</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              <ResolutionTimelinePanel market={market} settledUrl={umaDetailsUrl} showLink={false} />
            </div>
            {umaDetailsUrl && (
              <div className="mt-3 flex justify-end">
                <a
                  href={umaDetailsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:underline"
                >
                  <span>{t('View details')}</span>
                  <ExternalLinkIcon className="size-3.5" />
                </a>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
