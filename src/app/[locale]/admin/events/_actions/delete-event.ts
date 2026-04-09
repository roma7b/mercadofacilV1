'use server'

import { db } from '@/lib/drizzle'
import { 
  events, 
  markets, 
  conditions, 
  outcomes, 
  mercadosLive 
} from '@/lib/db/schema'
import { orders } from '@/lib/db/schema/orders/tables'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function deleteEventAction(eventId: string) {
  try {
    console.log('[DELETE_EVENT_ATTEMPT]', eventId)

    // A exclusão deve ser feita com cuidado devido às chaves estrangeiras
    // Na estrutura do Kuest, remover o Evento geralmente remove mercados vinculados se estiver em CASCADE no banco
    // Mas vamos garantir a limpeza manual das 5 tabelas se necessário

    // 0. Limpar do motor Mercado Fácil (Hype Terminal) e suas apostas primeiro
    // (O cascade no banco deve cuidar disso, mas vamos garantir)
    await db.delete(mercadosLive).where(eq(mercadosLive.id, eventId))

    // 1. Buscar mercados vinculados para uma limpeza profunda
    const eventMarkets = await db.select().from(markets).where(eq(markets.event_id, eventId))
    
    for (const market of eventMarkets) {
      const conditionId = market.condition_id
      if (conditionId) {
        // Limpeza Manual em ordem hierárquica reversa para evitar erros de FK
        await db.delete(orders).where(eq(orders.condition_id, conditionId))
        await db.delete(outcomes).where(eq(outcomes.condition_id, conditionId))
        await db.delete(markets).where(eq(markets.condition_id, conditionId))
        await db.delete(conditions).where(eq(conditions.id, conditionId))
      }
    }

    // 3. Remover o registro do Evento final
    await db.delete(events).where(eq(events.id, eventId))

    console.log('[DELETE_EVENT_SUCCESS]', eventId)
    revalidatePath('/admin/events')
    return { success: true }

  } catch (error: any) {
    console.error('[DELETE_EVENT_ERROR]', error)
    return { success: false, error: error.message }
  }
}
