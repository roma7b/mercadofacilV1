import type { Event, Market } from '@/types'
import { CheckIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { resolveBinaryOutcomeByIndex } from '@/app/[locale]/(platform)/(home)/_utils/eventCardResolvedOutcome'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import { Button } from '@/components/ui/button'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { OUTCOME_INDEX } from '@/lib/constants'
import { resolveEventMarketPath, resolveEventOutcomePath } from '@/lib/events-routing'
import { cn } from '@/lib/utils'

interface EventCardMarketsListProps {
  event: Event
  markets: Market[]
  isResolvedEvent: boolean
  getDisplayChance: (marketId: string) => number
  resolvedOutcomeIndexByConditionId: Partial<Record<string, typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO>>
}

export default function EventCardMarketsList({
  event,
  markets,
  isResolvedEvent,
  getDisplayChance,
  resolvedOutcomeIndexByConditionId,
}: EventCardMarketsListProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const marketsToRender = isResolvedEvent
    ? markets
        .map((market, index) => {
          const resolvedOutcomeIndex = resolvedOutcomeIndexByConditionId[market.condition_id] ?? null
          const rank = resolvedOutcomeIndex === OUTCOME_INDEX.YES
            ? 0
            : resolvedOutcomeIndex === OUTCOME_INDEX.NO
              ? 1
              : 2

          return {
            market,
            index,
            rank,
          }
        })
        .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
        .map(item => item.market)
    : markets

  return (
    <div
      className={cn(
        'max-h-[300px] space-y-2 overflow-y-auto pr-1 transition-all',
        isResolvedEvent ? 'mb-1' : 'mb-2',
      )}
    >
      {marketsToRender.map((market) => {
        const resolvedOutcomeIndex = isResolvedEvent
          ? resolvedOutcomeIndexByConditionId[market.condition_id] ?? null
          : null
        const resolvedOutcome = isResolvedEvent
          ? resolveBinaryOutcomeByIndex(market, resolvedOutcomeIndex)
          : null
        const yesOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES) ?? market.outcomes[0]
        const noOutcome = market.outcomes.find(outcome => outcome.outcome_index === OUTCOME_INDEX.NO) ?? market.outcomes[1]
        const resolvedLabel = resolvedOutcome?.outcome_text
        const isYesOutcome = resolvedOutcomeIndex === OUTCOME_INDEX.YES
        const displayResolvedLabel = normalizeOutcomeLabel(resolvedLabel) ?? resolvedLabel
        const isCategorical = market.outcomes.length > 2

        if (isCategorical && !isResolvedEvent) {
          const marketChance = getDisplayChance(market.condition_id)
          const fallbackOutcomeChance = marketChance / market.outcomes.length

          return (
            <div key={market.condition_id} className="w-full space-y-2.5 pt-1">
              {market.outcomes.map((outcome) => {
                const probability = typeof outcome.probability === 'number' 
                  ? outcome.probability
                  : fallbackOutcomeChance

                return (
                  <div 
                    key={outcome.outcome_index} 
                    className="flex w-full items-center justify-between gap-2"
                  >
                    <div className="flex flex-1 items-center gap-2 overflow-hidden px-1">
                      <span className="truncate text-[13px] font-semibold text-foreground/90">
                        {normalizeOutcomeLabel(outcome.outcome_text) || outcome.outcome_text}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-xs font-bold text-foreground tabular-nums min-w-8 text-right">
                        {Math.round(probability)}%
                      </span>
                      <div className="flex gap-1">
                        <Button
                          asChild
                          variant="yes"
                          className="group/yes h-7 w-10 px-2 py-1 text-[11px] font-extrabold shadow-sm"
                        >
                          <IntentPrefetchLink
                            href={resolveEventOutcomePath(event, {
                              marketSlug: market.slug,
                              outcomeIndex: outcome.outcome_index,
                            })}
                          >
                            Sim.
                          </IntentPrefetchLink>
                        </Button>
                        <Button
                          asChild
                          variant="no"
                          className="group/no h-7 w-11 px-2 py-1 text-[11px] font-extrabold shadow-sm"
                        >
                          <IntentPrefetchLink
                            href={resolveEventOutcomePath(event, {
                              marketSlug: market.slug,
                              outcomeIndex: outcome.outcome_index === OUTCOME_INDEX.YES ? OUTCOME_INDEX.NO : OUTCOME_INDEX.YES,
                            })}
                          >
                            Não.
                          </IntentPrefetchLink>
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        }

        return (
          <div
            key={market.condition_id}
            className="flex items-center justify-between"
          >
            <IntentPrefetchLink
              href={resolveEventMarketPath(event, market.slug)}
              className="block min-w-0 flex-1 truncate text-[13px] underline-offset-2 hover:underline dark:text-white"
              title={market.short_title || market.title}
            >
              {market.short_title || market.title}
            </IntentPrefetchLink>
            <div className="ml-2 flex items-center gap-2">
              {isResolvedEvent
                ? (
                    resolvedOutcome
                      ? (
                          <span className={`
                            inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-sm font-semibold text-foreground
                            transition-colors
                            group-hover:bg-card
                          `}
                          >
                            <span className={cn(`flex size-4 items-center justify-center rounded-full ${isYesOutcome
                              ? `bg-yes`
                              : `bg-no`}`)}
                            >
                              {isYesOutcome
                                ? <CheckIcon className="size-3 text-background" strokeWidth={2.5} />
                                : <XIcon className="size-3 text-background" strokeWidth={2.5} />}
                            </span>
                            <span className="min-w-8 text-left">{displayResolvedLabel}</span>
                          </span>
                        )
                      : (
                          <span className={`
                            inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold text-muted-foreground
                            transition-colors
                            group-hover:bg-card
                          `}
                          >
                            Resolved
                          </span>
                        )
                  )
                : (
                    <>
                      <span className="text-base font-semibold text-foreground">
                        {Math.round(getDisplayChance(market.condition_id))}%
                      </span>
                      <div className="flex gap-1">
                        <Button
                          asChild
                          variant="yes"
                          className="group/yes h-7 w-10 px-2 py-1 text-xs"
                        >
                          <IntentPrefetchLink
                            href={resolveEventOutcomePath(event, {
                              marketSlug: market.slug,
                              outcomeIndex: yesOutcome.outcome_index,
                            })}
                          >
                            Sim.
                          </IntentPrefetchLink>
                        </Button>
                        <Button
                          asChild
                          variant="no"
                          className="group/no h-7 w-11 px-2 py-1 text-xs"
                        >
                          <IntentPrefetchLink
                            href={resolveEventOutcomePath(event, {
                              marketSlug: market.slug,
                              outcomeIndex: noOutcome.outcome_index,
                            })}
                          >
                            Não.
                          </IntentPrefetchLink>
                        </Button>
                      </div>
                    </>
                  )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
