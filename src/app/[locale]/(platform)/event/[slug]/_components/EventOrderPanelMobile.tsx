import type { ReactNode } from 'react'
import type { OddsFormat } from '@/lib/odds-format'
import type { Event, Market, Outcome } from '@/types'
import { DialogTitle } from '@radix-ui/react-dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useExtracted } from 'next-intl'
import { MOBILE_BOTTOM_NAV_OFFSET } from '@/app/[locale]/(platform)/_lib/mobile-bottom-nav'
import EventOrderPanelForm from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'
import EventOrderPanelTermsDisclaimer
  from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelTermsDisclaimer'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { ORDER_SIDE, OUTCOME_INDEX } from '@/lib/constants'
import { formatCentsLabel } from '@/lib/formatters'
import { resolveFallbackOutcomeUnitPrice, resolveMarketOutcome } from '@/lib/market-pricing'
import { formatOddsFromPrice } from '@/lib/odds-format'
import { useIsSingleMarket, useOrder, useOutcomeTopOfBookPrice } from '@/stores/useOrder'

interface EventMobileOrderPanelProps {
  event: Event
  initialMarket?: Market | null
  initialOutcome?: Outcome | null
  showDefaultTrigger?: boolean
  mobileMarketInfo?: ReactNode
  primaryOutcomeIndex?: number | null
  oddsFormat?: OddsFormat
  outcomeButtonStyleVariant?: 'default' | 'sports3d'
  optimisticallyClaimedConditionIds?: Record<string, true>
}

