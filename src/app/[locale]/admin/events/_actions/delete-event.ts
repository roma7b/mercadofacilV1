'use server'

import { db } from '@/lib/drizzle'
import { events, markets, conditions, outcomes } from '@/lib/db/schema/events/tables'
import { mercadosLive } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function deleteEventAction(eventId: string) {
  try {
    console.log('[DELETE_EVENT_ATTEMPT]', eventId)

    // A exclusão deve ser feita com cuidado devido às chaves estrangeiras
    // Na estrutura do Kuest, remover o Evento geralmente remove mercados vinculados se estiver em CASCADE no banco
    // Mas vamos garantir a limpeza manual das 5 tabelas se necessário

    // 1. Remover do Mercado Fácil
    await db.delete(mercadosLive).where(eq(mercadosLive.id, eventId))

    // 2. Buscar mercados vinculados para limpar conditions e outcomes
    const eventMarkets = await db.select().from(markets).where(eq(markets.event_id, eventId))
    
    for (const market of eventMarkets) {
      const conditionId = market.condition_id
      if (conditionId) {
        await db.delete(outcomes).where(eq(outcomes.condition_id, conditionId))
        await db.delete(markets).where(eq(markets.condition_id, conditionId))
        await db.delete(conditions).where(eq(conditions.id, conditionId))
      }
    }

    // 3. Remover o registro do Evento
    await db.delete(events).where(eq(events.id, eventId))

    console.log('[DELETE_EVENT_SUCCESS]', eventId)
    revalidatePath('/admin/events')
    return { success: true }

  } catch (error: any) {
    console.error('[DELETE_EVENT_ERROR]', error)
    return { success: false, error: error.message }
  }
}
