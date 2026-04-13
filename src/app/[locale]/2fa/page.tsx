'use cache'
import { setRequestLocale } from 'next-intl/server'
import TwoFactorClient from '@/app/[locale]/2fa/_components/TwoFactorClient'

import { Suspense } from 'react'

export default async function TwoFactorPage({ params, searchParams }: PageProps<'/[locale]/2fa'>) {
  return (
    <Suspense fallback={null}>
      <InnerTwoFactorPage params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function InnerTwoFactorPage({ 
  params, 
  searchParams 
}: { 
  params: PageProps<'/[locale]/2fa'>['params'],
  searchParams: PageProps['searchParams']
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const nextValue = resolvedSearchParams?.next
  const next = Array.isArray(nextValue) ? nextValue[0] : nextValue

  return <TwoFactorClient next={next} />
}
