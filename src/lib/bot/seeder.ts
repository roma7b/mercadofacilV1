import type { MarketOrigin } from './types'
import { eq, sql } from 'drizzle-orm'
import { botBets, mercadosLive } from '@/lib/db/schema'
/**
 * Bot Seeder — injeta volume sintético inicial em novos mercados.
 *
 * Chamado automaticamente quando um mercado é criado.
 * NÃO movimenta carteiras reais.
 */
import { db } from '@/lib/drizzle'

// ─── Configuração por tipo de mercado ───────────────────────────────────────

export interface SeedConfig {
  totalSeed: number // Volume sintético total em BRL
  probSim: number // Probabilidade inicial do SIM (0 a 1)
}

export const SEED_CONFIGS: Record<MarketOrigin, SeedConfig> = {
  manual: { totalSeed: 1000, probSim: 0.50 }, // 50/50 para mercados manuais
  livecam: { totalSeed: 500, probSim: 0.50 }, // 50/50 para câmeras
  polymarket: { totalSeed: 2000, probSim: -1 }, // -1 = usar prob da Polymarket
}

/**
 * Executa seed inicial de um mercado recém-criado.
 *
 * @param marketId ID do mercado em `mercados_live`
 * @param origin Tipo de mercado ('manual' | 'livecam' | 'polymarket')
 * @param polyProb Probabilidade inicial do SIM quando origin = 'polymarket' (0 a 1)
 */
export async function seedMarket(
  marketId: string,
  origin: MarketOrigin,
  polyProb?: number,
): Promise<{ seedSim: number, seedNao: number }> {
  const cfg = SEED_CONFIGS[origin]

  // Resolver probabilidade inicial
  let probSim: number
  if (origin === 'polymarket' && polyProb !== undefined) {
    probSim = Math.min(Math.max(polyProb, 0.01), 0.99) // clamp
  }
  else {
    probSim = cfg.probSim > 0 ? cfg.probSim : 0.5
  }

  const seedSim = cfg.totalSeed * probSim
  const seedNao = cfg.totalSeed * (1 - probSim)

  // Atualizar pool sintético do mercado
  await db
    .update(mercadosLive)
    .set({
      pool_seed_sim: sql`${mercadosLive.pool_seed_sim} + ${seedSim}`,
      pool_seed_nao: sql`${mercadosLive.pool_seed_nao} + ${seedNao}`,
      updated_at: new Date(),
    })
    .where(eq(mercadosLive.id, marketId))

  // Registrar no log de bots
  await db.insert(botBets).values([
    {
      live_id: marketId,
      opcao: 'SIM',
      valor: String(seedSim),
      bot_type: 'seeder',
      prob_target: String(probSim),
    },
    {
      live_id: marketId,
      opcao: 'NAO',
      valor: String(seedNao),
      bot_type: 'seeder',
      prob_target: String(1 - probSim),
    },
  ])

  console.log(`[BOT_SEEDER] Mercado ${marketId} (${origin}): SIM=R$${seedSim.toFixed(0)}, NÃO=R$${seedNao.toFixed(0)}`)
  return { seedSim, seedNao }
}
