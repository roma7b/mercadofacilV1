import type { Market, Outcome } from '@/types'
import { CheckIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { resolveBinaryOutcomeByIndex } from '@/app/[locale]/(platform)/(home)/_utils/eventCardResolvedOutcome'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import { Button } from '@/components/ui/button'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { OUTCOME_INDEX } from '@/lib/constants'
import { resolveEventOutcomePath } from '@/lib/events-routing'
import { cn } from '@/lib/utils'

interface EventCardSingleMarketActionsProps {
  event: {
    slug: string
    sports_sport_slug?: string | null
    sports_event_slug?: string | null
  }
  yesOutcome: Outcome
  noOutcome: Outcome
  primaryMarket: Market | undefined
  isResolvedEvent: boolean
  resolvedOutcomeIndexByConditionId: Partial<Record<string, typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO>>
  primaryDisplayChance?: number
}

export default function EventCardSingleMarketActions({
  event,
  yesOutcome,
  noOutcome,
  primaryMarket,
  isResolvedEvent,
  resolvedOutcomeIndexByConditionId,
  primaryDisplayChance = 0,
}: EventCardSingleMarketActionsProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  if (!primaryMarket) {
    return null
  }

  if (isResolvedEvent) {
    const resolvedOutcomeIndex = resolvedOutcomeIndexByConditionId[primaryMarket.condition_id] ?? null
    const resolvedOutcome = resolveBinaryOutcomeByIndex(primaryMarket, resolvedOutcomeIndex)
    const resolvedLabel = normalizeOutcomeLabel(resolvedOutcome?.outcome_text) ?? resolvedOutcome?.outcome_text
    const isYesOutcome = resolvedOutcomeIndex === OUTCOME_INDEX.YES

    return (
      <div className="mt-auto mb-0">
        {resolvedOutcome
          ? (
              <div className={`
                flex h-12 w-full cursor-default items-center justify-center gap-2 rounded-md border px-3 text-sm
                font-semibold text-foreground transition-colors
                dark:border-none dark:bg-secondary
                dark:group-hover:bg-card
              `}
              >
                <span className={cn(`flex size-4 items-center justify-center rounded-full ${isYesOutcome
                  ? 'bg-yes'
                  : `bg-no`}`)}
                >
                  {isYesOutcome
                    ? <CheckIcon className="size-3 text-background" strokeWidth={2.5} />
                    : <XIcon className="size-3 text-background" strokeWidth={2.5} />}
                </span>
                <span className="min-w-8 text-left">{resolvedLabel}</span>
              </div>
            )
          : (
              <div className={`
                flex h-10 w-full cursor-default items-center justify-center rounded-md px-3 text-sm font-semibold
                text-muted-foreground transition-colors
                dark:group-hover:bg-card
              `}
              >
                Resolved
              </div>
            )}
      </div>
    )
  }

  const isCategorical = (primaryMarket.outcomes?.length ?? 0) > 2

  if (isCategorical) {
    return (
      <div className="mt-auto mb-2 flex flex-wrap gap-1">
        {primaryMarket.outcomes.map((outcome: Outcome, idx: number) => (
          <Button
            key={idx}
            asChild
            variant="secondary"
            className="h-7 px-2 py-1 text-xs"
          >
            <IntentPrefetchLink
              href={resolveEventOutcomePath(event, { outcomeIndex: outcome.outcome_index })}
            >
              <span className="truncate">{outcome.outcome_text}</span>
            </IntentPrefetchLink>
          </Button>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-auto mb-2 flex flex-col gap-2">
      <div className="
        flex items-center justify-between gap-1 overflow-hidden rounded-lg border bg-muted/40 p-1.5 transition-colors
        hover:bg-muted/60
        dark:bg-secondary/40
        dark:hover:bg-secondary/60
      "
      >
        <div className="ml-2 flex flex-1 items-center gap-2 overflow-hidden">
          <span className="truncate text-[13px] font-semibold text-foreground/90">
            {normalizeOutcomeLabel(yesOutcome.outcome_text) || yesOutcome.outcome_text}
          </span>
          <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
            {primaryDisplayChance}
            %
          </span>
        </div>
        <Button
          asChild
          variant="yes"
          className="h-8 min-w-[70px] px-2 py-1 text-[11px] font-extrabold tracking-tight uppercase shadow-sm"
        >
          <IntentPrefetchLink
            href={resolveEventOutcomePath(event, { outcomeIndex: OUTCOME_INDEX.YES })}
          >
            {t('Yes') || yesOutcome.outcome_text || 'Sim'}
          </IntentPrefetchLink>
        </Button>
      </div>
      <div className="
        flex items-center justify-between gap-1 overflow-hidden rounded-lg border bg-muted/40 p-1.5 transition-colors
        hover:bg-muted/60
        dark:bg-secondary/40
        dark:hover:bg-secondary/60
      "
      >
        <div className="ml-2 flex flex-1 items-center gap-2 overflow-hidden">
          <span className="truncate text-[13px] font-semibold text-foreground/90">
            {normalizeOutcomeLabel(noOutcome.outcome_text) || noOutcome.outcome_text}
          </span>
          <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
            {100 - primaryDisplayChance}
            %
          </span>
        </div>
        <Button
          asChild
          variant="no"
          className="h-8 min-w-[70px] px-2 py-1 text-[11px] font-extrabold tracking-tight uppercase shadow-sm"
        >
          <IntentPrefetchLink
            href={resolveEventOutcomePath(event, { outcomeIndex: OUTCOME_INDEX.NO })}
          >
            {t('No') || noOutcome.outcome_text || 'Não'}
          </IntentPrefetchLink>
        </Button>
      </div>
    </div>
  )
}
