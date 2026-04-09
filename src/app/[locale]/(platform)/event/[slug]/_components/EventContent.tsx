'use client'

import type {
  ConditionChangeLogEntry,
  Event,
  EventLiveChartConfig,
  EventSeriesEntry,
  Market,
  Outcome,
  User,
} from '@/types'
import { ArrowUpIcon, Trophy, Timeline, Info, ChevronRight } from 'lucide-react'
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
import EventRelated, { EventRelatedSkeleton } from '@/app/[locale]/(platform)/event/[slug]/_components/EventRelated'
import EventRules from '@/app/[locale]/(platform)/event/[slug]/_components/EventRules'
import EventSingleMarketOrderBook from '@/app/[locale]/(platform)/event/[slug]/_components/EventSingleMarketOrderBook'
import EventTabs from '@/app/[locale]/(platform)/event/[slug]/_components/EventTabs'
import ResolutionTimelinePanel from '@/app/[locale]/(platform)/event/[slug]/_components/ResolutionTimelinePanel'
import LiveCameraFeed from '@/components/LiveCameraFeed'
import { isLivePoolEvent } from '@/lib/market-type'
import { buildResolutionTimeline, shouldDisplayResolutionTimeline } from '@/app/[locale]/(platform)/event/[slug]/_utils/resolution-timeline-builder'
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
  isMobile,
}: EventContentProps) {
  const t = useExtracted()
  const locale = useLocale()
  const currentUser = useUser()
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  if (!event || !event.slug) {
    return <div className="min-h-screen animate-pulse bg-background/50" />
  }

  const isLiveMercadoEvent = isLivePoolEvent(event)
  const isPoly = event.slug.startsWith('poly-')

  const selectedMarket = event.markets?.[0]
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
        
        <div className="flex flex-col gap-6 pt-2 pb-10">
          
          {/* Header Section */}
          <EventHeader event={event} />

          <div className="flex flex-col gap-8">
            
            {/* Main Visual Component (Camera or Professional Chart) */}
            <div className="relative group">
              {isLiveMercadoEvent ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-[2rem] bg-black shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
                  <LiveCameraFeed
                    liveId={event.slug}
                    originalStreamUrl={event.livestream_url || undefined}
                    showMetrics={event.slug.includes('rodovia')}
                    metadata={{ 
                       title: event.title,
                       iconUrl: event.icon_url,
                       mainTag: event.main_tag
                    }}
                  />
                </div>
              ) : (
                <div className="bg-card/30 backdrop-blur-2xl rounded-[2.5rem] border border-white/5 overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
                  <div className="p-0 md:p-1 min-h-[300px] md:min-h-[480px] bg-gradient-to-b from-white/[0.03] to-transparent">
                    <EventChart event={event} isMobile={isMobile} seriesEvents={seriesEvents} />
                  </div>
                </div>
              )}
            </div>

            {/* Markets List - High Density & Premium UI */}
            <section className="flex flex-col gap-4">
               <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                     <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                        <Trophy className="size-4" />
                     </div>
                     <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('Opções de Aposta')}</h3>
                  </div>
               </div>

               <div className="bg-card/20 backdrop-blur-xl rounded-3xl border border-white/5 p-4 md:p-6 shadow-2xl">
                  <EventMarkets event={event} isMobile={isMobile} />
               </div>
            </section>

            {/* Info Tabs & Details */}
            <div className="grid gap-10">
              <div className="border-t border-white/5 pt-8">
                <EventTabs event={event} user={currentUser} />
              </div>
              
              <div className="grid gap-6">
                <div className="flex items-center gap-3 px-2">
                   <Info className="size-4 text-muted-foreground" />
                   <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('Regras & Resolução')}</h4>
                </div>
                <EventRules event={event} />
                
                {selectedMarket && shouldDisplayResolutionTimeline(selectedMarket) && (
                  <div className="rounded-[2rem] border border-white/5 bg-card/10 backdrop-blur-md p-8 shadow-inner">
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
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-8 duration-1000">
            {/* Main Betting Form */}
            <div className="bg-card/50 backdrop-blur-3xl rounded-[2rem] border border-white/10 p-1 shadow-[0_30px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/5 transition-all hover:shadow-[0_40px_80px_rgba(0,0,0,0.7)]">
              <EventOrderPanelForm
                event={event}
                isMobile={false}
              />
              <div className="p-5 pt-2">
                <EventOrderPanelTermsDisclaimer />
              </div>
            </div>
            
            {/* Related Events Section (Subtle Look) */}
            <div className="bg-card/10 rounded-3xl border border-white/5 p-6 shadow-xl group/related">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-50 group-hover/related:opacity-100 transition-opacity">{t('Outros Mercados')}</h3>
                  <ChevronRight className="size-3 text-muted-foreground opacity-30" />
               </div>
               <div className="opacity-90 grayscale-[30%] hover:grayscale-0 transition-all">
                 <EventRelated event={event} />
               </div>
            </div>
          </div>,
          sidebarTarget
        )}
        
        {/* Mobile Betting Drawer (Bottom Fixed) */}
        {isMobile && (
          <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-10 bg-background/90 backdrop-blur-2xl border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
             <EventOrderPanelMobile event={event} />
          </div>
        )}

        {/* Floating Back to Top */}
        {showBackToTop && (
          <button
            onClick={handleBackToTop}
            className="fixed bottom-28 right-6 z-40 p-4 rounded-2xl bg-primary text-primary-foreground shadow-[0_15px_30px_rgba(var(--primary-rgb),0.4)] hover:scale-110 active:scale-95 transition-all md:bottom-12"
          >
            <ArrowUpIcon className="size-5" />
          </button>
        )}
      </EventOutcomeChanceProvider>
    </EventMarketChannelProvider>
  )
}
