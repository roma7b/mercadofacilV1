'use cache'

import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import PlatformViewerState from '@/app/[locale]/(platform)/_components/PlatformViewerState'
import AdminHeader from '@/app/[locale]/admin/_components/AdminHeader'
import AdminSidebar from '@/app/[locale]/admin/_components/AdminSidebar'

export const metadata: Metadata = {
  title: 'Admin',
}

export default async function AdminLayout({ params, children }: LayoutProps<'/[locale]/admin'>) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <>
      <PlatformViewerState />
      <AdminHeader />
      <main className="container py-4 lg:py-8">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 xl:gap-16">
          <AdminSidebar />
          <div className="min-w-0 space-y-8">
            {children}
          </div>
        </div>
      </main>
    </>
  )
}
