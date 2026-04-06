'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/drizzle'
import { mercadosLive } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { 
  events as defaultEvents, 
  conditions as defaultConditions, 
  markets as defaultMarkets, 
  outcomes as defaultOutcomes 
} from '@/lib/db/schema/events/tables' 
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

interface ImportOutcome {
  text: string
  price: number
}

interface ImportMarketParams {
  polyId: string
  titulo: string
  descricao: string
  volumeUSD?: number
  outcomes: ImportOutcome[]
  imageUrl?: string
}

const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

export async function importExternalMarket(params: ImportMarketParams) {
  try {
    const { polyId, titulo, descricao, volumeUSD = 0, outcomes, imageUrl = '' } = params

    // 0. Evitar Duplicatas
    const existing = await db.select()
      .from(defaultEvents)
      .where(eq(defaultEvents.title, titulo))
      .limit(1)

    if (existing.length > 0) {
      console.log('[IMPORT_SKIPPED] Mercado já existe:', titulo)
      return { success: true, id: existing[0].id, alreadyExists: true }
    }
    
    // IDs Sincronizados
    const eventId = generateId().substring(0, 26)
    const conditionId = `cond-${generateId().substring(0, 21)}`
    const slug = `poly-${Math.random().toString(36).substring(2, 7)}-${Date.now()}`

    // 1. Criar o Evento
    await db.insert(defaultEvents).values({
      id: eventId,
      slug: slug,
      title: titulo,
      icon_url: imageUrl,
      status: 'active',
      is_hidden: false,
      created_at: new Date(),
      updated_at: new Date(),
    })

    // 2. Criar a Condition Salvando Referência Polymarket (PolyId)
    await db.insert(defaultConditions).values({
      id: conditionId,
      oracle: '0x0000000000000000000000000000000000000000',
      question_id: polyId, // Usamos o ID original da Poly aqui para o Sync
      created_at: new Date(),
      updated_at: new Date(),
    })

    // 3. Criar o Market com Regras
    await db.insert(defaultMarkets).values({
      condition_id: conditionId,
      event_id: eventId,
      title: titulo,
      slug: slug,
      question: titulo,
      market_rules: descricao,
      is_active: true,
      volume: String(volumeUSD),
      icon_url: imageUrl,
      created_at: new Date(),
      updated_at: new Date(),
    })

    // 4. Criar os Outcomes Dinamicamente com Preços Reais
    if (outcomes && outcomes.length > 0) {
      await db.insert(defaultOutcomes).values(
        outcomes.map((oc, index) => {
          const price = Number(oc.price) || 0.5
          return {
            condition_id: conditionId,
            outcome_text: oc.text,
            outcome_index: index,
            token_id: `token-${index}-${generateId().substring(0, 16)}`,
            buy_price: price.toFixed(2),
            sell_price: price.toFixed(2),
          }
        })
      )
    }

    // 5. Salvar na Tabela Mercado Fácil (Quick Bet)
    const opcoesObj: Record<string, string> = {}
    outcomes.forEach((oc, idx) => {
      opcoesObj[`op_${idx}`] = oc.text
    })

    // Calculamos o 'total' baseado na probabilidade real para o Quick Bet
    const probSim = Number(outcomes[0]?.price) || 0.5
    const probNao = Number(outcomes[1]?.price) || (1 - probSim)

    await db.insert(mercadosLive).values({
      id: eventId,
      titulo: titulo.substring(0, 100),
      descricao: descricao || '',
      camera_url: imageUrl,
      status: 'AO_VIVO',
      tipo_contagem: 'OUTRO',
      opcoes: opcoesObj,
      // No Mercado Fácil, os valores representam a probabilidade (ex: 0.03 para 3%)
      total_sim: probSim.toFixed(2),
      total_nao: probNao.toFixed(2),
      contagem_acumulada: 0,
    })

    console.log('[FULL_ROBUST_SYNC_SUCCESS]', eventId)
    revalidatePath('/', 'layout')
    
    return { success: true, id: eventId }

  } catch (error: any) {
    console.error('[IMPORT_CRITICAL_ERROR]', error)
    // Retornar o erro de forma mais limpa para o usuário
    const errorMsg = error.message.includes('unique constraint') 
      ? 'Este mercado já foi importado anteriormente.' 
      : error.message
    return { success: false, error: `Erro na Importação: ${errorMsg}` }
  }
}
