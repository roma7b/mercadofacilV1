import { eq, sql } from 'drizzle-orm'
import { mercadoTransactions, mercadoWallets } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'

export async function confirmDepositTransactionById(transactionId: string) {
  return db.transaction(async (tx) => {
    const [transaction] = await tx
      .select()
      .from(mercadoTransactions)
      .where(eq(mercadoTransactions.id, transactionId))
      .limit(1)

    if (!transaction) {
      return { status: 'not_found' as const, transaction: null }
    }

    if (transaction.status === 'CONFIRMADO') {
      return { status: 'already_confirmed' as const, transaction }
    }

    if (transaction.status !== 'PENDENTE') {
      return { status: 'ignored' as const, transaction }
    }

    const amount = Number(transaction.valor)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Valor de depósito inválido para transação ${transactionId}`)
    }

    await tx
      .update(mercadoTransactions)
      .set({ status: 'CONFIRMADO' })
      .where(eq(mercadoTransactions.id, transaction.id))

    await tx
      .insert(mercadoWallets)
      .values({
        user_id: transaction.user_id,
        saldo: String(amount),
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: mercadoWallets.user_id,
        set: {
          saldo: sql`${mercadoWallets.saldo} + ${amount}`,
          updated_at: new Date(),
        },
      })

    return { status: 'confirmed' as const, transaction }
  })
}
