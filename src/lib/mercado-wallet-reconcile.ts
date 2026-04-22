import { eq, inArray, sql } from 'drizzle-orm'
import { users } from '@/lib/db/schema/auth/tables'
import { mercadoTransactions, mercadoWallets } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'

function toMoneyNumber(value: unknown) {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) {
    return 0
  }
  return Math.round(numeric * 100) / 100
}

function isSameMoney(a: number, b: number) {
  return Math.abs(a - b) < 0.01
}

function resolveWalletAddress(user: { address?: string | null, email?: string | null } | undefined, userId: string) {
  return String(user?.address || user?.email || `mercadofacil:${userId}`)
}

export async function getUserExpectedWalletBalance(userId: string) {
  const [row] = await db
    .select({
      expectedSaldo: sql<string>`coalesce(sum(${mercadoTransactions.valor}), 0)`,
    })
    .from(mercadoTransactions)
    .where(sql`${mercadoTransactions.user_id} = ${userId} and ${mercadoTransactions.status} = 'CONFIRMADO'`)

  return toMoneyNumber(row?.expectedSaldo)
}

export async function reconcileUserWalletFromConfirmedTransactions(userId: string) {
  const expectedSaldo = await getUserExpectedWalletBalance(userId)
  const [user] = await db
    .select({
      address: users.address,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const [existingWallet] = await db
    .select({ id: mercadoWallets.id })
    .from(mercadoWallets)
    .where(eq(mercadoWallets.user_id, userId))
    .limit(1)

  if (existingWallet) {
    await db
      .update(mercadoWallets)
      .set({
        saldo: expectedSaldo.toFixed(2),
        updated_at: new Date(),
      })
      .where(eq(mercadoWallets.user_id, userId))
  }
  else if (expectedSaldo !== 0) {
    await db
      .insert(mercadoWallets)
      .values({
        user_id: userId,
        address: resolveWalletAddress(user, userId),
        chain_id: 0,
        is_primary: true,
        saldo: expectedSaldo.toFixed(2),
        created_at: new Date(),
        updated_at: new Date(),
      })
  }

  return { userId, expectedSaldo }
}

export async function getWalletReconciliationIssues(limit = 20) {
  const expectedRows = await db
    .select({
      userId: mercadoTransactions.user_id,
      expectedSaldo: sql<string>`coalesce(sum(${mercadoTransactions.valor}), 0)`,
    })
    .from(mercadoTransactions)
    .where(eq(mercadoTransactions.status, 'CONFIRMADO'))
    .groupBy(mercadoTransactions.user_id)

  if (expectedRows.length === 0) {
    return []
  }

  const userIds = expectedRows.map(row => row.userId)
  const [walletRows, userRows] = await Promise.all([
    db
      .select({
        userId: mercadoWallets.user_id,
        saldo: mercadoWallets.saldo,
        updatedAt: mercadoWallets.updated_at,
      })
      .from(mercadoWallets)
      .where(inArray(mercadoWallets.user_id, userIds)),
    db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        address: users.address,
      })
      .from(users)
      .where(inArray(users.id, userIds)),
  ])

  const walletByUserId = new Map(walletRows.map(row => [row.userId, row]))
  const userById = new Map(userRows.map(row => [row.id, row]))

  return expectedRows
    .map((row) => {
      const expectedSaldo = toMoneyNumber(row.expectedSaldo)
      const wallet = walletByUserId.get(row.userId)
      const currentSaldo = toMoneyNumber(wallet?.saldo)
      const delta = toMoneyNumber(expectedSaldo - currentSaldo)
      const user = userById.get(row.userId)

      return {
        userId: row.userId,
        username: user?.username || null,
        email: user?.email || null,
        address: user?.address || null,
        expectedSaldo,
        currentSaldo,
        delta,
        walletUpdatedAt: wallet?.updatedAt || null,
      }
    })
    .filter(issue => !isSameMoney(issue.expectedSaldo, issue.currentSaldo))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit)
}

export async function reconcileAllWalletsFromConfirmedTransactions() {
  const issues = await getWalletReconciliationIssues(500)

  let repairedCount = 0
  for (const issue of issues) {
    await reconcileUserWalletFromConfirmedTransactions(issue.userId)
    repairedCount += 1
  }

  return {
    repairedCount,
    totalIssues: issues.length,
  }
}
