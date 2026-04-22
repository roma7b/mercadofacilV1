import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getWalletReconciliationIssues } from '@/lib/mercado-wallet-reconcile'

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    const user = session?.user as any
    if (!user?.is_admin) {
      return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 403 })
    }

    const issues = await getWalletReconciliationIssues(20)
    return NextResponse.json({ success: true, data: issues })
  }
  catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Falha ao carregar reconciliacao' }, { status: 500 })
  }
}
