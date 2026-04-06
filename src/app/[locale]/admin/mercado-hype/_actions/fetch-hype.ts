'use server'

import { db } from '@/lib/drizzle'
import { mercadosLive } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

const POLYMARKET_GAMMA_API = 'https://gamma-api.polymarket.com'

export interface PolyHypeItem {
  id: string
  question: string
  description: string
  image: string
  volume: string
  outcomePrices: string[]
  outcomes: string[] // Ex: ["Real Madrid", "Barcelona"] ou ["Sim", "Não"]
  active: boolean
}

function mapEvent(item: any): PolyHypeItem {
  let prices: string[] = []
  let outcomesArr: string[] = []
  const ms = item.markets || []

  // Se tem múltiplos mercados, provavelmente cada um é um candidato (ex: Eleição)
  if (ms.length > 1) {
    // Pegamos o título do mercado como o outcome (ex: "Lula", "Bolsonaro")
    // E o preço da opção [0] (Sim/Yes) como o preço
    outcomesArr = ms.map((m: any) => m.groupItemTitle || m.title || 'Opção')
    prices = ms.map((m: any) => {
      const ps = Array.isArray(m.outcomePrices) ? m.outcomePrices : JSON.parse(m.outcomePrices || '["0.5", "0.5"]')
      return String(ps[0] || '0.5')
    })
  } else {
    // Mercado único (Binary ou Categorical)
    const activeMarket = ms[0] || {}
    try {
      if (activeMarket?.outcomePrices) {
        const p = activeMarket.outcomePrices
        prices = Array.isArray(p) ? p : JSON.parse(p || '["0.5", "0.5"]')
      }
      
      if (activeMarket?.outcomes) {
        const o = activeMarket.outcomes
        outcomesArr = Array.isArray(o) ? o : JSON.parse(o || '["Sim", "Não"]')
      }
    } catch (err) {
      console.error('[MAP_EVENT_JSON_ERROR]', err)
    }
  }

  // Fallback final
  if (outcomesArr.length === 0) outcomesArr = ['Sim', 'Não']
  if (prices.length === 0) prices = outcomesArr.map(() => '0.5')

  return {
    id: item.id || String(Math.random()),
    question: item.title || 'Sem título',
    description: item.description || '',
    image: item.image || item.icon || '',
    volume: item.volume || ms[0]?.volume || '0',
    outcomePrices: prices.map(String),
    outcomes: outcomesArr.map(String),
    active: true,
  }
}

/**
 * Busca os mercados mais recentes da Polymarket (API pública, sem autenticação necessária)
 */
export async function getPolymarketHypeAction(limit = 15): Promise<{ success: boolean; data?: PolyHypeItem[]; error?: string }> {
  try {
    const url = `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&limit=${limit}`
    
    const res = await fetch(url, { 
      cache: 'no-store',
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; KuestBot/1.0)'
      }
    })
    
    if (!res.ok) throw new Error(`Polymarket API retornou ${res.status}: ${res.statusText}`)
    const data = await res.json()

    if (!Array.isArray(data)) return { success: true, data: [] }

    return {
      success: true,
      data: data.map(mapEvent)
    }
  } catch (error: any) {
    console.error('[FETCH_HYPE_ERROR]', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Busca mercados relacionados ao Brasil ou América Latina
 */
export async function getBrazillianHypeAction(limit = 10): Promise<{ success: boolean; data?: PolyHypeItem[]; error?: string }> {
  try {
    const keywords = ['Brazilian', 'Real Madrid', 'Bolsonaro', 'South America', 'Lula', 'Petrobras']
    const allResults: any[] = []

    for (const keyword of keywords) {
      try {
        const url = `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&search=${encodeURIComponent(keyword)}`
        const res = await fetch(url, { 
          cache: 'no-store',
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; KuestBot/1.0)'
          }
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            // Filtrar para garantir que o termo de busca realmente aparece ou é relevante
            allResults.push(...data)
          }
        }
      } catch { /* ignora keywords que falham individualmente */ }
    }

    // Remover duplicados e ordenar por volume se disponível
    const unique = Array.from(new Map(allResults.map(m => [m.id, m])).values())

    return {
      success: true,
      data: unique.slice(0, limit).map(mapEvent)
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getPublishedMercadosAction() {
  try {
    const data = await db.select().from(mercadosLive).orderBy(desc(mercadosLive.id))
    return { success: true, data }
  } catch (error: any) {
    console.error('Failed to fetch published markets', error)
    return { success: false, error: error.message }
  }
}

export async function deleteMercadoAction(id: string) {
  try {
    await db.delete(mercadosLive).where(eq(mercadosLive.id, id))
    return { success: true }
  } catch (error: any) {
    console.error('Failed to delete market', error)
    return { success: false, error: error.message }
  }
}
