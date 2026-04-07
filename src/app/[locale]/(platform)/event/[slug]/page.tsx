import { Suspense } from 'react'
import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import EventContent from '@/app/[locale]/(platform)/event/[slug]/_components/EventContent'
import EventStructuredData from '@/components/seo/EventStructuredData'
import { redirect } from '@/i18n/navigation'
import { buildEventPageMetadata } from '@/lib/event-open-graph'
import { getEventRouteBySlug, loadEventPagePublicContentData } from '@/lib/event-page-data'
import { resolveEventBasePath, resolveEventPagePath } from '@/lib/events-routing'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'
import { loadRuntimeThemeState } from '@/lib/theme-settings'
import { db } from '@/lib/drizzle'
import { eq } from 'drizzle-orm'
import { events, markets, conditions } from '@/lib/db/schema/events/tables'
import { syncSingleMarketAction } from '@/app/[locale]/admin/mercado-hype/_actions/sync-odds'


export async function generateMetadata({ params }: PageProps<'/[locale]/event/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }
  return await buildEventPageMetadata({
    eventSlug: slug,
    locale: resolvedLocale,
  })
}

// Componente dinâmico que faz o db.select (roda só em runtime, nunca no build)
async function LiveSyncContent({ slug }: { slug: string }) {
  if (slug.includes('poly-')) {
    try {
      const match = await db.select()
        .from(conditions)
        .innerJoin(markets, eq(conditions.id, markets.condition_id))
        .innerJoin(events, eq(markets.event_id, events.id))
        .where(eq(events.slug, slug))
        .limit(1)

      if (match.length > 0 && match[0].conditions.question_id) {
        syncSingleMarketAction(match[0].conditions.question_id)
      }
    } catch (err) {
      console.error('[NEXT_JS_DB_SYNC_ERROR]', err)
      // Não trava a renderização por erro de sync
    }
  }
  return null
}

async function CachedEventPageContent({
  locale,
  slug,
}: {
  locale: SupportedLocale
  slug: string
}) {

  const eventRoute = await getEventRouteBySlug(slug)
  if (!eventRoute) {
    notFound()
  }

  const sportsPath = resolveEventBasePath(eventRoute)
  if (sportsPath) {
    redirect({
      href: sportsPath,
      locale,
    })
  }

  try {
    console.log('[SSR_DEBUG] Loading data for slug:', slug)
    const [eventPageData, runtimeTheme] = await Promise.all([
      loadEventPagePublicContentData(slug, locale).catch(e => {
        console.error('[SSR_DEBUG_DATA_ERROR]', e)
        return null
      }),
      loadRuntimeThemeState().catch(e => {
        console.error('[SSR_DEBUG_THEME_ERROR]', e)
        return { site: { name: 'Mercado Fácil' } } as any
      }),
    ])

    if (!eventPageData) {
      console.warn('[SSR_DEBUG] Event page data is null for:', slug)
      notFound()
    }

    console.log('[SSR_DEBUG] Data loaded successfully for:', slug)
    return (
      <>
        <EventStructuredData
          event={eventPageData.event}
          locale={locale}
          pagePath={resolveEventPagePath(eventPageData.event)}
          site={runtimeTheme.site}
        />
        <EventContent
          event={eventPageData.event}
          changeLogEntries={eventPageData.changeLogEntries}
          user={null}
          marketContextEnabled={eventPageData.marketContextEnabled}
          seriesEvents={eventPageData.seriesEvents}
          liveChartConfig={eventPageData.liveChartConfig}
          key={`is-bookmarked-${eventPageData.event.is_bookmarked}`}
        />
      </>
    )
  } catch (criticalError: any) {
    console.error('[SSR_CRITICAL_DEBUG_ERROR]', criticalError.message, criticalError.stack)
    throw criticalError // Permite que a Vercel logue o erro real
  }
}

export default async function EventPage({ params }: PageProps<'/[locale]/event/[slug]'>) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const resolvedLocale = locale as SupportedLocale
  if (slug === STATIC_PARAMS_PLACEHOLDER) {
    notFound()
  }

  return (
    <>
      <Suspense fallback={null}>
        <LiveSyncContent slug={slug} />
      </Suspense>
      <CachedEventPageContent locale={resolvedLocale} slug={slug} />
    </>
  )
}
