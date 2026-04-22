import { and, eq, sql } from 'drizzle-orm'
import { users } from '@/lib/db/schema/auth/tables'
import { mercadoBets, mercadosLive, mercadoTransactions, mercadoWallets } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

/**
 * Resolve um mercado do Mercado Fácil e paga os vencedores.
 *
 * O payout garantido de cada aposta vencedora é honrado integralmente.
 * Na liquidação, consumimos primeiro o pool real acumulado do mercado
 * e, se necessário, abatemos a diferença da payout_reserve.
 */
export async function resolveMercadoLive(
  marketId: string,
  vencedorLabel: 'SIM' | 'NAO',
) {
  console.log(`[PAYOUT] Iniciando resolução do mercado ${marketId}. Vencedor: ${vencedorLabel}`)

  return await db.transaction(async (tx) => {
    const [market] = await tx
      .select()
      .from(mercadosLive)
      .where(eq(mercadosLive.id, marketId))
      .limit(1)

    if (!market) {
      throw new Error('Mercado não encontrado')
    }
    if (market.status === 'RESOLVIDO') {
      throw new Error('Mercado já foi resolvido anteriormente')
    }

    const bets = await tx
      .select()
      .from(mercadoBets)
      .where(
        and(
          eq(mercadoBets.live_id, marketId),
          eq(mercadoBets.status, 'PENDENTE'),
        ),
      )

    const winners = bets.filter(bet => bet.opcao === vencedorLabel)
    const losers = bets.filter(bet => bet.opcao !== vencedorLabel)

    const totalGuaranteedPayout = winners.reduce((sum, bet) => {
      const guaranteedPayout = Number(bet.payout_garantido) > 0
        ? Number(bet.payout_garantido)
        : Number(bet.cotas)
      return sum + guaranteedPayout
    }, 0)

    const totalRealPool = (Number(market.total_sim) || 0) + (Number(market.total_nao) || 0)
    const currentReserve = Number(market.payout_reserve) || 0
    const reserveNeeded = Math.max(0, totalGuaranteedPayout - totalRealPool)
    const reserveUsed = Math.min(currentReserve, reserveNeeded)
    const houseCoverage = Math.max(0, reserveNeeded - currentReserve)

    await tx
      .update(mercadosLive)
      .set({
        status: 'RESOLVIDO',
        vencedor_label: vencedorLabel,
        total_sim: '0',
        total_nao: '0',
        payout_reserve: String(Math.max(0, currentReserve - reserveUsed)),
        updated_at: new Date(),
      })
      .where(eq(mercadosLive.id, marketId))

    const stats = {
      winners: winners.length,
      losers: losers.length,
      amountPaid: 0,
      reserveUsed,
      houseCoverage,
      totalGuaranteedPayout,
    }

    for (const bet of winners) {
      const payoutGarantido = Number(bet.payout_garantido) > 0
        ? Number(bet.payout_garantido)
        : Number(bet.cotas)

      await tx
        .update(mercadoBets)
        .set({ status: 'GANHOU', updated_at: new Date() })
        .where(eq(mercadoBets.id, bet.id))

      const [wallet] = await tx
        .select({ id: mercadoWallets.id })
        .from(mercadoWallets)
        .where(eq(mercadoWallets.user_id, bet.user_id))
        .limit(1)

      const [user] = await tx
        .select({
          address: users.address,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, bet.user_id))
        .limit(1)

      if (wallet) {
        await tx
          .update(mercadoWallets)
          .set({
            saldo: sql`${mercadoWallets.saldo} + ${payoutGarantido}`,
            updated_at: new Date(),
          })
          .where(eq(mercadoWallets.user_id, bet.user_id))
      }
      else {
        await tx
          .insert(mercadoWallets)
          .values({
            user_id: bet.user_id,
            address: String(user?.address || user?.email || `mercadofacil:${bet.user_id}`),
            chain_id: 0,
            is_primary: true,
            saldo: String(payoutGarantido),
            created_at: new Date(),
            updated_at: new Date(),
          })
      }

      await tx.insert(mercadoTransactions).values({
        user_id: bet.user_id,
        tipo: 'GANHO',
        valor: String(payoutGarantido),
        status: 'CONFIRMADO',
        referencia_externa: bet.id,
      })

      stats.amountPaid += payoutGarantido
    }

    for (const bet of losers) {
      await tx
        .update(mercadoBets)
        .set({ status: 'PERDEU', updated_at: new Date() })
        .where(eq(mercadoBets.id, bet.id))
    }

    console.log(
      `[PAYOUT] Concluído! Vencedores: ${stats.winners}, Perdedores: ${stats.losers}, `
      + `Pago: R$ ${stats.amountPaid.toFixed(2)}, Reserva usada: R$ ${stats.reserveUsed.toFixed(2)}, `
      + `Cobertura da casa: R$ ${stats.houseCoverage.toFixed(2)}`,
    )

    return stats
  })
}

/**
 * Resolução automática baseada em dados externos (Polymarket, etc.)
 */
export async function resolveByExternalResult(
  marketId: string,
  conditionId: string,
) {
  try {
    const url = `https://gamma-api.polymarket.com/markets?conditionIds=${conditionId}`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Polymarket API error: ${res.status}`)
    }
    const data = await res.json()
    const market = data?.[0]

    if (!market?.closed) {
      console.log(`[PAYOUT_AUTO] Mercado ${conditionId} ainda não fechado na Polymarket`)
      return null
    }

    const prices = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices)
      : market.outcomePrices

    const probSim = Number(prices?.[0])
    const vencedor: 'SIM' | 'NAO' = probSim > 0.9 ? 'SIM' : 'NAO'

    console.log(`[PAYOUT_AUTO] Mercado ${marketId} resolvido automaticamente como ${vencedor}`)
    return await resolveMercadoLive(marketId, vencedor)
  }
  catch (err) {
    console.error(`[PAYOUT_AUTO_ERROR] Mercado ${marketId}:`, err)
    throw err
  }
}
