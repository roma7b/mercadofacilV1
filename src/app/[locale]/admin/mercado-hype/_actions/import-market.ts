'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { mercadosLive } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'

interface ImportMarketParams {
  polyId: string
  title: string
  description: string
  image: string
  volume: string
  volume_24h?: string
  endDate: string | null
  rules?: string
  outcomes: {
    text: string
    price: string | number
    tokenId?: string
  }[]
}

export async function importExternalMarket(params: ImportMarketParams) {
  try {
    const { polyId, title, description, image, volume, volume_24h, endDate, rules, outcomes } = params

    if (!polyId) {
      return { success: false, error: 'ID do mercado é obrigatório' }
    }

    const marketId = `poly-${polyId}`

    // Preparar opções como JSONB para compatibilidade com Mercado Fácil
    const opcoesObj: Record<string, any> = {}
    outcomes.forEach((oc, idx) => {
      opcoesObj[`op_${idx}`] = {
        text: String(oc.text || ''),
        tokenId: String(oc.tokenId || `${marketId}-${idx}`),
      }
    })

    const marketData = {
      id: marketId,
      titulo: String(title || 'Sem título').substring(0, 255),
      descricao: String(description || ''),
      camera_url: String(image || ''),
      status: 'AO_VIVO',
      tipo_contagem: 'OUTRO' as const,
      opcoes: opcoesObj,
      total_sim: outcomes[0] ? String(Math.floor(Number(outcomes[0].price) * 100000)) : '50000',
      total_nao: outcomes[1] ? String(Math.floor(Number(outcomes[1].price) * 100000)) : '50000',
      volume: String(volume || '0'),
      volume_24h: String(volume_24h || '0'),
      end_date: endDate ? new Date(endDate).toISOString() : null,
      rules: String(rules || description || ''),
    }

    // Inserir ou atualizar na tabela mercados_live
    await db.insert(mercadosLive).values(marketData).onConflictDoUpdate({
      target: mercadosLive.id,
      set: marketData,
    })

    // Revalidar as rotas para atualizar o frontend
    revalidatePath('/')
    revalidatePath('/admin/mercado-hype')

    return {
      success: true,
      id: marketId, // Retorna o ID correto para o feedback do usuário
      slug: `live_${marketId}`,
    }
  }
  catch (error: any) {
    console.error('[IMPORT_MARKET_DB_ERROR]', error)
    return { success: false, error: 'Falha ao salvar no banco. Verifique os dados.' }
  }
}
