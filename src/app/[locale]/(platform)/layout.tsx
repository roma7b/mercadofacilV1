'use cache'

import { Suspense } from 'react'

import type { SupportedLocale } from '@/i18n/locales'
import { getExtracted, setRequestLocale } from 'next-intl/server'
import { cacheTag } from 'next/cache'
import AffiliateQueryHandler from '@/app/[locale]/(platform)/_components/AffiliateQueryHandler'
import Header from '@/app/[locale]/(platform)/_components/Header'
import MobileBottomNav from '@/app/[locale]/(platform)/_components/MobileBottomNav'
import NavigationTabs from '@/app/[locale]/(platform)/_components/NavigationTabs'
import PlatformViewerState from '@/app/[locale]/(platform)/_components/PlatformViewerState'
import { FilterProvider } from '@/app/[locale]/(platform)/_providers/FilterProvider'
import PlatformNavigationProvider from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { cacheTags } from '@/lib/cache-tags'
import { TagRepository } from '@/lib/db/queries/tag'
import { buildChildParentMap, buildPlatformNavigationTags } from '@/lib/platform-navigation'
import { LiveChat } from './_components/LiveChat'

async function getCachedPlatformLayoutData(locale: SupportedLocale) {
  'use cache'
  cacheTag(cacheTags.mainTags(locale))
  return null // O layout atual usa mocks locais, mas mantemos o padrão de tag
}

export default async function PlatformLayout({ params, children }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)
  await getCachedPlatformLayoutData(resolvedLocale)
  const tags = [
    { id: 'trending', slug: 'trending', name: 'Destaques', childs: [], sidebarItems: [] },
    { id: 'crypto', slug: 'crypto', name: 'Cripto', childs: [], sidebarItems: [] },
    { id: 'sports', slug: 'sports', name: 'Esportes', childs: [], sidebarItems: [] },
    { id: 'politics', slug: 'politics', name: 'Política', childs: [], sidebarItems: [] },
  ] as any
  const childParentMap = {}

  return (
    <>
      <Suspense fallback={null}>
        <PlatformViewerState />
      </Suspense>
      <FilterProvider>
        <TradingOnboardingProvider>
          <PlatformNavigationProvider tags={tags} childParentMap={childParentMap}>
            <Suspense fallback={<div className="h-16 w-full animate-pulse bg-background" />}>
              <Header />
            </Suspense>
            <Suspense fallback={null}>
              <NavigationTabs />
            </Suspense>
            <div className="mx-auto flex w-full max-w-[1332px] gap-2 px-4 md:px-6">
              <div className="min-w-0 flex-1">
                <Suspense fallback={null}>
                  {children}
                </Suspense>
              </div>
              <aside className="relative hidden w-[320px] shrink-0 py-4 xl:block">
                <div className="sticky top-28 flex max-h-[calc(100vh-120px)] flex-col gap-4">
                  {/* Slot dinâmico para o Painel de Apostas em páginas de evento */}
                  <div id="dynamic-sidebar-top" className="empty:hidden" />

                  <div className="
                    min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/50 bg-card/30 shadow-2xl
                    backdrop-blur-md
                  "
                  >
                    <Suspense fallback={<div className="size-full animate-pulse bg-card" />}>
                      <LiveChat events={[]} />
                    </Suspense>
                  </div>
                </div>
              </aside>
            </div>
            <Suspense fallback={null}>
              <MobileBottomNav />
            </Suspense>
            <Suspense fallback={null}>
              <AffiliateQueryHandler />
            </Suspense>
          </PlatformNavigationProvider>
        </TradingOnboardingProvider>
      </FilterProvider>
    </>
  )
}
