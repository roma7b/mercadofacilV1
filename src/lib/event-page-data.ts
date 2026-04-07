import type { SupportedLocale } from '@/i18n/locales'
import type { ThemeSiteIdentity } from '@/lib/theme-site-identity'
import type {
  ConditionChangeLogEntry,
  Event,
  EventLiveChartConfig,
  EventSeriesEntry,
} from '@/types'
import { cacheTag } from 'next/cache'
import { loadMarketContextSettings } from '@/lib/ai/market-context-config'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'
import { MercadoFacilRepository } from '@/lib/db/queries/mercado-facil'
import { loadRuntimeThemeState } from '@/lib/theme-settings'
import 'server-only'

export interface EventPageContentData {
  event: Event
  marketContextEnabled: boolean
  changeLogEntries: ConditionChangeLogEntry[]
  seriesEvents: EventSeriesEntry[]
  liveChartConfig: EventLiveChartConfig | null
}

export interface EventPageShellData {
  route: Awaited<ReturnType<typeof getEventRouteBySlug>>
  title: string | null
  site: ThemeSiteIdentity
}

export async function resolveCanonicalEventSlugFromSportsPath(sportSlug: string, eventSlug: string) {
  const { data, error } = await EventRepository.getCanonicalEventSlugBySportsPath(sportSlug, eventSlug)
  if (error || !data?.slug) {
    return null
  }

  return data.slug
}

export async function getEventTitleBySlug(eventSlug: string, locale: SupportedLocale) {
  // Mercados customizados do Supabase usam UUID como slug - buscar título diretamente
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventSlug)
  const isLive = eventSlug.startsWith('live-')

  if (isUUID) {
    const { data: event } = await EventRepository.getEventBySlug(eventSlug)
    return event?.title ?? null
  }

  if (isLive) {
    const id = eventSlug.replace('live-', '')
    const event = await MercadoFacilRepository.getEventById(id)
    return event?.title ?? null
  }

  const { data } = await EventRepository.getEventTitleBySlug(eventSlug, locale)
  return data?.title ?? null
}

export async function getEventRouteBySlug(eventSlug: string) {

  const isMercadoFacilLive = eventSlug.startsWith('live-');

  if (isMercadoFacilLive) {
    const id = eventSlug.replace('live-', '')
    return { id, slug: eventSlug } as any
  }

  // MercadoFácil Custom Markets from Supabase use UUID slugs!
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventSlug)) {
    return { id: eventSlug, slug: eventSlug } as any
  }

  const { data, error } = await EventRepository.getEventRouteBySlug(eventSlug)
  if (error || !data) {
    return null
  }

  return data
}

export async function loadEventPagePublicContentData(
  eventSlug: string,
  locale: SupportedLocale,
): Promise<EventPageContentData | null> {

  const marketContextSettings = await loadMarketContextSettings()

  const marketContextEnabled = marketContextSettings.enabled && Boolean(marketContextSettings.apiKey)

  let eventResult: { data: Event | null, error: any }
  let changeLogResult: { data: ConditionChangeLogEntry[] | null, error: any } = { data: [], error: null }

  const isMercadoFacilLive = eventSlug.startsWith('live-');

  if (isMercadoFacilLive) {
    const id = eventSlug.replace('live-', '')
    const liveEvent = await MercadoFacilRepository.getEventById(id)
    eventResult = { data: liveEvent, error: liveEvent ? null : 'Not found' }
  }
  else {
    // UUIDs puros são mercados customizados do Supabase - não têm changelog no Drizzle
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventSlug)
    if (isUUID) {
      const fetchedEvent = await EventRepository.getEventBySlug(eventSlug)
      eventResult = fetchedEvent
      changeLogResult = { data: [], error: null }
    }
    else {
      const [fetchedEvent, fetchedChangeLog] = await Promise.all([
        EventRepository.getEventBySlug(eventSlug),
        EventRepository.getEventConditionChangeLogBySlug(eventSlug),
      ])
      eventResult = fetchedEvent
      changeLogResult = fetchedChangeLog
    }
  }

  const { data: event, error } = eventResult
  console.log('[DEBUG] EVENT RESULT:', { slug: eventSlug, hasEvent: !!event, error })

  if (error || !event) {
    console.log('[DEBUG] RETORNO NULL - Vai gerar 404', { error, isNull: !event })
    return null
  }

  if (changeLogResult.error) {
    console.warn('Failed to load event change log:', changeLogResult.error)
  }

  let seriesEvents: EventSeriesEntry[] = []
  let liveChartConfig: EventLiveChartConfig | null = null

  if (event.series_slug) {
    const [seriesEventsResult, liveChartConfigResult] = await Promise.all([
      EventRepository.getSeriesEventsBySeriesSlug(event.series_slug),
      EventRepository.getLiveChartConfigBySeriesSlug(event.series_slug),
    ])

    if (seriesEventsResult.error) {
      console.warn('Failed to load event series events:', seriesEventsResult.error)
    }
    else {
      seriesEvents = seriesEventsResult.data ?? []
    }

    if (liveChartConfigResult.error) {
      console.warn('Failed to load event live chart config:', liveChartConfigResult.error)
    }
    else {
      liveChartConfig = liveChartConfigResult.data ?? null
    }
  }

  if (event.series_slug && !seriesEvents.some(seriesEvent => seriesEvent.slug === event.slug)) {
    seriesEvents = [
      {
        id: event.id,
        slug: event.slug,
        status: event.status,
        end_date: event.end_date,
        resolved_at: event.resolved_at ?? null,
        created_at: event.created_at,
        resolved_direction: null,
      },
      ...seriesEvents,
    ]
  }

  return {
    event,
    marketContextEnabled,
    changeLogEntries: changeLogResult.data ?? [],
    seriesEvents,
    liveChartConfig,
  }
}

export async function loadEventPageShellData(
  eventSlug: string,
  locale: SupportedLocale,
): Promise<EventPageShellData> {

  const [route, title, runtimeTheme] = await Promise.all([
    getEventRouteBySlug(eventSlug),
    getEventTitleBySlug(eventSlug, locale),
    loadRuntimeThemeState(),
  ])

  return {
    route,
    title,
    site: runtimeTheme.site,
  }
}
