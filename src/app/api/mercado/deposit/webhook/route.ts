import type { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { mercadoTransactions } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'
import { isHorsePayOrderConfirmed } from '@/lib/horsepay'
import { confirmDepositTransactionById } from '@/lib/mercado-deposit'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()

    if (payload?.status === false || payload?.infraction_status) {
      return NextResponse.json({ received: true })
    }

    const txid = payload?.client_reference_id || payload?.clientReferenceId || payload?.reference_id
    const externalId = payload?.external_id || payload?.externalId || payload?.id

    let transaction = null

    if (txid) {
      const results = await db.select()
        .from(mercadoTransactions)
        .where(eq(mercadoTransactions.referencia_externa, txid))
        .limit(1)
      transaction = results[0] ?? null
    }

    if (!transaction && externalId) {
      const results = await db.select()
        .from(mercadoTransactions)
        .where(eq(mercadoTransactions.external_id_horsepay, BigInt(externalId)))
        .limit(1)
      transaction = results[0] ?? null
    }

    if (!transaction) {
      return NextResponse.json({ received: true, warning: 'transaction_not_found' })
    }

    if (!isHorsePayOrderConfirmed(payload)) {
      return NextResponse.json({ received: true, pending: true })
    }

    const result = await confirmDepositTransactionById(transaction.id)

    return NextResponse.json({
      received: true,
      confirmed: result.status === 'confirmed' || result.status === 'already_confirmed',
    })
  }
  catch (error: any) {
    console.error('[HORSEPAY_WEBHOOK_ERROR]', error)
    return NextResponse.json({ error: 'Erro interno ao processar webhook' }, { status: 500 })
  }
}
