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

export default async function PlatformLayout({ params, children }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)
  cacheTag(cacheTags.mainTags(resolvedLocale))
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
            {children}
            <MobileBottomNav />
            <AffiliateQueryHandler />
          </PlatformNavigationProvider>
        </TradingOnboardingProvider>
      </FilterProvider>
    </>
  )
}
