import type { EventSeriesEntry } from '@/types'
import { TriangleIcon } from 'lucide-react'
import { AnimatedCounter } from 'react-animated-counter'
import { OUTCOME_INDEX } from '@/lib/constants'
import { cn, sanitizeSvg } from '@/lib/utils'
import EventSeriesPills from './EventSeriesPills'
import EventTweetMarketsPanel from './EventTweetMarketsPanel'

interface EventChartHeaderProps {
  isSingleMarket: boolean
  activeOutcomeIndex: typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
  activeOutcomeLabel: string
  primarySeriesColor: string
  yesChanceValue: number | null
  effectiveBaselineYesChance: number | null
  effectiveCurrentYesChance: number | null
  watermark: { iconSvg?: string | null, label?: string | null }
  currentEventSlug?: string
  seriesEvents?: EventSeriesEntry[]
  showSeriesNavigation?: boolean
  showTweetMarketsPanel?: boolean
  tweetCount?: number | null
  tweetCountdownTargetMs?: number | null
  tweetMarketsFinal?: boolean
}

import { useQuery } from '@tanstack/react-query'

export default function EventChartHeader({
  isSingleMarket,
  activeOutcomeIndex,
  activeOutcomeLabel,
  primarySeriesColor,
  yesChanceValue,
  effectiveBaselineYesChance,
  effectiveCurrentYesChance,
  watermark,
  currentEventSlug,
  seriesEvents = [],
  showSeriesNavigation = true,
  showTweetMarketsPanel = false,
  tweetCount = null,
  tweetCountdownTargetMs = null,
  tweetMarketsFinal = false,
}: EventChartHeaderProps) {
  // Fallback para mercados importados ou live que não tem histórico de gráfico (CLOB) ainda
  const fallbackQuery = useQuery({
    queryKey: ['header-fallback', currentEventSlug],
    queryFn: async () => {
      if (!currentEventSlug) return null
      const res = await fetch(`/api/mercado/${currentEventSlug}`)
      const json = await res.json()
      if (json.success && json.data) {
        const sim = Number(json.data.total_sim) || 1
        const nao = Number(json.data.total_nao) || 1
        return (sim / (sim + nao)) * 100
      }
      return null
    },
    enabled: yesChanceValue === null && !!currentEventSlug && (currentEventSlug.startsWith('poly-') || currentEventSlug.startsWith('live-'))
  })

  const resolvedYesChance = yesChanceValue !== null 
    ? yesChanceValue 
    : (fallbackQuery.data ?? null);

  const seriesNavigation = showSeriesNavigation
    ? <EventSeriesPills currentEventSlug={currentEventSlug} seriesEvents={seriesEvents} />
    : null
  const tweetMarketsPanel = showTweetMarketsPanel
    ? (
        <EventTweetMarketsPanel
          tweetCount={tweetCount}
          countdownTargetMs={tweetCountdownTargetMs}
          isFinal={tweetMarketsFinal}
        />
      )
    : null

  if (!isSingleMarket) {
    if (!seriesNavigation && !tweetMarketsPanel) {
      return null
    }

    return (
      <div className="flex flex-col gap-2">
        {seriesNavigation}
        {tweetMarketsPanel}
      </div>
    )
  }

  const changeIndicator = (() => {
    if (
      effectiveBaselineYesChance === null
      || effectiveCurrentYesChance === null
      || !Number.isFinite(effectiveBaselineYesChance)
      || !Number.isFinite(effectiveCurrentYesChance)
    ) {
      return null
    }

    const rawChange = effectiveCurrentYesChance - effectiveBaselineYesChance
    const roundedChange = Math.round(rawChange)

    if (roundedChange === 0) {
      return null
    }

    const isPositive = roundedChange > 0
    const magnitude = Math.abs(roundedChange)
    const colorClass = isPositive ? 'text-yes' : 'text-no'

    return (
      <div className={cn('flex items-center gap-1 tabular-nums', colorClass)}>
        <TriangleIcon
          className="size-3.5"
          fill="currentColor"
          stroke="none"
          style={{ transform: isPositive ? 'rotate(0deg)' : 'rotate(180deg)' }}
        />
        <span className="text-xs font-semibold">
          {magnitude}
          %
        </span>
      </div>
    )
  })()

  return (
    <div className="flex flex-col gap-2">
      {seriesNavigation}
      {tweetMarketsPanel}

      <div className="flex flex-row items-end justify-between gap-3">
        <div className="flex flex-row items-end gap-3">
          <div
            className="flex flex-col gap-1 font-semibold tabular-nums"
            style={{ color: primarySeriesColor }}
          >
            {activeOutcomeIndex === OUTCOME_INDEX.NO && activeOutcomeLabel && (
              <span className="text-xs leading-none">
                {activeOutcomeLabel}
              </span>
            )}
            <div className="inline-flex items-baseline gap-0 text-2xl leading-none font-semibold">
              {typeof resolvedYesChance === 'number'
                ? (
                    <AnimatedCounter
                      value={resolvedYesChance}
                      color="currentColor"
                      fontSize="24px"
                      includeCommas={false}
                      includeDecimals={false}
                      incrementColor="currentColor"
                      decrementColor="currentColor"
                      digitStyles={{
                        fontWeight: 600,
                        letterSpacing: '-0.02em',
                        lineHeight: '1',
                        display: 'inline-block',
                      }}
                      containerStyles={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        flexDirection: 'row-reverse',
                        gap: '0.05em',
                        lineHeight: '1',
                      }}
                    />
                  )
                : (
                    <span>--</span>
                  )}
              <span>
                % chance
              </span>
            </div>
          </div>

          {changeIndicator}
        </div>

        {(watermark.iconSvg || watermark.label) && (
          <div className="mr-2 flex items-center gap-1 self-start text-xl text-muted-foreground opacity-50 select-none">
            {watermark.iconSvg
              ? (
                  <div
                    className="size-[1em] **:fill-current **:stroke-current"
                    dangerouslySetInnerHTML={{ __html: sanitizeSvg(watermark.iconSvg) }}
                  />
                )
              : null}
            {watermark.label
              ? (
                  <span className="font-semibold">
                    {watermark.label}
                  </span>
                )
              : null}
          </div>
        )}
      </div>
    </div>
  )
}
