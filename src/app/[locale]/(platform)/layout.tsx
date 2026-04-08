'use cache'

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
  const t = await getExtracted()
  const tags = [
    { id: 'trending', slug: 'trending', name: 'Destaques', childs: [], sidebarItems: [] },
    { id: 'crypto', slug: 'crypto', name: 'Cripto', childs: [], sidebarItems: [] },
    { id: 'sports', slug: 'sports', name: 'Esportes', childs: [], sidebarItems: [] },
    { id: 'politics', slug: 'politics', name: 'Política', childs: [], sidebarItems: [] },
  ] as any
  const childParentMap = {}

  return (
    <>
      <PlatformViewerState />
      <FilterProvider>
        <TradingOnboardingProvider>
          <PlatformNavigationProvider tags={tags} childParentMap={childParentMap}>
            <Header />
            <NavigationTabs />
            <div className="mx-auto flex w-full max-w-[1332px] gap-2 md:px-6"> 
              <div className="flex-1 min-w-0">
                {children}
              </div>
              <aside className="hidden w-[320px] shrink-0 xl:block py-4 relative">
                <div className="flex flex-col gap-4 sticky top-28 max-h-[calc(100vh-120px)]">
                  {/* Slot dinâmico para o Painel de Apostas em páginas de evento */}
                  <div id="dynamic-sidebar-top" className="empty:hidden" />
                  
                  <div className="flex-1 rounded-2xl overflow-hidden border border-border/50 shadow-2xl bg-card/30 backdrop-blur-md min-h-0">
                    <LiveChat events={[]} />
                  </div>
                </div>
              </aside>
            </div>
            <MobileBottomNav />
            <AffiliateQueryHandler />
          </PlatformNavigationProvider>
        </TradingOnboardingProvider>
      </FilterProvider>
    </>
  )
}
