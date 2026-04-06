const POLYMARKET_GAMMA_API = 'https://gamma-api.polymarket.com'

export interface PolymarketMarket {
  id: string
  question: string
  description: string
  image: string
  group_id: string
  volume: string
  active: boolean
  closed: boolean
  icon?: string
}

/**
 * Busca mercados em destaque (por volume) na Polymarket
 */
export async function fetchPolymarketHype(limit = 15): Promise<PolymarketMarket[]> {
  const url = `${POLYMARKET_GAMMA_API}/markets?active=true&closed=false&order=volume&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch from Polymarket')
  return res.json()
}

/**
 * Busca mercados que mencionam o Brasil ou temas relacionados
 */
export async function fetchBrazillianHype(limit = 10): Promise<PolymarketMarket[]> {
  const keywords = ['Brazil', 'Lula', 'Bolsonaro', 'Neymar', 'Real', 'Sao Paulo', 'Rio de Janeiro']
  const allResults: PolymarketMarket[] = []

  for (const keyword of keywords) {
    try {
      const url = `${POLYMARKET_GAMMA_API}/markets?active=true&closed=false&search=${keyword}&limit=5`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json() as PolymarketMarket[]
        allResults.push(...data)
      }
    } catch (e) {
      console.warn(`Failed to fetch keyword: ${keyword}`)
    }
  }

  // Remover duplicados e limitar
  const unique = Array.from(new Map(allResults.map(m => [m.id, m])).values())
  return unique.slice(0, limit)
}
/**
 * Busca odds atuais (preços Yes/No) e volume total de um mercado específico via Gamma API.
 */
export async function fetchPolymarketOdds(conditionId: string): Promise<{ yes: number; no: number; volume: number; success: boolean }> {
  try {
    const url = `${POLYMARKET_GAMMA_API}/markets?condition_id=${conditionId}`
    const res = await fetch(url)
    if (!res.ok) return { yes: 0.5, no: 0.5, volume: 0, success: false }
    
    const data = await res.json() as any[]
    if (data.length > 0) {
      const m = data[0]
      return {
        yes: Number(m.outcomePrices?.[0]) || 0.5,
        no: Number(m.outcomePrices?.[1]) || 0.5,
        volume: Number(m.volume) || 0,
        success: true
      }
    }
    return { yes: 0.5, no: 0.5, volume: 0, success: false }
  } catch (e) {
    return { yes: 0.5, no: 0.5, volume: 0, success: false }
  }
}
