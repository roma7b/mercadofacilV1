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
          group relative flex w-full cursor-pointer flex-col p-4 mb-2 rounded-xl border border-border/50 
          bg-card/30 backdrop-blur-sm transition-all duration-300 ease-in-out
          hover:border-primary/40 hover:shadow-[0_0_20px_rgba(var(--primary),0.05)]
          lg:flex-row lg:items-center lg:px-6
        `,
        isExpanded && 'border-primary/30 bg-primary/5'
      )}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={onToggle}
    >
      <div className="flex flex-1 flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Lado Esquerdo: Título e Volume */}
        <div className="flex items-center gap-4 lg:w-1/3">
          {shouldShowIcon && (
            <EventIconImage
              src={market.icon_url}
              alt={market.title}
              sizes="48px"
              containerClassName="size-12 shrink-0 rounded-lg shadow-sm"
            />
          )}
          <div className="flex flex-col min-w-0">
            <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors truncate">
              {market.title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                R$ {resolvedVolume?.toLocaleString('pt-BR') || '0,00'} Vol.
              </span>
            </div>
          </div>
        </div>

        {/* Centro: Probabilidade */}
        <div className="flex items-center justify-center lg:w-1/4">
          <EventMarketChance
            market={market}
            chanceMeta={chanceMeta}
            layout="desktop"
            highlightKey={chanceHighlightKey}
            showInReviewTag={showInReviewTag}
          />
        </div>

        {/* Lado Direito: Botões de Compra */}
        <div className="flex items-center gap-2 lg:w-1/3 lg:justify-end">
          <Button
            size="sm"
            className={cn(
              "flex-1 lg:flex-none lg:w-32 h-11 rounded-lg font-bold transition-all",
              "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20",
              isActiveMarket && activeOutcomeIndex === OUTCOME_INDEX.YES && "ring-2 ring-white ring-offset-2 ring-offset-emerald-500"
            )}
            onClick={(event) => {
              event.stopPropagation()
              onBuy(market, OUTCOME_INDEX.YES, isMobile ? 'mobile' : 'desktop')
            }}
          >
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider opacity-80">{t('Buy')} Sim</span>
              <span className="text-base">{formatCentsLabel(yesPriceValue)}</span>
            </div>
          </Button>

          <Button
            size="sm"
            className={cn(
              "flex-1 lg:flex-none lg:w-32 h-11 rounded-lg font-bold transition-all",
              "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20",
              isActiveMarket && activeOutcomeIndex === OUTCOME_INDEX.NO && "ring-2 ring-red-500 ring-offset-2"
            )}
            onClick={(event) => {
              event.stopPropagation()
              onBuy(market, OUTCOME_INDEX.NO, isMobile ? 'mobile' : 'desktop')
            }}
          >
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider opacity-80">{t('Buy')} Não</span>
              <span className="text-base">{formatCentsLabel(noPriceValue)}</span>
            </div>
          </Button>
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
