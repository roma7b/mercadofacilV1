import type { NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { mercadoTransactions, mercadoWallets } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    console.log('[HORSEPAY_WEBHOOK] Payload recebido:', JSON.stringify(payload))

    // Se status for falso ou for uma infração, ignorar
    if (payload.status === false || payload.infraction_status) {
      console.log('[HORSEPAY_WEBHOOK] Notificação ignorada (status false ou infração)')
      return NextResponse.json({ received: true })
    }

    // Extrair referências
    const txid = payload.client_reference_id || payload.clientReferenceId || payload.reference_id
    const externalId = payload.external_id || payload.externalId || payload.id

    console.log(`[HORSEPAY_WEBHOOK] Buscando transação: txid=${txid}, externalId=${externalId}`)

    // Tentar encontrar a transação pendente
    let transaction = null

    if (txid) {
      const results = await db.select()
        .from(mercadoTransactions)
        .where(
          and(
            eq(mercadoTransactions.referencia_externa, txid),
            eq(mercadoTransactions.status, 'PENDENTE'),
          ),
        )
        .limit(1)
      if (results.length > 0) { transaction = results[0] }
    }

    if (!transaction && externalId) {
      const results = await db.select()
        .from(mercadoTransactions)
        .where(
          and(
            eq(mercadoTransactions.external_id_horsepay, BigInt(externalId)),
            eq(mercadoTransactions.status, 'PENDENTE'),
          ),
        )
        .limit(1)
      if (results.length > 0) { transaction = results[0] }
    }

    if (!transaction) {
      console.warn(`[HORSEPAY_WEBHOOK] Nenhuma transação pendente encontrada para txid=${txid}`)
      return NextResponse.json({ received: true, warning: 'transaction_not_found' })
    }

    const userId = transaction.user_id
    const amount = Number(transaction.valor)

    console.log(`[HORSEPAY_WEBHOOK] Confirmando transação ${transaction.id} para usuario ${userId}`)

    // 1. Atualizar transação para CONFIRMADO
    await db.update(mercadoTransactions)
      .set({ status: 'CONFIRMADO' })
      .where(eq(mercadoTransactions.id, transaction.id))

    // 2. Creditar na carteira
    const userWallets = await db.select().from(mercadoWallets).where(eq(mercadoWallets.user_id, userId)).limit(1)

    if (userWallets.length === 0) {
      // Se não tem carteira, cria uma (teoricamente o trigger do banco já criaria, mas garantimos aqui)
      await db.insert(mercadoWallets).values({
        user_id: userId,
        saldo: String(amount),
      })
    }
    else {
      const currentBalance = Number(userWallets[0].saldo)
      await db.update(mercadoWallets)
        .set({ saldo: String(currentBalance + amount), updated_at: new Date() })
        .where(eq(mercadoWallets.user_id, userId))
    }

    console.log(`[HORSEPAY_WEBHOOK] ✅ Depósito de R$ ${amount} confirmado para usuario ${userId}`)

    return NextResponse.json({ received: true, confirmed: true })
  }
  catch (error: any) {
    console.error('[HORSEPAY_WEBHOOK_ERROR]', error)
    return NextResponse.json({ error: 'Erro interno ao processar webhook' }, { status: 500 })
  }
}
