import { setRequestLocale } from 'next-intl/server'
import { MockTradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/MockTradingOnboardingProvider'
import { TradingOnboardingProvider } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { STATIC_PARAMS_PLACEHOLDER } from '@/lib/static-params'




export default async function EventLayout({ params, children }: LayoutProps<'/[locale]/event/[slug]'>) {
  const { locale } = await params
  setRequestLocale(locale)

  const content = (
    <main className="flex min-h-screen flex-col gap-8 pb-12">
      {children}
    </main>
  )

  return content
}
