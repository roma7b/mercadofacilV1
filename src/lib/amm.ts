/**
 * Motor AMM Parimutuel — Mercado Fácil
 *
 * Funções puras de cálculo de preço. Não têm efeitos colaterais.
 * Podem ser usadas no frontend (para preview) e no backend (para execução real).
 *
 * Modelo: Constant Sum Pool + payout GARANTIDO no momento da aposta.
 * O multiplicador é bloqueado quando o usuário aposta.
 */

// ────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────

/** Taxa de plataforma (3%). Debitada do valor apostado antes de calcular o pool. */
export const FEE_RATE = 0.03

/** Taxa de reserva de garantia (10%). Forma o fundo que cobre payouts garantidos. */
export const GUARANTEE_RATE = 0.10

/** Probabilidade mínima para qualquer outcome (evita divisão por zero e odds infinitas). */
export const MIN_PROB = 0.01

/** Probabilidade máxima para qualquer outcome. */
export const MAX_PROB = 0.99

/** Valor mínimo de aposta em BRL */
export const MIN_BET_AMOUNT = 1.0

// ────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────

export type Outcome = 'SIM' | 'NAO'

export interface PoolState {
  /** Pool de apostas reais de usuários no SIM */
  totalSimReal: number
  /** Pool de apostas reais de usuários no NÃO */
  totalNaoReal: number
  /** Pool sintético do bot no SIM */
  poolSeedSim: number
  /** Pool sintético do bot no NÃO */
  poolSeedNao: number
}

export interface PriceQuote {
  /** Probabilidade do SIM (0 a 1) */
  probSim: number
  /** Probabilidade do NÃO (0 a 1) */
  probNao: number
  /** Multiplicador do SIM (ex: 2.34x) */
  multiplierSim: number
  /** Multiplicador do NÃO (ex: 1.75x) */
  multiplierNao: number
  /** Volume total visível (real + sintético) */
  totalVolume: number
  /** Volume apenas de apostas reais */
  totalVolumeReal: number
}

export interface BetQuote {
  /** Valor líquido que entra no pool (descontado taxa e reserva) */
  valorLiquido: number
  /** Taxa de plataforma debitada */
  taxa: number
  /** Valor que vai para reserva de garantia */
  reserva: number
  /** Custo total cobrado do usuário */
  custoTotal: number
  /** Multiplicador bloqueado para esta aposta */
  multiplicadorBloqueado: number
  /** Payout garantido se vencer */
  payoutGarantido: number
  /** Probabilidade atual do outcome escolhido (antes da aposta) */
  probAtual: number
}

// ────────────────────────────────────────────────
// Funções Principais
// ────────────────────────────────────────────────

/**
 * Calcula o estado atual de preços do pool.
 * Considera tanto o pool real quanto o pool sintético do bot.
 */
export function calcularPrecos(pool: PoolState): PriceQuote {
  const totalSim = pool.totalSimReal + pool.poolSeedSim
  const totalNao = pool.totalNaoReal + pool.poolSeedNao
  const totalPool = totalSim + totalNao
  const totalReal = pool.totalSimReal + pool.totalNaoReal

  // Pool vazio → 50/50
  if (totalPool === 0) {
    return {
      probSim: 0.5,
      probNao: 0.5,
      multiplierSim: (1 / 0.5) * (1 - FEE_RATE),
      multiplierNao: (1 / 0.5) * (1 - FEE_RATE),
      totalVolume: 0,
      totalVolumeReal: 0,
    }
  }

  let probSim = totalSim / totalPool
  let probNao = totalNao / totalPool

  // Clamp para evitar extremos
  probSim = Math.min(Math.max(probSim, MIN_PROB), MAX_PROB)
  probNao = Math.min(Math.max(probNao, MIN_PROB), MAX_PROB)

  // Normalizar para que a soma seja sempre 1
  const sumProb = probSim + probNao
  probSim = probSim / sumProb
  probNao = probNao / sumProb

  return {
    probSim,
    probNao,
    multiplierSim: calcularMultiplicador(probSim),
    multiplierNao: calcularMultiplicador(probNao),
    totalVolume: totalPool,
    totalVolumeReal: totalReal,
  }
}

/**
 * Calcula o multiplicador de um outcome dado sua probabilidade.
 * Desconta a taxa de plataforma para chegar ao multiplicador líquido.
 */
export function calcularMultiplicador(prob: number): number {
  const prob_clamped = Math.min(Math.max(prob, MIN_PROB), MAX_PROB)
  // Multiplicador bruto = 1/prob, Líquido = desconta a taxa
  return (1 / prob_clamped) * (1 - FEE_RATE)
}

/**
 * Gera um orçamento completo para uma aposta.
 * Retorna todos os valores antes de confirmar (para mostrar ao usuário).
 *
 * @param pool Estado atual do pool
 * @param outcome 'SIM' ou 'NAO'
 * @param valorAposta Valor em BRL que o usuário quer apostar
 * @param guaranteeRate Taxa de reserva de garantia (padrão: GUARANTEE_RATE)
 */
export function calcularOrcamento(
  pool: PoolState,
  outcome: Outcome,
  valorAposta: number,
  guaranteeRate = GUARANTEE_RATE,
): BetQuote {
  // 1. Calcular preço ANTES da aposta (esse é o multiplicador que será bloqueado)
  const precos = calcularPrecos(pool)
  const probAtual = outcome === 'SIM' ? precos.probSim : precos.probNao
  const multiplicador = outcome === 'SIM' ? precos.multiplierSim : precos.multiplierNao

  // 2. Decompor o valor apostado
  //    valorAposta = taxa + reserva + valorLiquido
  const taxa = valorAposta * FEE_RATE
  const reserva = valorAposta * guaranteeRate
  const valorLiquido = valorAposta - taxa - reserva

  // 3. Calcular payout garantido
  //    Baseado no valor TOTAL apostado × multiplicador bloqueado
  const payoutGarantido = valorAposta * multiplicador

  return {
    valorLiquido,
    taxa,
    reserva,
    custoTotal: valorAposta,
    multiplicadorBloqueado: multiplicador,
    payoutGarantido,
    probAtual,
  }
}

/**
 * Calcula o estado do pool APÓS uma aposta, para preview de impacto nos preços.
 */
export function calcularPoolPosAposta(
  pool: PoolState,
  outcome: Outcome,
  valorLiquido: number,
): PoolState {
  if (outcome === 'SIM') {
    return { ...pool, totalSimReal: pool.totalSimReal + valorLiquido }
  }
  return { ...pool, totalNaoReal: pool.totalNaoReal + valorLiquido }
}

/**
 * Normaliza uma string de opcao para 'SIM' ou 'NAO'.
 * Aceita variações como 'sim', 'yes', 'S', '1', etc.
 */
export function normalizeOpcao(raw: string): Outcome | null {
  const upper = String(raw).toUpperCase().trim()
  if (['SIM', 'YES', 'S', '1', 'TRUE', 'OP_0'].includes(upper)) { return 'SIM' }
  if (['NAO', 'NÃO', 'NO', 'N', '0', 'FALSE', 'OP_1'].includes(upper)) { return 'NAO' }
  return null
}

/**
 * Formata um multiplicador para exibição (ex: 2.34 → "2.34x")
 */
export function formatMultiplicador(mult: number): string {
  return `${mult.toFixed(2)}x`
}

/**
 * Formata uma probabilidade para exibição (ex: 0.6543 → "65.4%")
 */
export function formatProb(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`
}
