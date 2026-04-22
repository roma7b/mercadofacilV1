import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { users } from '@/lib/db/schema/auth/tables'
import { mercadoBets, mercadoTransactions, mercadoWallets } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'

function serializeHorsePayId(value: bigint | null | undefined) {
  return value != null ? String(value) : null
}

export async function getAdminFinanceOverview() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const walletSummaryRows = await db
    .select({
      totalWallets: sql<number>`count(*)`,
      totalSaldo: sql<string>`coalesce(sum(${mercadoWallets.saldo}), 0)`,
    })
    .from(mercadoWallets)

  const pendingDepositRows = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(${mercadoTransactions.valor}), 0)`,
    })
    .from(mercadoTransactions)
    .where(and(
      eq(mercadoTransactions.tipo, 'DEPOSITO'),
      eq(mercadoTransactions.status, 'PENDENTE'),
    ))

  const pendingWithdrawRows = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(${mercadoTransactions.valor}), 0)`,
    })
    .from(mercadoTransactions)
    .where(and(
      eq(mercadoTransactions.tipo, 'SAQUE'),
      inArray(mercadoTransactions.status, ['EM_ANALISE', 'PENDENTE']),
    ))

  const failedRows = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(${mercadoTransactions.valor}), 0)`,
    })
    .from(mercadoTransactions)
    .where(eq(mercadoTransactions.status, 'FALHOU'))

  const confirmedDepositRows = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(${mercadoTransactions.valor}), 0)`,
    })
    .from(mercadoTransactions)
    .where(and(
      eq(mercadoTransactions.tipo, 'DEPOSITO'),
      eq(mercadoTransactions.status, 'CONFIRMADO'),
      gte(mercadoTransactions.created_at, dayAgo),
    ))

  const confirmedWithdrawRows = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(${mercadoTransactions.valor}), 0)`,
    })
    .from(mercadoTransactions)
    .where(and(
      eq(mercadoTransactions.tipo, 'SAQUE'),
      eq(mercadoTransactions.status, 'CONFIRMADO'),
      gte(mercadoTransactions.created_at, dayAgo),
    ))

  const activeBetsRows = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(${mercadoBets.valor}), 0)`,
    })
    .from(mercadoBets)
    .where(eq(mercadoBets.status, 'PENDENTE'))

  const topWallets = await db
    .select({
      walletId: mercadoWallets.id,
      saldo: mercadoWallets.saldo,
      updatedAt: mercadoWallets.updated_at,
      userId: users.id,
      username: users.username,
      email: users.email,
      address: users.address,
    })
    .from(mercadoWallets)
    .leftJoin(users, eq(mercadoWallets.user_id, users.id))
    .orderBy(desc(mercadoWallets.saldo))
    .limit(10)

  const recentTransactions = await db
    .select({
      id: mercadoTransactions.id,
      tipo: mercadoTransactions.tipo,
      valor: mercadoTransactions.valor,
      status: mercadoTransactions.status,
      referenciaExterna: mercadoTransactions.referencia_externa,
      horsepayId: mercadoTransactions.external_id_horsepay,
      createdAt: mercadoTransactions.created_at,
      userId: users.id,
      username: users.username,
      email: users.email,
      address: users.address,
    })
    .from(mercadoTransactions)
    .leftJoin(users, eq(mercadoTransactions.user_id, users.id))
    .orderBy(desc(mercadoTransactions.created_at))
    .limit(20)

  const pendingWithdrawals = await db
    .select({
      id: mercadoTransactions.id,
      valor: mercadoTransactions.valor,
      status: mercadoTransactions.status,
      referenciaExterna: mercadoTransactions.referencia_externa,
      horsepayId: mercadoTransactions.external_id_horsepay,
      createdAt: mercadoTransactions.created_at,
      username: users.username,
      email: users.email,
      address: users.address,
    })
    .from(mercadoTransactions)
    .leftJoin(users, eq(mercadoTransactions.user_id, users.id))
    .where(and(
      eq(mercadoTransactions.tipo, 'SAQUE'),
      inArray(mercadoTransactions.status, ['EM_ANALISE', 'PENDENTE']),
    ))
    .orderBy(desc(mercadoTransactions.created_at))
    .limit(10)

  const pendingDeposits = await db
    .select({
      id: mercadoTransactions.id,
      valor: mercadoTransactions.valor,
      status: mercadoTransactions.status,
      referenciaExterna: mercadoTransactions.referencia_externa,
      horsepayId: mercadoTransactions.external_id_horsepay,
      createdAt: mercadoTransactions.created_at,
      username: users.username,
      email: users.email,
      address: users.address,
    })
    .from(mercadoTransactions)
    .leftJoin(users, eq(mercadoTransactions.user_id, users.id))
    .where(and(
      eq(mercadoTransactions.tipo, 'DEPOSITO'),
      eq(mercadoTransactions.status, 'PENDENTE'),
    ))
    .orderBy(desc(mercadoTransactions.created_at))
    .limit(10)

  return {
    walletSummary: walletSummaryRows[0] || null,
    pendingDepositsSummary: pendingDepositRows[0] || null,
    pendingWithdrawsSummary: pendingWithdrawRows[0] || null,
    failedSummary: failedRows[0] || null,
    confirmedDepositsSummary: confirmedDepositRows[0] || null,
    confirmedWithdrawsSummary: confirmedWithdrawRows[0] || null,
    activeBetsSummary: activeBetsRows[0] || null,
    topWallets,
    recentTransactions: recentTransactions.map(transaction => ({
      ...transaction,
      horsepayId: serializeHorsePayId(transaction.horsepayId),
    })),
    pendingWithdrawals: pendingWithdrawals.map(withdrawal => ({
      ...withdrawal,
      horsepayId: serializeHorsePayId(withdrawal.horsepayId),
    })),
    pendingDeposits: pendingDeposits.map(deposit => ({
      ...deposit,
      horsepayId: serializeHorsePayId(deposit.horsepayId),
    })),
  }
}
