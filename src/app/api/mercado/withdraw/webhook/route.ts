import type { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { mercadoTransactions } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'
import { isHorsePayWithdrawApproved, isHorsePayWithdrawFailed } from '@/lib/horsepay'
import { confirmWithdrawTransactionById, failWithdrawTransactionById } from '@/lib/mercado-withdraw'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()

    const transactionId
      = payload?.client_reference_id
        || payload?.clientReferenceId
        || payload?.reference_id
        || payload?.referenceId

    const externalId
      = payload?.external_id
        || payload?.externalId
        || payload?.id
        || payload?.withdraw_id
        || payload?.withdrawId

    let transaction = null

    if (transactionId) {
      const results = await db.select()
        .from(mercadoTransactions)
        .where(eq(mercadoTransactions.id, String(transactionId)))
        .limit(1)
      transaction = results[0] ?? null
    }

    if (!transaction && externalId) {
      const results = await db.select()
        .from(mercadoTransactions)
        .where(eq(mercadoTransactions.external_id_horsepay, BigInt(String(externalId))))
        .limit(1)
      transaction = results[0] ?? null
    }

    if (!transaction) {
      return NextResponse.json({ received: true, warning: 'transaction_not_found' })
    }

    if (isHorsePayWithdrawFailed(payload)) {
      const result = await failWithdrawTransactionById(transaction.id, externalId ? String(externalId) : null)
      return NextResponse.json({
        received: true,
        failed: result.status === 'failed' || result.status === 'already_failed',
      })
    }

    if (isHorsePayWithdrawApproved(payload)) {
      const result = await confirmWithdrawTransactionById(transaction.id, externalId ? String(externalId) : null)
      return NextResponse.json({
        received: true,
        confirmed: result.status === 'confirmed' || result.status === 'already_confirmed',
      })
    }

    return NextResponse.json({ received: true, pending: true })
  }
  catch (error: any) {
    console.error('[HORSEPAY_WITHDRAW_WEBHOOK_ERROR]', error)
    return NextResponse.json({ error: 'Erro interno ao processar webhook de saque' }, { status: 500 })
  }
}
