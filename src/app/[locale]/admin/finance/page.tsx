import { headers } from 'next/headers'
import { setRequestLocale } from 'next-intl/server'
import { auth } from '@/lib/auth'
import FinanceDashboardClient from '@/app/[locale]/admin/finance/_components/FinanceDashboardClient'
import { getAdminFinanceOverview } from '@/lib/admin-finance-overview'

export default async function AdminFinancePage({ params }: PageProps<'/[locale]/admin/finance'>) {
  const { locale } = await params
  setRequestLocale(locale)

  let initialData: any = null
  let initialError: string | null = null

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    const user = session?.user as any
    if (!user?.is_admin) {
      initialError = 'Faça login como admin para ver o Financeiro.'
    }
    else {
      initialData = await getAdminFinanceOverview()
    }
  }
  catch (error: any) {
    initialError = error?.message || 'Falha ao carregar financeiro.'
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe carteiras, transações, PIX via HorsePay e pendências operacionais do Mercado Fácil.
        </p>
      </div>

      <FinanceDashboardClient initialData={initialData} initialError={initialError} />
    </section>
  )
}
