import type { PoolState } from '@/lib/amm'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { calcularPrecos } from '@/lib/amm'
import { botBets, mercadosLive } from '@/lib/db/schema'
/**
 * Bot Oracle Adjust — calibra odds dos mercados Polymarket.
 *
 * Roda via Vercel Cron a cada 5 minutos.
 * Busca o preço atual na Polymarket e ajusta o pool sintético
 * se a divergência for maior que o threshold.
 */
import { db } from '@/lib/drizzle'

/** Divergência mínima (em pontos percentuais) para acionar ajuste */
const ADJUST_THRESHOLD = 0.05 // 5%

/** Volume máximo de ajuste por run (para não distorcer demais) */
const MAX_ADJUST_PER_RUN = 500 // R$ 500

/**
 * Busca a probabilidade atual de SIM na Polymarket CLOB API.
 */
async function fetchPolymarketProb(conditionId: string): Promise<number | null> {
  try {
    // Usar endpoint interno proxy para evitar CORS e chaves de API
    const url = `https://gamma-api.polymarket.com/markets?conditionIds=${conditionId}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    })
    if (!res.ok) { return null }
    const data = await res.json()
    const market = data?.[0]
    if (!market) { return null }
    // Polymarket retorna outcomePrices como JSON array string ["0.65", "0.35"]
    const prices = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices)
      : market.outcomePrices
    const probSim = Number(prices?.[0])
    return Number.isFinite(probSim) ? probSim : null
  }
  catch {
    return null
  }
}

/**
 * Calcula quanto injetar para cada lado para atingir a probAlvo.
 * Mantém volume máximo controlado.
 */
function calcularAjuste(
  pool: PoolState,
  probAlvo: number,
): { opcao: 'SIM' | 'NAO', valor: number } | null {
  const precos = calcularPrecos(pool)
  const diff = Math.abs(precos.probSim - probAlvo)
  if (diff < ADJUST_THRESHOLD) { return null }

  // Decidir para qual lado apostar para empurrar o preço em direção a probAlvo
  const apostaSim = probAlvo > precos.probSim

  // Cálculo simples: quanto injetar para mover a prob X pontos percentuais
  // Para pool maior → precisa de mais volume para mover
  const totalPool = pool.totalSimReal + pool.totalNaoReal + pool.poolSeedSim + pool.poolSeedNao
  const valorAjuste = Math.min(
    totalPool * diff * 0.5, // mover ~50% da diferença
    MAX_ADJUST_PER_RUN,
  )

  if (valorAjuste < 1) { return null }

  return {
    opcao: apostaSim ? 'SIM' : 'NAO',
    valor: Math.round(valorAjuste),
  }
}

/**
 * Executa o ciclo de calibração de todos os mercados Polymarket ativos.
 */
export async function runOracleAdjust(): Promise<{
  adjusted: number
  skipped: number
  errors: number
}> {
  const stats = { adjusted: 0, skipped: 0, errors: 0 }

  // Buscar todos os mercados Polymarket abertos
  const markets = await db
    .select()
    .from(mercadosLive)
    .where(
      and(
        eq(mercadosLive.market_origin, 'polymarket'),
        isNotNull(mercadosLive.polymarket_condition_id),
      ),
    )

  for (const market of markets) {
    if (!['AO_VIVO', 'ABERTO'].includes(market.status)) {
      stats.skipped++
      continue
    }

    try {
      const conditionId = market.polymarket_condition_id!
      const probSim = await fetchPolymarketProb(conditionId)
      if (probSim === null) {
        console.warn(`[BOT_ORACLE] Falha ao buscar prob para ${market.id}`)
        stats.skipped++
        continue
      }

      const pool: PoolState = {
        totalSimReal: Number(market.total_sim) || 0,
        totalNaoReal: Number(market.total_nao) || 0,
        poolSeedSim: Number(market.pool_seed_sim) || 0,
        poolSeedNao: Number(market.pool_seed_nao) || 0,
      }

      const ajuste = calcularAjuste(pool, probSim)

      if (!ajuste) {
        stats.skipped++
        continue
      }

      // Aplicar ajuste no pool sintético
      const coluna = ajuste.opcao === 'SIM' ? mercadosLive.pool_seed_sim : mercadosLive.pool_seed_nao
      await db
        .update(mercadosLive)
        .set({
          [ajuste.opcao === 'SIM' ? 'pool_seed_sim' : 'pool_seed_nao']:
            sql`${coluna} + ${ajuste.valor}`,
          polymarket_last_prob: String(probSim),
          polymarket_last_sync: new Date(),
          updated_at: new Date(),
        })
        .where(eq(mercadosLive.id, market.id))

      // Log
      await db.insert(botBets).values({
        live_id: market.id,
        opcao: ajuste.opcao,
        valor: String(ajuste.valor),
        bot_type: 'oracle_adjust',
        prob_target: String(probSim),
      })

      console.log(`[BOT_ORACLE] ${market.id}: ajuste ${ajuste.opcao} R$${ajuste.valor} → alvo ${(probSim * 100).toFixed(1)}%`)
      stats.adjusted++
    }
    catch (err) {
      console.error(`[BOT_ORACLE] Erro no mercado ${market.id}:`, err)
      stats.errors++
    }
  }

  return stats
}
