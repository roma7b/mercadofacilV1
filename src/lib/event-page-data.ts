import type { SupportedLocale } from '@/i18n/locales'
import type { ThemeSiteIdentity } from '@/lib/theme-site-identity'
import type {
  ConditionChangeLogEntry,
  Event,
  EventLiveChartConfig,
  EventSeriesEntry,
} from '@/types'
import { cacheTag, unstable_noStore as noStore } from 'next/cache'
import { loadMarketContextSettings } from '@/lib/ai/market-context-config'
import { cacheTags } from '@/lib/cache-tags'
import { EventRepository } from '@/lib/db/queries/event'
import { MercadoFacilRepository } from '@/lib/db/queries/mercado-facil'
import { isLivePoolMarketType, resolveMarketTypeFromSlug } from '@/lib/market-type'
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
  const isLive = isLivePoolMarketType(resolveMarketTypeFromSlug(eventSlug))
  const isPolymarketImport = eventSlug.includes('poly-')

  if (isUUID) {
    const { data: event } = await EventRepository.getEventBySlug(eventSlug)
    return event?.title ?? null
  }

  if (isLive || isPolymarketImport) {
    // noStore() obrigatório aqui também (chamado pelo generateMetadata)
    noStore()
    const id = eventSlug.replace(/^live_/, '')
    const event = await MercadoFacilRepository.getEventById(id)
    return event?.title ?? null
  }

  const { data } = await EventRepository.getEventTitleBySlug(eventSlug, locale)
  return data?.title ?? null
}

export async function getEventRouteBySlug(eventSlug: string) {
  const isMercadoFacilLive = isLivePoolMarketType(resolveMarketTypeFromSlug(eventSlug))
  const isPolymarketImport = eventSlug.includes('poly-')

  if (isMercadoFacilLive || isPolymarketImport) {
    // noStore() impede o Next.js de pré-renderizar/cachear — obrigatório para Supabase fetch()
    noStore()
    // Remove apenas o prefixo 'live_' do início
    const id = eventSlug.replace(/^live_/, '')
    console.log('[getEventRouteBySlug] Slug live/poly detectado:', { slug: eventSlug, id })
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

  // 1. Tentar buscar no repositório unificado (Drizzle/Postgres) primeiro
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventSlug)
  const cleanSlug = eventSlug.replace(/^live_/, '').trim()

  // Tenta buscar no Drizzle com o slug original, com o slug limpo e diretamente pelo ID
  let fetchedEvent = await EventRepository.getEventBySlug(eventSlug)
  if (!fetchedEvent.data) {
    fetchedEvent = await EventRepository.getEventBySlug(cleanSlug)
  }

  // Fallback final no Drizzle: busca explícita se ainda não encontrou
  if (!fetchedEvent.data && (eventSlug.includes('_') || isUUID)) {
    const { data: secondTry } = await EventRepository.getEventBySlug(cleanSlug)
    if (secondTry) {
      fetchedEvent = { data: secondTry, error: null }
    }
  }

  if (fetchedEvent.data) {
    eventResult = fetchedEvent
    // Busca changelog se não for UUID
    if (!isUUID) {
      changeLogResult = await EventRepository.getEventConditionChangeLogBySlug(eventResult.data!.slug)
    }
  }
  else {
    // 2. Fallback: Se não encontrar no banco principal, verifica se é um mercado legado do Mercado Fácil (Supabase)
    const marketType = resolveMarketTypeFromSlug(eventSlug)
    const isMercadoFacilLive = isLivePoolMarketType(marketType)
    const isPolymarketImport = eventSlug.includes('poly-')

    if (isMercadoFacilLive || isPolymarketImport) {
      noStore()
      console.log('[loadEventPagePublicContentData] Fallback: Buscando event id:', cleanSlug)
      const liveEvent = await MercadoFacilRepository.getEventById(cleanSlug)
      eventResult = { data: liveEvent, error: liveEvent ? null : 'Not found' }
    }
    else {
      eventResult = { data: null, error: 'Event not found' }
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
