import type { NextRequest } from 'next/server'
import type { PoolState } from '@/lib/amm'
import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import {
  calcularOrcamento,
  calcularPoolPosAposta,
  calcularPrecos,
  GUARANTEE_RATE,
  MIN_BET_AMOUNT,
  normalizeOpcao,

} from '@/lib/amm'
import { auth } from '@/lib/auth'
import { mercadoBets, mercadosLive, mercadoTransactions, mercadoWallets } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

export async function POST(req: NextRequest) {
  try {
    // ── 1. Autenticação ──────────────────────────────────────────
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }
    const userId = session.user.id

    // ── 2. Parsing e validação dos parâmetros ───────────────────
    const body = await req.json()
    const { market_id, opcao, valor } = body

    if (!market_id || !opcao || valor == null) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios ausentes: market_id, opcao, valor' }, { status: 400 })
    }

    const outcome = normalizeOpcao(String(opcao))
    if (!outcome) {
      return NextResponse.json({ success: false, error: 'Opção inválida. Use "SIM" ou "NAO".' }, { status: 400 })
    }

    const valorAposta = Number(valor)
    if (Number.isNaN(valorAposta) || valorAposta < MIN_BET_AMOUNT) {
      return NextResponse.json({ success: false, error: `Valor mínimo de aposta: R$ ${MIN_BET_AMOUNT.toFixed(2)}` }, { status: 400 })
    }

    // ── 3. Executar dentro de uma transação atômica ─────────────
    const result = await db.transaction(async (tx) => {
      // A. Buscar mercado (com lock implícito na transação)
      const [market] = await tx
        .select()
        .from(mercadosLive)
        .where(eq(mercadosLive.id, market_id))
        .limit(1)

      if (!market) {
        throw new Error('Mercado não encontrado')
      }
      if (!['AO_VIVO', 'ABERTO'].includes(market.status)) {
        throw new Error(`Mercado não está aberto para apostas (status: ${market.status})`)
      }

      // B. Buscar carteira do usuário
      const [wallet] = await tx
        .select()
        .from(mercadoWallets)
        .where(eq(mercadoWallets.user_id, userId))
        .limit(1)

      if (!wallet) {
        throw new Error('Carteira não encontrada. Faça um depósito para começar.')
      }

      const saldoAtual = Number(wallet.saldo)
      if (saldoAtual < valorAposta) {
        throw new Error(`Saldo insuficiente. Disponível: R$ ${saldoAtual.toFixed(2)}`)
      }

      // C. Calcular orçamento da aposta usando o motor AMM
      const pool: PoolState = {
        totalSimReal: Number(market.total_sim) || 0,
        totalNaoReal: Number(market.total_nao) || 0,
        poolSeedSim: Number(market.pool_seed_sim) || 0,
        poolSeedNao: Number(market.pool_seed_nao) || 0,
      }

      const guaranteeRate = Number(market.guarantee_rate) || GUARANTEE_RATE
      const orcamento = calcularOrcamento(pool, outcome, valorAposta, guaranteeRate)

      // D. Debitar saldo do usuário (valor total da aposta)
      await tx
        .update(mercadoWallets)
        .set({
          saldo: sql`${mercadoWallets.saldo} - ${valorAposta}`,
          updated_at: new Date(),
        })
        .where(eq(mercadoWallets.user_id, userId))

      // E. Atualizar pool REAL do mercado e fundo de garantia
      const poolUpdate = outcome === 'SIM'
        ? {
            total_sim: sql`${mercadosLive.total_sim} + ${orcamento.valorLiquido}`,
            payout_reserve: sql`${mercadosLive.payout_reserve} + ${orcamento.reserva}`,
            volume: sql`${mercadosLive.volume} + ${valorAposta}`,
            updated_at: new Date(),
          }
        : {
            total_nao: sql`${mercadosLive.total_nao} + ${orcamento.valorLiquido}`,
            payout_reserve: sql`${mercadosLive.payout_reserve} + ${orcamento.reserva}`,
            volume: sql`${mercadosLive.volume} + ${valorAposta}`,
            updated_at: new Date(),
          }

      await tx.update(mercadosLive).set(poolUpdate).where(eq(mercadosLive.id, market_id))

      // F. Registrar aposta com payout garantido bloqueado
      const [newBet] = await tx.insert(mercadoBets).values({
        user_id: userId,
        live_id: market_id,
        opcao: outcome,
        valor: String(valorAposta),
        cotas: String(valorAposta / (orcamento.probAtual > 0 ? orcamento.probAtual : 0.5)),
        multiplicador_no_momento: String(orcamento.multiplicadorBloqueado),
        payout_garantido: String(orcamento.payoutGarantido),
        status: 'PENDENTE',
      }).returning({ id: mercadoBets.id })

      // G. Registrar transações financeiras para auditoria
      await tx.insert(mercadoTransactions).values([
        {
          user_id: userId,
          tipo: 'APOSTA',
          valor: String(-valorAposta),
          status: 'CONFIRMADO',
          referencia_externa: newBet.id,
        },
        {
          user_id: userId,
          tipo: 'TAXA',
          valor: String(-orcamento.taxa),
          status: 'CONFIRMADO',
          referencia_externa: newBet.id,
        },
      ])

      // H. Calcular preços pós-aposta para o retorno da API
      const poolPosAposta = calcularPoolPosAposta(pool, outcome, orcamento.valorLiquido)
      const precosPosAposta = calcularPrecos(poolPosAposta)

      return {
        bet_id: newBet.id,
        opcao: outcome,
        valor_apostado: valorAposta,
        multiplicador: orcamento.multiplicadorBloqueado,
        payout_garantido: orcamento.payoutGarantido,
        taxa: orcamento.taxa,
        saldo_restante: saldoAtual - valorAposta,
        novos_precos: {
          prob_sim: precosPosAposta.probSim,
          prob_nao: precosPosAposta.probNao,
          multiplicador_sim: precosPosAposta.multiplierSim,
          multiplicador_nao: precosPosAposta.multiplierNao,
        },
      }
    })

    return NextResponse.json({
      success: true,
      message: `Aposta confirmada! Se ${result.opcao} vencer, você recebe R$ ${result.payout_garantido.toFixed(2)}`,
      data: result,
    })
  }
  catch (error: any) {
    console.error('[BET_AMM_ERROR]', error)
    const isClientError = ['insuficiente', 'não está aberto', 'não encontrado', 'mínimo', 'inválid'].some(
      kw => error.message?.toLowerCase()?.includes(kw),
    )
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao processar aposta' },
      { status: isClientError ? 400 : 500 },
    )
  }
}

// ── GET: Consultar odds atuais de um mercado ─────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const market_id = searchParams.get('market_id')

  if (!market_id) {
    return NextResponse.json({ success: false, error: 'market_id é obrigatório' }, { status: 400 })
  }

  const [market] = await db
    .select()
    .from(mercadosLive)
    .where(eq(mercadosLive.id, market_id))
    .limit(1)

  if (!market) {
    return NextResponse.json({ success: false, error: 'Mercado não encontrado' }, { status: 404 })
  }

  const pool: PoolState = {
    totalSimReal: Number(market.total_sim) || 0,
    totalNaoReal: Number(market.total_nao) || 0,
    poolSeedSim: Number(market.pool_seed_sim) || 0,
    poolSeedNao: Number(market.pool_seed_nao) || 0,
  }

  const precos = calcularPrecos(pool)

  return NextResponse.json({
    success: true,
    data: {
      market_id,
      status: market.status,
      prob_sim: precos.probSim,
      prob_nao: precos.probNao,
      multiplicador_sim: precos.multiplierSim,
      multiplicador_nao: precos.multiplierNao,
      volume_total: precos.totalVolume,
      volume_real: precos.totalVolumeReal,
    },
  })
}
