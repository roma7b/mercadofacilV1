'use client'

import BigChanceMeter from '@/app/[locale]/(platform)/event/[slug]/_components/BigChanceMeter'

import type {
  ConditionChangeLogEntry,
  Event,
  EventLiveChartConfig,
  EventSeriesEntry,
  Market,
  Outcome,
  User,
} from '@/types'
import { ArrowUpIcon, ChevronRight, Info, Trophy } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import EventChart from '@/app/[locale]/(platform)/event/[slug]/_components/EventChart'
import EventHeader from '@/app/[locale]/(platform)/event/[slug]/_components/EventHeader'
import EventMarketCard from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketCard'
import EventMarketChannelProvider from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import EventMarketHistory from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketHistory'
import EventMarketOpenOrders from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketOpenOrders'
import EventMarketPositions from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketPositions'
import EventMarkets from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarkets'
import EventOrderPanelForm from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelForm'

import EventOrderPanelMobile from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelMobile'
import EventOrderPanelTermsDisclaimer from '@/app/[locale]/(platform)/event/[slug]/_components/EventOrderPanelTermsDisclaimer'
import { EventOutcomeChanceProvider } from '@/app/[locale]/(platform)/event/[slug]/_components/EventOutcomeChanceProvider'
import EventRelated from '@/app/[locale]/(platform)/event/[slug]/_components/EventRelated'
import EventRules from '@/app/[locale]/(platform)/event/[slug]/_components/EventRules'
import EventSingleMarketOrderBook from '@/app/[locale]/(platform)/event/[slug]/_components/EventSingleMarketOrderBook'
import EventTabs from '@/app/[locale]/(platform)/event/[slug]/_components/EventTabs'
import EventStatsBar from '@/app/[locale]/(platform)/event/[slug]/_components/EventStatsBar'
import ResolutionTimelinePanel from '@/app/[locale]/(platform)/event/[slug]/_components/ResolutionTimelinePanel'
import { buildResolutionTimeline, shouldDisplayResolutionTimeline } from '@/app/[locale]/(platform)/event/[slug]/_utils/resolution-timeline-builder'
import LiveCameraFeed from '@/components/LiveCameraFeed'
import { useIsMobile } from '@/hooks/useIsMobile'
import { isLivePoolEvent } from '@/lib/market-type'
import { cn } from '@/lib/utils'
import { useOrder, useSyncLimitPriceWithOutcome } from '@/stores/useOrder'
import { useUser } from '@/stores/useUser'

interface EventContentProps {
  event: Event
  marketSlug?: string | null
  seriesEvents?: EventSeriesEntry[]
  isMobile?: boolean
  isLiveMercadoEventFallback?: boolean
  changeLogEntries?: ConditionChangeLogEntry[]
  user?: User | null
  marketContextEnabled?: boolean
  liveChartConfig?: EventLiveChartConfig | null
}

function OrderStoreSync({ event }: { event: Event }) {
  const { setEvent, setMarket, setOutcome, outcome, market: currentMarket } = useOrder()

  useEffect(() => {
    if (event && !currentMarket) {
      const initialMarket = event.markets?.[0]
      if (initialMarket && initialMarket.outcomes?.length > 0) {
        setEvent(event)
        setMarket(initialMarket)
        if (!outcome) {
          setOutcome(initialMarket.outcomes[0])
        }
      }
    }
  }, [event, currentMarket, setEvent, setMarket, setOutcome, outcome])

  return null
}