export default function EventOrderPanelMobile({
  event,
  initialMarket = null,
  initialOutcome = null,
  showDefaultTrigger = true,
  mobileMarketInfo,
  primaryOutcomeIndex = null,
  oddsFormat = 'price',
  outcomeButtonStyleVariant = 'default',
  optimisticallyClaimedConditionIds,
}: EventMobileOrderPanelProps) {
  const t = useExtracted()
  const normalizeOutcomeLabel = useOutcomeLabel()
  const state = useOrder()
  const hasMatchingStoreEvent = state.event?.id === event.id
  const hasMatchingStoreMarket = Boolean(
    state.market
    && event.markets.some(market => market.condition_id === state.market?.condition_id),
  )
  const activeEvent: Event = hasMatchingStoreEvent && state.event ? state.event : event
  const activeMarket = hasMatchingStoreMarket ? state.market : initialMarket
  const fallbackOutcome = initialOutcome ?? activeMarket?.outcomes[0] ?? null
  const hasMatchingStoreOutcome = Boolean(
    state.outcome
    && activeMarket
    && state.outcome.condition_id === activeMarket.condition_id,
  )
  const activeOutcome = hasMatchingStoreOutcome ? state.outcome : fallbackOutcome
  const isSingleMarket = useIsSingleMarket() || activeEvent.total_markets_count === 1
  const liveYesPrice = useOutcomeTopOfBookPrice(OUTCOME_INDEX.YES, ORDER_SIDE.BUY)
  const liveNoPrice = useOutcomeTopOfBookPrice(OUTCOME_INDEX.NO, ORDER_SIDE.BUY)
  const activeLiveYesPrice = hasMatchingStoreMarket ? liveYesPrice : null
  const activeLiveNoPrice = hasMatchingStoreMarket ? liveNoPrice : null
  const yesOutcome = resolveMarketOutcome(activeMarket, OUTCOME_INDEX.YES)
  const noOutcome = resolveMarketOutcome(activeMarket, OUTCOME_INDEX.NO)
  const yesPrice = activeLiveYesPrice ?? resolveFallbackOutcomeUnitPrice(activeMarket, yesOutcome)
  const noPrice = activeLiveNoPrice ?? resolveFallbackOutcomeUnitPrice(activeMarket, noOutcome)
  const buyYesOutcome = yesOutcome ?? activeMarket?.outcomes[0] ?? null
  const buyNoOutcome = noOutcome ?? activeMarket?.outcomes[1] ?? null
  const buyYesOutcomeLabel = buyYesOutcome?.outcome_text
    ? (normalizeOutcomeLabel(buyYesOutcome.outcome_text) ?? buyYesOutcome.outcome_text)
    : t('Yes')
  const buyNoOutcomeLabel = buyNoOutcome?.outcome_text
    ? (normalizeOutcomeLabel(buyNoOutcome.outcome_text) ?? buyNoOutcome.outcome_text)
    : t('No')
  const isCategorical = event.markets.some(m => m.outcomes && m.outcomes.length > 2)
  const shouldShowDefaultTrigger = showDefaultTrigger && !isCategorical
  const yesPriceLabel = oddsFormat === 'price'
    ? formatCentsLabel(yesPrice)
    : formatOddsFromPrice(yesPrice, oddsFormat)
  const noPriceLabel = oddsFormat === 'price'
    ? formatCentsLabel(noPrice)
    : formatOddsFromPrice(noPrice, oddsFormat)

  return (
    <Drawer
      open={state.isMobileOrderPanelOpen}
      onClose={() => state.setIsMobileOrderPanelOpen(false)}
      repositionInputs={false}
    >
      {shouldShowDefaultTrigger && (
        <DrawerTrigger asChild>
          <div
            className="fixed inset-x-0 z-30 border-t bg-background/95 backdrop-blur-md px-4 py-3 lg:hidden"
            style={{ bottom: MOBILE_BOTTOM_NAV_OFFSET }}
          >
            <div className="flex gap-3">
              <Button
                variant="yes"
                className="h-12 flex-1 rounded-xl font-bold shadow-lg shadow-emerald-500/10 active:scale-95 transition-all"
                onClick={() => {
                  if (!activeMarket || !buyYesOutcome) {
                    return
                  }

                  state.setMarket(activeMarket)
                  state.setOutcome(buyYesOutcome)
                  state.setIsMobileOrderPanelOpen(true)
                }}
              >
                <div className="flex w-full items-center justify-between px-1">
                  <span className="truncate text-[13px] uppercase tracking-wider opacity-90">
                    {t('Buy')} {buyYesOutcomeLabel}
                  </span>
                  <span className="ml-2 shrink-0 text-base font-black">
                    {yesPriceLabel}
                  </span>
                </div>
              </Button>
              <Button
                variant="no"
                className="h-12 flex-1 rounded-xl font-bold shadow-lg shadow-red-500/10 active:scale-95 transition-all"
                onClick={() => {
                  if (!activeMarket || !buyNoOutcome) {
                    return
                  }

                  state.setMarket(activeMarket)
                  state.setOutcome(buyNoOutcome)
                  state.setIsMobileOrderPanelOpen(true)
                }}
              >
                <div className="flex w-full items-center justify-between px-1">
                  <span className="truncate text-[13px] uppercase tracking-wider opacity-90">
                    {t('Buy')} {buyNoOutcomeLabel}
                  </span>
                  <span className="ml-2 shrink-0 text-base font-black">
                    {noPriceLabel}
                  </span>
                </div>
              </Button>
            </div>
          </div>
        </DrawerTrigger>
      )}

      <DrawerContent className="max-h-[95vh] w-full">
        <VisuallyHidden>
          <DialogTitle>{event.title}</DialogTitle>
        </VisuallyHidden>

        <EventOrderPanelForm
          event={event}
          isMobile={true}
          initialMarket={activeMarket}
          initialOutcome={activeOutcome}
          mobileMarketInfo={mobileMarketInfo}
          primaryOutcomeIndex={primaryOutcomeIndex}
          oddsFormat={oddsFormat}
          outcomeButtonStyleVariant={outcomeButtonStyleVariant}
          optimisticallyClaimedConditionIds={optimisticallyClaimedConditionIds}
        />
        <EventOrderPanelTermsDisclaimer />
      </DrawerContent>
    </Drawer>
  )
}
