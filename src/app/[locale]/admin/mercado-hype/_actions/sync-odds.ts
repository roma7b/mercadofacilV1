'use server'

import { db } from '@/lib/drizzle'
import { markets, outcomes, conditions } from '@/lib/db/schema/events/tables'
import { mercadosLive } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

/**
 * Busca preços atualizados na Polymarket para mercados importados
 */
export async function syncAllHypeMarketsAction() {
  try {
    const activeConditions = await db.select()
      .from(conditions)
      .where(eq(conditions.oracle, '0x0000000000000000000000000000000000000000')) 

    if (activeConditions.length === 0) return { success: true, count: 0 }

    const url = `https://gamma-api.polymarket.com/events?limit=50&active=true`
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()

    if (!Array.isArray(data)) return { success: false, error: 'Falha ao ler API da Polymarket' }

    let updatedCount = 0

    for (const polyItem of data) {
      const match = activeConditions.find(c => c.question_id === polyItem.id)
      
      if (match && polyItem.markets && polyItem.markets.length > 0) {
        const condId = match.id
        const activeMarket = polyItem.markets.find((m: any) => !m.closed) || polyItem.markets[0]
        const prices = Array.isArray(activeMarket.outcomePrices) ? activeMarket.outcomePrices : JSON.parse(activeMarket.outcomePrices || '[]')
        
        if (prices.length >= 2) {
          for (let i = 0; i < Math.min(prices.length, 2); i++) {
            const priceVal = Number(prices[i]).toFixed(2)
            // Usamos 'as any' para contornar problemas de tipagem se o campo estiver com nome diferente temporarily
            await db.update(outcomes)
              .set({ 
                buy_price: priceVal,
                sell_price: priceVal,
                updated_at: new Date()
              } as any)
              .where(and(eq(outcomes.condition_id, condId), eq(outcomes.outcome_index, i)))
          }

          const marketRef = await db.select().from(markets).where(eq(markets.condition_id, condId)).limit(1)
          if (marketRef.length > 0) {
            await db.update(mercadosLive)
              .set({
                total_sim: Number(prices[0]).toFixed(2),
                total_nao: Number(prices[1]).toFixed(2),
              })
              .where(eq(mercadosLive.id, marketRef[0].event_id))
          }
          updatedCount++
        }
      }
    }

    revalidatePath('/', 'layout')
    return { success: true, count: updatedCount }
  } catch (error: any) {
    console.error('[SYNC_JOB_ERROR]', error)
    return { success: false, error: error.message }
  }
}

export async function syncSingleMarketAction(polyId: string) {
    try {
        const url = `https://gamma-api.polymarket.com/events/${polyId}`
        const res = await fetch(url, { cache: 'no-store' })
        const polyItem = await res.json()
        
        if (!polyItem || !polyItem.id || !polyItem.markets || polyItem.markets.length === 0) return { success: false }

        const match = await db.select().from(conditions).where(eq(conditions.question_id, polyId)).limit(1)
        if (match.length > 0) {
            const condId = match[0].id
            const activeMarket = polyItem.markets.find((m: any) => !m.closed) || polyItem.markets[0]
            const prices = Array.isArray(activeMarket.outcomePrices) ? activeMarket.outcomePrices : JSON.parse(activeMarket.outcomePrices || '[]')

            if (prices.length >= 2) {
                // Update Sim
                await db.update(outcomes).set({ buy_price: Number(prices[0]).toFixed(2), updated_at: new Date() } as any)
                   .where(and(eq(outcomes.condition_id, condId), eq(outcomes.outcome_index, 0)))
                
                // Update Nao
                await db.update(outcomes).set({ buy_price: Number(prices[1]).toFixed(2), updated_at: new Date() } as any)
                   .where(and(eq(outcomes.condition_id, condId), eq(outcomes.outcome_index, 1)))
                
                const marketRef = await db.select().from(markets).where(eq(markets.condition_id, condId)).limit(1)
                if (marketRef.length > 0) {
                    await db.update(mercadosLive).set({
                        total_sim: Number(prices[0]).toFixed(2),
                        total_nao: Number(prices[1]).toFixed(2),
                    }).where(eq(mercadosLive.id, marketRef[0].event_id))
                }
                revalidatePath('/', 'layout')
                return { success: true }
            }
        }
        return { success: false }
    } catch (err) {
        return { success: false }
    }
}