export default function EventContent({
  event,
  marketSlug,
  seriesEvents = [],
  isMobile: isMobileProp,
}: EventContentProps) {
  const t = useExtracted()
  const locale = useLocale()
  const currentUser = useUser()
  const isMobileClient = useIsMobile()
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [mounted, setMounted] = useState(false)
  const isMobile = isMobileProp ?? isMobileClient

  if (!event || !event.slug) {
    return <div className="min-h-screen animate-pulse bg-background/50" />
  }

  const isLiveMercadoEvent = isLivePoolEvent(event)
  const hasLiveCameraFeed = isLiveMercadoEvent
    && (
      event.main_tag === 'live_cam'
      || Boolean(event.livestream_url?.trim())
    )

  const selectedMarket = event.markets?.[0]
  const isBinarySingleMarket = event.markets.length === 1
    && (selectedMarket?.outcomes?.length ?? 0) === 2
  const selectedMarketTimelineOutcome = selectedMarket ? buildResolutionTimeline(selectedMarket).outcome : null

  useEffect(() => {
    setMounted(true)
    function onScroll() {
      setShowBackToTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleBackToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const sidebarTarget = typeof document !== 'undefined' ? document.getElementById('dynamic-sidebar-top') : null

  return (
    <EventMarketChannelProvider markets={event.markets}>
      <EventOutcomeChanceProvider eventId={event.id}>
        <OrderStoreSync event={event} />

        <div className="flex flex-col gap-4 md:gap-6 pt-2 pb-10">

          {/* Header Section */}
          <div className="flex flex-col gap-4">
            <EventHeader event={event} />
            <EventStatsBar event={event} />
          </div>

          <div className="flex flex-col gap-6 md:gap-8">

            {/* Main Visual Component (Camera or Professional Chart) */}
            <div className="group relative">
              {hasLiveCameraFeed
                ? (
                    <div className="
                      relative aspect-video w-full overflow-hidden rounded-2xl md:rounded-4xl bg-black
                      shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10
                    "
                    >
                      <LiveCameraFeed
                        liveId={event.slug}
                        originalStreamUrl={event.livestream_url || undefined}
                        showMetrics={hasLiveCameraFeed}
                        metadata={{
                          title: event.title,
                          iconUrl: event.icon_url,
                          mainTag: event.main_tag,
                        }}
                      />
                    </div>
                  )
                : (
                    <div className="
                      overflow-hidden rounded-[1rem] md:rounded-[2.5rem] border border-white/5 bg-card/30
                      shadow-[0_20px_40px_-5px_rgba(0,0,0,0.4)] md:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] backdrop-blur-2xl
                    "
                    >
                      <div className="
                        min-h-[260px] bg-linear-to-b from-white/3 to-transparent p-0
                        md:min-h-[480px] md:p-1
                      "
                      >
                        <EventChart event={event} isMobile={!!isMobile} seriesEvents={seriesEvents} />
                      </div>
                    </div>
                  )}
            </div>

            
            {selectedMarket && isBinarySingleMarket && (
               <BigChanceMeter 
                 marketSlug={selectedMarket.slug} 
                 className="mb-2" 
               />
            )}

            {/* Markets List - High Density & Premium UI */}
            {!isBinarySingleMarket && (
              <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="
                    flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20
                  "
                  >
                    <Trophy className="size-4" />
                  </div>
                  <h3 className="text-sm font-bold tracking-wider text-foreground uppercase">{t('Opções de Aposta')}</h3>
                </div>
              </div>

              <div className="rounded-2xl md:rounded-3xl border border-white/5 bg-card/20 p-4 shadow-2xl backdrop-blur-xl md:p-6">
                <EventMarkets event={event} isMobile={!!isMobile} />
              </div>
              </section>
            )}

            {/* Info Tabs & Details */}
            <div className="grid gap-10">
              <div className="border-t border-white/5 pt-8">
                <EventTabs event={event} user={currentUser} />
              </div>

              <div className="grid gap-6">
                <div className="flex items-center gap-3 px-2">
                  <Info className="size-4 text-muted-foreground" />
                  <h4 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">{t('Regras & Resolução')}</h4>
                </div>
                <EventRules event={event} />

                {selectedMarket && shouldDisplayResolutionTimeline(selectedMarket) && (
                  <div className="rounded-4xl border border-white/5 bg-card/10 p-8 shadow-inner backdrop-blur-md">
                    <ResolutionTimelinePanel
                      market={selectedMarket}
                      settledUrl={null}
                      outcomeOverride={selectedMarketTimelineOutcome}
                      showLink={false}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Portal: Side Betting Form for Desktop */}
        {mounted && !isMobile && sidebarTarget && createPortal(
          <div className="flex w-full max-w-[320px] animate-in flex-col gap-6 duration-1000 fade-in slide-in-from-right-8 mx-auto">
            {/* Main Betting Form */}
            <div className="
              rounded-3xl border border-border bg-card shadow-2xl transition-all overflow-hidden relative
              hover:shadow-[0_40px_80px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_40px_80px_rgba(0,0,0,0.9)]
              hover:border-primary/20
            "
            >
              <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/5 to-transparent opacity-50" />
              <EventOrderPanelForm
                event={event}
                isMobile={false}
              />
              <div className="p-5 pt-2">
                <EventOrderPanelTermsDisclaimer />
              </div>
            </div>

            {/* Minhas Posições Section */}
            {(selectedMarket && currentUser) ? (
              <div className="group/positions relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-xl sm:p-6 transition-all hover:border-primary/10">
                <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/5 to-transparent opacity-30" />
                <div className="relative mb-4 flex items-center justify-between">
                  <h3 className="text-2xs font-black tracking-[0.2em] text-muted-foreground uppercase opacity-80">
                    {t('Minhas Posições')}
                  </h3>
                </div>
                <div className="flex flex-col gap-4">
                  <EventMarketPositions
                    market={selectedMarket}
                    eventId={event.id}
                    eventSlug={event.slug}
                    isNegRiskEnabled={Boolean(event.enable_neg_risk || event.neg_risk)}
                  />
                  <div className="mt-2 border-t border-white/5 pt-4">
                     <EventMarketOpenOrders market={selectedMarket} eventSlug={event.slug} />
                  </div>
                </div>
              </div>
            ) : null}

            {/* Related Events Section (Subtle Look) */}
            <div className="group/related rounded-3xl border border-white/5 bg-card/10 p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="
                  text-2xs font-black tracking-[0.2em] text-muted-foreground uppercase opacity-50 transition-opacity
                  group-hover/related:opacity-100
                "
                >
                  {t('Outros Mercados')}
                </h3>
                <ChevronRight className="size-3 text-muted-foreground opacity-30" />
              </div>
              <div className="opacity-90 grayscale-30 transition-all hover:grayscale-0">
                <EventRelated event={event} />
              </div>
            </div>
          </div>,
          sidebarTarget,
        )}

        {/* Mobile Betting Drawer (Bottom Fixed) */}
        {isMobile && mounted && (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-9999">
            <div className="pointer-events-auto">
              <EventOrderPanelMobile event={event} showDefaultTrigger={true} />
            </div>
          </div>
        )}

        {/* Floating Back to Top */}
        {showBackToTop && (
          <button
            onClick={handleBackToTop}
            className="
              fixed right-6 bottom-28 z-40 rounded-2xl bg-primary p-4 text-primary-foreground
              shadow-[0_15px_30px_rgba(var(--primary-rgb),0.4)] transition-all
              hover:scale-110
              active:scale-95
              md:bottom-12
            "
          >
            <ArrowUpIcon className="size-5" />
          </button>
        )}
      </EventOutcomeChanceProvider>
    </EventMarketChannelProvider>
  )
}
