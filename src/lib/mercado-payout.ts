import { db } from '@/lib/drizzle'
import { mercadosLive, mercadoWallets, mercadoBets, mercadoTransactions } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

/**
 * Resolve um mercado do Mercado Fácil e paga os vencedores
 * @param marketId ID do mercado (mercados_live)
 * @param vencedorLabel 'SIM' ou 'NAO'
 */
export async function resolveMercadoLive(marketId: string, vencedorLabel: 'SIM' | 'NAO') {
  console.log(`[PAYOUT] Iniciando resolução do mercado ${marketId}. Vencedor: ${vencedorLabel}`)

  return await db.transaction(async (tx) => {
    // 1. Buscar Mercado
    const marketResults = await tx.select().from(mercadosLive).where(eq(mercadosLive.id, marketId)).limit(1)
    const market = marketResults[0]

    if (!market) throw new Error('Mercado não encontrado')
    if (market.status === 'RESOLVIDO') throw new Error('Mercado já foi resolvido anteriormente')

    // 2. Atualizar status do Mercado
    await tx.update(mercadosLive)
      .set({ 
        status: 'RESOLVIDO', 
        vencedor_label: vencedorLabel,
        updated_at: new Date() 
      })
      .where(eq(mercadosLive.id, marketId))

    // 3. Buscar todas as apostas pendentes deste mercado
    const bets = await tx.select()
      .from(mercadoBets)
      .where(
        and(
          eq(mercadoBets.live_id, marketId),
          eq(mercadoBets.status, 'PENDENTE')
        )
      )

    console.log(`[PAYOUT] Processando ${bets.length} apostas para o mercado ${marketId}`)

    const processedBets = { winners: 0, losers: 0, amountPaid: 0 }

    for (const bet of bets) {
      if (bet.opcao === vencedorLabel) {
        // --- VENCEDOR ---
        const valorGanho = Number(bet.cotas)

        // A. Marcar aposta como GANHOU
        await tx.update(mercadoBets)
          .set({ status: 'GANHOU', updated_at: new Date() })
          .where(eq(mercadoBets.id, bet.id))

        // B. Creditar na carteira do usuário
        await tx.update(mercadoWallets)
          .set({ 
            saldo: sql`${mercadoWallets.saldo} + ${valorGanho}`,
            updated_at: new Date() 
          })
          .where(eq(mercadoWallets.user_id, bet.user_id))

        // C. Registrar Transação de Ganho
        await tx.insert(mercadoTransactions).values({
          user_id: bet.user_id,
          tipo: 'GANHO',
          valor: String(valorGanho),
          status: 'CONFIRMADO',
          referencia_externa: bet.id,
        })

        processedBets.winners++
        processedBets.amountPaid += valorGanho
      } else {
        // --- PERDEDOR ---
        // A. Marcar aposta como PERDEU
        await tx.update(mercadoBets)
          .set({ status: 'PERDEU', updated_at: new Date() })
          .where(eq(mercadoBets.id, bet.id))

        processedBets.losers++
      }
    }

    console.log(`[PAYOUT] Sucesso! Vencedores: ${processedBets.winners}, Perdedores: ${processedBets.losers}, Pago: R$ ${processedBets.amountPaid.toFixed(2)}`)
    
    return processedBets
  })
}
