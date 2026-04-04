import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Criar o cliente com service role diretamente para garantir bypass do RLS
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) {
    throw new Error('Supabase service role não configurado')
  }
  return createClient(url, key)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { market_id, opcao, valor, user_id: providedUserId } = body

    if (!market_id || !opcao || !valor) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }
    if (!['SIM', 'NAO'].includes(opcao)) {
      return NextResponse.json({ success: false, error: 'Opção inválida: use SIM ou NAO' }, { status: 400 })
    }

    const userId = providedUserId
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Usuário não identificado' }, { status: 401 })
    }

    const db = getAdminClient()

    // 1. Verificar mercado
    const { data: market, error: mError } = await db
      .from('mercados_live')
      .select('id, status, total_sim, total_nao, titulo')
      .eq('id', market_id)
      .single()

    if (mError || !market) {
      return NextResponse.json({ success: false, error: 'Mercado não encontrado' }, { status: 404 })
    }

    if (market.status !== 'AO_VIVO' && market.status !== 'ABERTO') {
      return NextResponse.json({
        success: false,
        error: `Mercado não está aberto para apostas (status: ${market.status})`,
      }, { status: 403 })
    }

    const valorAposta = Number(valor)
    if (valorAposta < 1) {
      return NextResponse.json({ success: false, error: 'Valor mínimo de R$ 1,00' }, { status: 400 })
    }

    const taxa = valorAposta * 0.03 // 3% taxa
    const custoTotal = valorAposta + taxa

    // 2. Verificar saldo
    const { data: wallet, error: wError } = await db
      .from('wallets')
      .select('saldo')
      .eq('user_id', userId)
      .single()

    if (wError || !wallet) {
      return NextResponse.json({
        success: false,
        error: 'Carteira não encontrada. Faça login para apostar.',
      }, { status: 400 })
    }

    if (Number(wallet.saldo) < custoTotal) {
      return NextResponse.json({
        success: false,
        error: `Saldo insuficiente. Necessário: R$ ${custoTotal.toFixed(2)}, Disponível: R$ ${Number(wallet.saldo).toFixed(2)}`,
      }, { status: 400 })
    }

    // 3. Calcular odds e cotas
    const totalSim = Number(market.total_sim) || 0
    const totalNao = Number(market.total_nao) || 0
    const totalPool = totalSim + totalNao

    let preco: number
    if (totalPool === 0) {
      preco = 0.5
    } else if (opcao === 'SIM') {
      preco = totalSim / totalPool
    } else {
      preco = totalNao / totalPool
    }
    preco = Math.min(Math.max(preco, 0.01), 0.99)

    const multiplicador = 1 / preco
    const cotas = valorAposta / preco

    // 4. Deduzir saldo
    const { error: updWalletError } = await db
      .from('wallets')
      .update({ saldo: Number(wallet.saldo) - custoTotal })
      .eq('user_id', userId)

    if (updWalletError) {
      console.error('[BET] Erro ao deduzir saldo:', updWalletError)
      throw new Error('Erro ao atualizar saldo')
    }

    // 5. Atualizar pool do mercado
    const poolUpdate = opcao === 'SIM'
      ? { total_sim: totalSim + valorAposta }
      : { total_nao: totalNao + valorAposta }

    const { error: updMarketError } = await db
      .from('mercados_live')
      .update(poolUpdate)
      .eq('id', market_id)

    if (updMarketError) {
      console.error('[BET] Erro ao atualizar pool:', updMarketError)
      throw new Error('Erro ao atualizar pool do mercado')
    }

    // 6. Registrar aposta (com todos os campos obrigatórios)
    const { data: bet, error: insBetError } = await db
      .from('bets')
      .insert({
        user_id: userId,
        live_id: market_id,
        market_id: null,
        opcao: opcao,
        valor: valorAposta,
        cotas: cotas,
        multiplicador_no_momento: multiplicador,
        status: 'PENDENTE',
      })
      .select('id')
      .single()

    if (insBetError) {
      console.error('[BET] Erro ao registrar aposta:', insBetError)
      throw new Error('Erro ao registrar aposta: ' + insBetError.message)
    }

    // 7. Registrar transações
    await db.from('transactions').insert([
      {
        user_id: userId,
        tipo: 'APOSTA',
        valor: -valorAposta,
        status: 'CONFIRMADO',
        referencia_externa: bet.id,
      },
      {
        user_id: userId,
        tipo: 'TAXA',
        valor: -taxa,
        status: 'CONFIRMADO',
        referencia_externa: bet.id,
      },
    ])

    return NextResponse.json({
      success: true,
      message: 'Aposta realizada com sucesso!',
      data: {
        bet_id: bet.id,
        opcao,
        valor: valorAposta,
        cotas: cotas.toFixed(4),
        multiplicador: multiplicador.toFixed(4),
        taxa: taxa.toFixed(2),
        new_balance: (Number(wallet.saldo) - custoTotal).toFixed(2),
      },
    })
  }
  catch (error: any) {
    console.error('[BET] Erro interno:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
