import type { PoolState } from '@/lib/amm'
import { eq, or, sql } from 'drizzle-orm'
import { calcularPrecos } from '@/lib/amm'
import { botBets, mercadosLive } from '@/lib/db/schema'
/**
 * Bot Noise — gera atividade sintética realista em mercados abertos.
 *
 * Roda via Vercel Cron a cada 15 minutos.
 * Aposta valores pequenos e aleatórios para simular usuários orgânicos.
 */
import { db } from '@/lib/drizzle'

/** Valor mínimo/máximo de cada aposta de ruído */
const NOISE_MIN = 5
const NOISE_MAX = 80

/** Número máximo de apostas por run */
const MAX_BETS_PER_RUN = 15

/** Probabilidade de o bot fazer UMA aposta por mercado por run (1 = sempre, 0 = nunca) */
const BET_PROBABILITY = 0.4

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Escolhe o lado a apostar com bias para o lado menos popular (rebalancear levemente).
 */
function escolherOutcome(pool: PoolState): 'SIM' | 'NAO' {
  const precos = calcularPrecos(pool)
  // Viés leve para o lado menos apostado (rebalancear naturalmente)
  // Se SIM tem 70% chance → bot aposta NAO com 60% de probabilidade
  const biasNao = precos.probSim > 0.5 ? 0.6 : 0.4
  return Math.random() < biasNao ? 'NAO' : 'SIM'
}

/**
 * Executa o ciclo de ruído — aposta em mercados aleatórios.
 */
export async function runNoise(): Promise<{ bets: number, skipped: number }> {
  const stats = { bets: 0, skipped: 0 }

  const markets = await db
    .select()
    .from(mercadosLive)
    .where(or(eq(mercadosLive.status, 'AO_VIVO'), eq(mercadosLive.status, 'ABERTO')))

  // Limitar a um máximo de apostas por run
  const shuffled = markets.sort(() => Math.random() - 0.5).slice(0, MAX_BETS_PER_RUN)

  for (const market of shuffled) {
    // Chance aleatória de pular este mercado
    if (Math.random() > BET_PROBABILITY) {
      stats.skipped++
      continue
    }

    const pool: PoolState = {
      totalSimReal: Number(market.total_sim) || 0,
      totalNaoReal: Number(market.total_nao) || 0,
      poolSeedSim: Number(market.pool_seed_sim) || 0,
      poolSeedNao: Number(market.pool_seed_nao) || 0,
    }

    const outcome = escolherOutcome(pool)
    const valor = randomBetween(NOISE_MIN, NOISE_MAX)

    const coluna = outcome === 'SIM' ? mercadosLive.pool_seed_sim : mercadosLive.pool_seed_nao

    await db
      .update(mercadosLive)
      .set({
        [outcome === 'SIM' ? 'pool_seed_sim' : 'pool_seed_nao']:
          sql`${coluna} + ${valor}`,
        updated_at: new Date(),
      })
      .where(eq(mercadosLive.id, market.id))

    await db.insert(botBets).values({
      live_id: market.id,
      opcao: outcome,
      valor: String(valor),
      bot_type: 'noise',
    })

    stats.bets++
  }

  console.log(`[BOT_NOISE] Run completo: ${stats.bets} apostas, ${stats.skipped} pulados`)
  return stats
}
