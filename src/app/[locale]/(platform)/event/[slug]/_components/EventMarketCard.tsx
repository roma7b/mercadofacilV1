'use client'

import type { EventMarketRow } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMarketRows'
import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { memo, useMemo } from 'react'
import EventMarketChance from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChance'
import EventIconImage from '@/components/EventIconImage'
import { Button } from '@/components/ui/button'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { OUTCOME_INDEX } from '@/lib/constants'
import { formatCentsLabel, formatSharesLabel } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export interface MarketPositionTag {
  outcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
  label: string
  shares: number
  avgPrice: number | null
}

interface EventMarketCardProps {
  row: EventMarketRow
  showMarketIcon: boolean
  isExpanded: boolean
  isActiveMarket: boolean
  showInReviewTag?: boolean
  activeOutcomeIndex: number | null
  onToggle: () => void
  onBuy: (market: EventMarketRow['market'], outcomeIndex: number, source: 'mobile' | 'desktop') => void
  chanceHighlightKey: string
  positionTags?: MarketPositionTag[]
  openOrdersCount?: number
  isMobile: boolean
  onCashOut?: (market: EventMarketRow['market'], tag: MarketPositionTag) => void
}

function EventMarketCardComponent({
  row,
  showMarketIcon,
  isExpanded,
  isActiveMarket,
  showInReviewTag = false,
  activeOutcomeIndex,
  onToggle,
  onBuy,
  chanceHighlightKey,
  positionTags = [],
  openOrdersCount = 0,
  onCashOut,
  isMobile,
}: EventMarketCardProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const { market, yesOutcome, noOutcome, yesPriceValue, noPriceValue, chanceMeta } = row
  const yesOutcomeText = normalizeOutcomeLabel(yesOutcome?.outcome_text) ?? t('Yes')
  const noOutcomeText = normalizeOutcomeLabel(noOutcome?.outcome_text) ?? t('No')
  const resolvedPositionTags = positionTags.filter(tag => tag.shares > 0)
  const hasOpenOrders = openOrdersCount > 0
  const shouldShowTags = resolvedPositionTags.length > 0 || hasOpenOrders
  const shouldShowIcon = showMarketIcon && Boolean(market.icon_url)
  const volumeRequestPayload = useMemo(() => {
    const tokenIds = [yesOutcome?.token_id, noOutcome?.token_id].filter(Boolean) as string[]
    if (!market.condition_id || tokenIds.length < 2) {
      return { conditions: [], signature: '' }
    }

    const signature = `${market.condition_id}:${tokenIds.join(':')}`
    return {
      conditions: [{ condition_id: market.condition_id, token_ids: tokenIds.slice(0, 2) as [string, string] }],
      signature,
    }
  }, [market.condition_id, noOutcome?.token_id, yesOutcome?.token_id])

  const { data: volumeFromApi } = useQuery({
    queryKey: ['trade-volumes', market.condition_id, volumeRequestPayload.signature],
    enabled: volumeRequestPayload.conditions.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const response = await fetch(`${process.env.CLOB_URL}/data/volumes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          include_24h: false,
          conditions: volumeRequestPayload.conditions,
        }),
      })

      const payload = await response.json() as Array<{
        condition_id: string
        status: number
        volume?: string
      }>

      return payload
        .filter(entry => entry?.status === 200)
        .reduce((total, entry) => {
          const numeric = Number(entry.volume ?? 0)
          return Number.isFinite(numeric) ? total + numeric : total
        }, 0)
    },
  })

  const resolvedVolume = useMemo(() => {
    if (typeof volumeFromApi === 'number' && Number.isFinite(volumeFromApi)) {
      return volumeFromApi
    }
    return market.volume
  }, [market.volume, volumeFromApi])

  return (
    <div
      className={cn(
        `
          group relative mb-1 flex w-full cursor-pointer flex-row items-center justify-between rounded-lg border border-border/30
          bg-card/15 px-3 py-3 transition-all duration-200 hover:border-border/60 hover:bg-card/35
          lg:px-4
        `,
        isExpanded && 'bg-primary/5 border-primary/20'
      )}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={onToggle}
    >
      <div className="flex flex-row flex-1 items-center justify-between gap-3 overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          {shouldShowIcon && (
            <EventIconImage
              src={market.icon_url}
              alt={market.title}
              sizes="32px"
              containerClassName="size-8 shrink-0 rounded-full shadow-sm"
            />
          )}
          <div className="flex min-w-0 flex-col pr-1">
            <h3 className="truncate text-[13px] leading-tight font-semibold text-foreground transition-colors group-hover:text-primary sm:text-sm">
              {market.short_title || market.title}
            </h3>
            <span className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
              Vol. R$ {Number(resolvedVolume || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 lg:gap-3">
          <div className="w-14 text-right md:w-16">
            <span
              className="cursor-pointer text-[13px] font-bold text-foreground transition-colors hover:text-primary md:text-sm"
              onClick={(event) => {
                event.stopPropagation()
                onBuy(market, OUTCOME_INDEX.YES, isMobile ? 'mobile' : 'desktop')
              }}
              title={t('Click to trade Sim')}
            >
              {chanceMeta.chanceDisplay}
            </span>
          </div>

          <div className="ml-1.5 flex items-center gap-1.5">
            <Button
              size="sm"
              className={cn(
                "flex h-9 w-[70px] items-center justify-between rounded-md px-2 text-left font-bold transition-all sm:w-[78px] md:w-[92px] md:px-3",
                "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500",
                isActiveMarket && activeOutcomeIndex === OUTCOME_INDEX.YES && "ring-1 ring-emerald-500 bg-emerald-500/30"
              )}
              onClick={(event) => {
                event.stopPropagation()
                onBuy(market, OUTCOME_INDEX.YES, isMobile ? 'mobile' : 'desktop')
              }}
            >
              <span className="hidden text-[9px] font-bold tracking-tight uppercase opacity-90 sm:inline-block md:text-[10px]">Sim</span>
              <span className="text-[11px] md:text-sm mx-auto sm:mx-0">{formatCentsLabel(yesPriceValue)}</span>
            </Button>

            <Button
              size="sm"
              className={cn(
                "flex h-9 w-[70px] items-center justify-between rounded-md px-2 text-left font-bold transition-all sm:w-[78px] md:w-[92px] md:px-3",
                "bg-red-500/10 hover:bg-red-500/20 text-red-500",
                isActiveMarket && activeOutcomeIndex === OUTCOME_INDEX.NO && "ring-1 ring-red-500 bg-red-500/30"
              )}
              onClick={(event) => {
                event.stopPropagation()
                onBuy(market, OUTCOME_INDEX.NO, isMobile ? 'mobile' : 'desktop')
              }}
            >
              <span className="hidden text-[9px] font-bold tracking-tight uppercase opacity-90 sm:inline-block md:text-[10px]">Não</span>
              <span className="mx-auto text-[11px] sm:mx-0 md:text-sm">{formatCentsLabel(noPriceValue)}</span>
            </Button>
          </div>
        </div>
      </div>
      
      {shouldShowTags && (
        <div className="absolute -bottom-2 right-4 translate-y-1/2">
          <PositionTags
            tags={resolvedPositionTags}
            openOrdersCount={openOrdersCount}
            onCashOut={tag => onCashOut?.(market, tag)}
          />
        </div>
      )}
    </div>
  )
}

const EventMarketCard = memo(EventMarketCardComponent)

export default EventMarketCard

function PositionTags({
  tags,
  openOrdersCount = 0,
  onCashOut,
}: {
  tags: MarketPositionTag[]
  openOrdersCount?: number
  onCashOut?: (tag: MarketPositionTag) => void
}) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const hasOpenOrders = openOrdersCount > 0
  const openOrdersLabel = `${openOrdersCount} open order${openOrdersCount === 1 ? '' : 's'}`
  return (
    <div className="flex flex-wrap gap-1">
      {hasOpenOrders && (
        <div className={`
          inline-flex items-center rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-xs/tight font-semibold text-amber-700
          dark:text-amber-200
        `}
        >
          {openOrdersLabel}
        </div>
      )}
      {tags.map((tag) => {
        const isYes = tag.outcomeIndex === OUTCOME_INDEX.YES
        const label = normalizeOutcomeLabel(tag.label) || (isYes ? t('Yes') : t('No'))
        const sharesLabel = formatSharesLabel(tag.shares)
        const avgPriceLabel = formatCentsLabel(tag.avgPrice, { fallback: '—' })

        return (
          <div
            key={`${tag.outcomeIndex}-${label}`}
            className={cn(
              `group inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs/tight font-semibold transition-all`,
              isYes ? 'bg-yes/15 text-yes-foreground' : 'bg-no/15 text-no-foreground',
            )}
          >
            <span className="whitespace-nowrap">
              {label}
              {' '}
              {sharesLabel}
              {' '}
              •
              {' '}
              {avgPriceLabel}
            </span>
            <button
              type="button"
              className={cn(
                'ml-1 inline-flex w-0 items-center justify-center overflow-hidden opacity-0',
                'transition-all duration-200 group-hover:w-3 group-hover:opacity-100',
                'pointer-events-none group-hover:pointer-events-auto',
              )}
              aria-label={`Sell ${label} shares`}
              onClick={(event) => {
                event.stopPropagation()
                onCashOut?.(tag)
              }}
            >
              <XIcon className="size-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
