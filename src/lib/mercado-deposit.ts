import { eq, sql } from 'drizzle-orm'
import { users } from '@/lib/db/schema/auth/tables'
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
      throw new Error(`Valor de deposito invalido para transacao ${transactionId}`)
    }

    const [user] = await tx
      .select({
        address: users.address,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, transaction.user_id))
      .limit(1)

    await tx
      .update(mercadoTransactions)
      .set({ status: 'CONFIRMADO' })
      .where(eq(mercadoTransactions.id, transaction.id))

    const [wallet] = await tx
      .select({ id: mercadoWallets.id })
      .from(mercadoWallets)
      .where(eq(mercadoWallets.user_id, transaction.user_id))
      .limit(1)

    if (wallet) {
      await tx
        .update(mercadoWallets)
        .set({
          saldo: sql`${mercadoWallets.saldo} + ${amount}`,
          updated_at: new Date(),
        })
        .where(eq(mercadoWallets.user_id, transaction.user_id))
    }
    else {
      await tx
        .insert(mercadoWallets)
        .values({
          user_id: transaction.user_id,
          address: String(user?.address || user?.email || `mercadofacil:${transaction.user_id}`),
          chain_id: 0,
          is_primary: true,
          saldo: String(amount),
          created_at: new Date(),
          updated_at: new Date(),
        })
    }

    return { status: 'confirmed' as const, transaction }
  })
}
