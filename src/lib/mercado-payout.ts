import { and, eq, sql } from 'drizzle-orm'
import { mercadoBets, mercadosLive, mercadoTransactions, mercadoWallets } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

/**
 * Resolve um mercado do Mercado Fácil e paga os vencedores.
 *
 * Modelo de payout GARANTIDO: cada vencedor recebe exatamente
 * o `payout_garantido` bloqueado no momento da sua aposta.
 *
 * O fundo de reserva (`payout_reserve`) cobre eventuais gaps quando
 * o pool de perdedores não é suficiente para cobrir todos os payouts.
 *
 * @param marketId ID do mercado
 * @param vencedorLabel 'SIM' ou 'NAO'
 */
export async function resolveMercadoLive(
  marketId: string,
  vencedorLabel: 'SIM' | 'NAO',
) {
  console.log(`[PAYOUT] Iniciando resolução do mercado ${marketId}. Vencedor: ${vencedorLabel}`)

  return await db.transaction(async (tx) => {
    // 1. Buscar mercado e validar estado
    const [market] = await tx
      .select()
      .from(mercadosLive)
      .where(eq(mercadosLive.id, marketId))
      .limit(1)

    if (!market) { throw new Error('Mercado não encontrado') }
    if (market.status === 'RESOLVIDO') { throw new Error('Mercado já foi resolvido anteriormente') }

    // 2. Marcar mercado como resolvido
    await tx
      .update(mercadosLive)
      .set({
        status: 'RESOLVIDO',
        vencedor_label: vencedorLabel,
        updated_at: new Date(),
      })
      .where(eq(mercadosLive.id, marketId))

    // 3. Buscar todas as apostas pendentes
    const bets = await tx
      .select()
      .from(mercadoBets)
      .where(
        and(
          eq(mercadoBets.live_id, marketId),
          eq(mercadoBets.status, 'PENDENTE'),
        ),
      )

    console.log(`[PAYOUT] Processando ${bets.length} apostas`)

    const stats = { winners: 0, losers: 0, amountPaid: 0, reserveUsed: 0 }

    for (const bet of bets) {
      if (bet.opcao === vencedorLabel) {
        // ── VENCEDOR: recebe payout_garantido bloqueado ──────
        //
        // Se payout_garantido não estiver preenchido (apostas antigas),
        // usa o cálculo legado: cotas * 1 (já que cotas = valor/preço)
        const payoutGarantido = Number(bet.payout_garantido) > 0
          ? Number(bet.payout_garantido)
          : Number(bet.cotas) // fallback legado

        // Marcar aposta como GANHOU
        await tx
          .update(mercadoBets)
          .set({ status: 'GANHOU', updated_at: new Date() })
          .where(eq(mercadoBets.id, bet.id))

        // Creditar na carteira
        await tx
          .update(mercadoWallets)
          .set({
            saldo: sql`${mercadoWallets.saldo} + ${payoutGarantido}`,
            updated_at: new Date(),
          })
          .where(eq(mercadoWallets.user_id, bet.user_id))

        // Registrar transação de ganho
        await tx.insert(mercadoTransactions).values({
          user_id: bet.user_id,
          tipo: 'GANHO',
          valor: String(payoutGarantido),
          status: 'CONFIRMADO',
          referencia_externa: bet.id,
        })

        stats.winners++
        stats.amountPaid += payoutGarantido
      }
      else {
        // ── PERDEDOR: aposta vai para o pool de pendedores ──
        await tx
          .update(mercadoBets)
          .set({ status: 'PERDEU', updated_at: new Date() })
          .where(eq(mercadoBets.id, bet.id))

        stats.losers++
      }
    }

    console.log(
      `[PAYOUT] Concluído! Vencedores: ${stats.winners}, Perdedores: ${stats.losers}, `
      + `Pago: R$ ${stats.amountPaid.toFixed(2)}`,
    )

    return stats
  })
}

/**
 * Resolução automática baseada em dados externos (Polymarket, etc.)
 * Chamado via cron ou webhook quando o resultado do evento é conhecido.
 */
export async function resolveByExternalResult(
  marketId: string,
  conditionId: string,
) {
  // Buscar resultado da Polymarket
  try {
    const url = `https://gamma-api.polymarket.com/markets?conditionIds=${conditionId}`
    const res = await fetch(url)
    if (!res.ok) { throw new Error(`Polymarket API error: ${res.status}`) }
    const data = await res.json()
    const market = data?.[0]

    if (!market?.closed) {
      console.log(`[PAYOUT_AUTO] Mercado ${conditionId} ainda não fechado na Polymarket`)
      return null
    }

    // Determinar vencedor pelo outcomePrices (preço ~ 1.0 = vencedor)
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
