import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAdminFinanceOverview } from '@/lib/admin-finance-overview'

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    const user = session?.user as any
    if (!user?.is_admin) {
      return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 403 })
    }

    const data = await getAdminFinanceOverview()

    return NextResponse.json({
      success: true,
      data,
    })
  }
  catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Falha ao carregar financeiro' }, { status: 500 })
  }
}
