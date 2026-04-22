import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { mercadoWallets } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'
import { reconcileUserWalletFromConfirmedTransactions } from '@/lib/mercado-wallet-reconcile'

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    let [wallet] = await db
      .select({ saldo: mercadoWallets.saldo })
      .from(mercadoWallets)
      .where(eq(mercadoWallets.user_id, session.user.id))
      .limit(1)

    if (!wallet) {
      const reconciled = await reconcileUserWalletFromConfirmedTransactions(session.user.id)
      if (reconciled.expectedSaldo > 0) {
        ;[wallet] = await db
          .select({ saldo: mercadoWallets.saldo })
          .from(mercadoWallets)
          .where(eq(mercadoWallets.user_id, session.user.id))
          .limit(1)
      }
    }

    const rawBalance = Number(wallet?.saldo ?? 0)
    const normalizedBalance = Number.isFinite(rawBalance) ? rawBalance : 0

    return NextResponse.json({
      raw: normalizedBalance,
      text: normalizedBalance.toFixed(2),
      symbol: 'R$',
    })
  }
  catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
