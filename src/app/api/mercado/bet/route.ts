import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/drizzle'
import { mercadosLive, mercadoWallets, mercadoBets, mercadoTransactions } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar Sessão
    const session = await auth.api.getSession({
      headers: req.headers
    })

    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await req.json()
    const { market_id, opcao, valor } = body

    // 2. Validações Básicas
    if (!market_id || !opcao || !valor) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }
    
    // Normalização lógica para as colunas do DB
    const normalizedOpcao = String(opcao).toUpperCase()
    const isFirstOption = ['SIM', 'YES', 'OP_0', 'TRUE', '1'].includes(normalizedOpcao) || String(opcao).toLowerCase() === 'sim'
    const isSecondOption = ['NAO', 'NÃO', 'NO', 'OP_1', 'FALSE', '0'].includes(normalizedOpcao) || String(opcao).toLowerCase() === 'nao'
    
    // Aceitamos qualquer opção vinda do frontend (o DB guardará o texto original na bet)


    const valorAposta = Number(valor)
    if (isNaN(valorAposta) || valorAposta < 1) {
      return NextResponse.json({ success: false, error: 'Valor mínimo de R$ 1,00' }, { status: 400 })
    }

    const taxa = valorAposta * 0.03 // 3% taxa
    const custoTotal = valorAposta + taxa

    // 3. Processar Aposta em Transação
    const result = await db.transaction(async (tx) => {
      // A. Buscar Mercado (com trava para atualização)
      const marketResults = await tx.select().from(mercadosLive).where(eq(mercadosLive.id, market_id)).limit(1)
      const market = marketResults[0]

      if (!market) throw new Error('Mercado não encontrado')
      if (market.status !== 'AO_VIVO' && market.status !== 'ABERTO') {
        throw new Error(`Mercado não está aberto (status: ${market.status})`)
      }

      // B. Buscar Carteira do Usuário
      const walletResults = await tx.select().from(mercadoWallets).where(eq(mercadoWallets.user_id, userId)).limit(1)
      const wallet = walletResults[0]

      if (!wallet) throw new Error('Carteira não encontrada. Faça um depósito para começar.')
      if (Number(wallet.saldo) < custoTotal) {
        throw new Error(`Saldo insuficiente. Você precisa de R$ ${custoTotal.toFixed(2)}`)
      }

      // C. Calcular Odds e Cotas (AMM Simplificado)
      const totalSim = Number(market.total_sim) || 0
      const totalNao = Number(market.total_nao) || 0
      const totalPool = totalSim + totalNao

      let preco: number
      if (totalPool === 0) {
        preco = 0.5
      } else if (isFirstOption) {
        preco = totalSim / totalPool
      } else {
        preco = totalNao / totalPool
      }
      
      // Limitar preço entre 0.01 e 0.99 para evitar divisão por zero ou odds infinitas
      preco = Math.min(Math.max(preco, 0.01), 0.99)
      const multiplicador = 1 / preco
      const cotas = valorAposta / preco

      // D. Atualizar Saldo
      await tx.update(mercadoWallets)
        .set({ saldo: sql`${mercadoWallets.saldo} - ${custoTotal}`, updated_at: new Date() })
        .where(eq(mercadoWallets.user_id, userId))

      // E. Atualizar Pool do Mercado
      if (isFirstOption) {
        await tx.update(mercadosLive)
          .set({ total_sim: sql`${mercadosLive.total_sim} + ${valorAposta}` })
          .where(eq(mercadosLive.id, market_id))
      } else {
        await tx.update(mercadosLive)
          .set({ total_nao: sql`${mercadosLive.total_nao} + ${valorAposta}` })
          .where(eq(mercadosLive.id, market_id))
      }

      // F. Registrar Aposta
      const [newBet] = await tx.insert(mercadoBets).values({
        user_id: userId,
        live_id: market_id,
        opcao: opcao,
        valor: String(valorAposta),
        cotas: String(cotas),
        multiplicador_no_momento: String(multiplicador),
        status: 'PENDENTE',
      }).returning({ id: mercadoBets.id })

      // G. Registrar Transações Financeiras
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
          valor: String(-taxa),
          status: 'CONFIRMADO',
          referencia_externa: newBet.id,
        }
      ])

      return {
        bet_id: newBet.id,
        cotas,
        multiplicador,
        new_balance: Number(wallet.saldo) - custoTotal
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Aposta confirmada!',
      data: result
    })

  } catch (error: any) {
    console.error('[BET_ERROR]', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Erro ao processar aposta' 
    }, { status: error.message?.includes('Saldo') ? 400 : 500 })
  }
}
