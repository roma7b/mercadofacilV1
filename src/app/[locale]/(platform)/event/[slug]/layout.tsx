import { setRequestLocale } from 'next-intl/server'
import { MockTradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/MockTradingOnboardingProvider'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'

export async function generateStaticParams() {
  return [{ slug: STATIC_PARAMS_PLACEHOLDER }]
}

export default async function EventLayout({ params, children }: LayoutProps<'/[locale]/event/[slug]'>) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const isLiveMarket = slug.startsWith('live-')

  const content = (
    <main className="container grid min-h-screen gap-8 pb-12 lg:grid-cols-[minmax(0,3fr)_21.25rem]">
      {children}
    </main>
  )

  return content
}
