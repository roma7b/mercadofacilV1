'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { translateTexts } from '@/lib/ai/translate'
import { mercadosLive } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'

interface ImportMarketParams {
  polyId: string
  conditionId?: string | null
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

function sanitizeImportedText(value: string) {
  return String(value || '')
    .replace(/^\s*\[BR\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function translateImportPayload({
  title,
  description,
  rules,
  outcomes,
}: {
  title: string
  description: string
  rules: string
  outcomes: string[]
}) {
  const fields = [title, description, rules, ...outcomes].map(sanitizeImportedText)
  const translated = await translateTexts(fields, 'Portuguese (Brazil)')

  return {
    title: sanitizeImportedText(translated[0] || title),
    description: sanitizeImportedText(translated[1] || description),
    rules: sanitizeImportedText(translated[2] || rules),
    outcomes: outcomes.map((outcome, idx) => sanitizeImportedText(translated[idx + 3] || outcome)),
  }
}

export async function importExternalMarket(params: ImportMarketParams) {
  try {
    const { polyId, conditionId, title, description, image, volume, volume_24h, endDate, rules, outcomes } = params

    if (!polyId) {
      return { success: false, error: 'ID do mercado é obrigatório' }
    }

    const translatedPayload = await translateImportPayload({
      title: title || 'Sem título',
      description: description || '',
      rules: rules || description || '',
      outcomes: outcomes.map(outcome => String(outcome.text || '')),
    })

    let marketId = `poly-${polyId}`
    let alreadyExists = false

    if (conditionId) {
      const existingByCondition = await db
        .select({ id: mercadosLive.id })
        .from(mercadosLive)
        .where(eq(mercadosLive.polymarket_condition_id, String(conditionId)))
        .limit(1)

      if (existingByCondition[0]?.id) {
        marketId = existingByCondition[0].id
        alreadyExists = true
      }
    }

    const opcoesObj: Record<string, any> = {}
    outcomes.forEach((oc, idx) => {
      opcoesObj[`op_${idx}`] = {
        text: translatedPayload.outcomes[idx] || sanitizeImportedText(String(oc.text || '')),
        tokenId: String(oc.tokenId || `${marketId}-${idx}`),
        price: Number(oc.price) || 0,
      }
    })

    const marketData = {
      id: marketId,
      titulo: translatedPayload.title.substring(0, 255),
      descricao: translatedPayload.description,
      camera_url: String(image || ''),
      status: 'AO_VIVO',
      tipo_contagem: 'OUTRO' as const,
      opcoes: opcoesObj,
      total_sim: outcomes[0] ? String(Math.floor(Number(outcomes[0].price) * 100000)) : '50000',
      total_nao: outcomes[1] ? String(Math.floor(Number(outcomes[1].price) * 100000)) : '50000',
      volume: String(volume || '0'),
      volume_24h: String(volume_24h || '0'),
      market_origin: 'polymarket' as const,
      polymarket_condition_id: conditionId ? String(conditionId) : null,
      polymarket_last_prob: outcomes[0] ? String(Number(outcomes[0].price) || 0) : null,
      polymarket_last_sync: new Date(),
      end_date: endDate ? new Date(endDate).toISOString() : null,
      rules: translatedPayload.rules,
      updated_at: new Date(),
    }

    await db.insert(mercadosLive).values(marketData).onConflictDoUpdate({
      target: mercadosLive.id,
      set: marketData,
    })

    revalidatePath('/')
    revalidatePath('/admin/mercado-hype')

    return {
      success: true,
      id: marketId,
      slug: `live_${marketId}`,
      alreadyExists,
    }
  }
  catch (error: any) {
    console.error('[IMPORT_MARKET_DB_ERROR]', error)
    return { success: false, error: 'Falha ao salvar no banco. Verifique os dados.' }
  }
}
