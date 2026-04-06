'use server'

import { db } from '@/lib/drizzle'
import { mercadosLive } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { translateTexts } from '@/lib/ai/translate'
import fs from 'fs'
import path from 'path'

const POLYMARKET_GAMMA_API = 'https://gamma-api.polymarket.com'

// Cache em disco: persiste entre hot-reloads e restarts do servidor
const CACHE_DIR = path.join(process.cwd(), '.cache')
const GLOBAL_CACHE_FILE = path.join(CACHE_DIR, 'hype-global.json')
const BRAZIL_CACHE_FILE = path.join(CACHE_DIR, 'hype-brazil.json')
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 24 horas

interface DiskCache {
  timestamp: number
  data: PolyHypeItem[]
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

function readDiskCache(filePath: string): DiskCache | null {
  try {
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed: DiskCache = JSON.parse(raw)
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      return parsed
    }
    return null // expirado
  } catch {
    return null
  }
}

function writeDiskCache(filePath: string, data: PolyHypeItem[]) {
  try {
    ensureCacheDir()
    const cache: DiskCache = { timestamp: Date.now(), data }
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf-8')
  } catch (err) {
    console.error('[CACHE_WRITE_ERROR]', err)
  }
}

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

async function translateHypeItems(items: PolyHypeItem[]): Promise<PolyHypeItem[]> {
  try {
    const batchedTexts: string[] = []

    for (const item of items) {
      batchedTexts.push(item.question)
      batchedTexts.push(item.description || '')
      item.outcomes.forEach(o => batchedTexts.push(o))
    }

    const translated = await translateTexts(batchedTexts, 'Portuguese')

    if (translated.length === batchedTexts.length) {
      let currentIndex = 0
      for (const item of items) {
        item.question = translated[currentIndex++]
        item.description = translated[currentIndex++]
        for (let i = 0; i < item.outcomes.length; i++) {
          item.outcomes[i] = translated[currentIndex++]
        }
      }
    }
  } catch (err) {
    console.error('[TRANSLATE_HYPE_ERROR]', err)
  }

  return items
}

/**
 * Busca os mercados mais recentes da Polymarket.
 * Resultado fica em cache em disco por 24h — traduz só uma vez.
 */
export async function getPolymarketHypeAction(limit = 40): Promise<{ success: boolean; data?: PolyHypeItem[]; error?: string }> {
  try {
    // Tenta cache em disco primeiro
    const cached = readDiskCache(GLOBAL_CACHE_FILE)
    if (cached) {
      console.log('[HYPE_GLOBAL] Servindo do cache em disco')
      return { success: true, data: cached.data }
    }

    console.log('[HYPE_GLOBAL] Cache expirado ou ausente. Buscando e traduzindo...')
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

    let mappedData = data.map(mapEvent)
    mappedData = await translateHypeItems(mappedData)

    // Salva no disco para próximas requisições
    writeDiskCache(GLOBAL_CACHE_FILE, mappedData)

    return { success: true, data: mappedData }
  } catch (error: any) {
    console.error('[FETCH_HYPE_ERROR]', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Busca mercados relacionados ao Brasil ou América Latina.
 * Resultado fica em cache em disco por 24h — traduz só uma vez.
 */
export async function getBrazillianHypeAction(limit = 30): Promise<{ success: boolean; data?: PolyHypeItem[]; error?: string }> {
  try {
    // Tenta cache em disco primeiro
    const cached = readDiskCache(BRAZIL_CACHE_FILE)
    if (cached) {
      console.log('[HYPE_BRAZIL] Servindo do cache em disco')
      return { success: true, data: cached.data }
    }

    console.log('[HYPE_BRAZIL] Cache expirado ou ausente. Buscando e traduzindo...')

    // "Brazil" é o keyword principal — captura tudo: "Brazil Presidential", "Bank of Brazil", etc.
    const keywords = [
      'Brazil',
      'Lula',
      'Bolsonaro',
      'STF',            // Supremo Tribunal Federal
      'Selic',          // Taxa de juros
      'Neymar',
      'Petrobras',
      'Brazilian Real', // Câmbio
    ]
    const allResults: any[] = []

    for (const keyword of keywords) {
      try {
        const url = `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&search=${encodeURIComponent(keyword)}&limit=20`
        const res = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; KuestBot/1.0)'
          }
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) allResults.push(...data)
        }
      } catch { /* ignora keywords que falham individualmente */ }
    }

    // Remover duplicados
    const unique = Array.from(new Map(allResults.map(m => [m.id, m])).values())

    let mappedData = unique.slice(0, limit).map(mapEvent)
    mappedData = await translateHypeItems(mappedData)

    // Salva no disco para próximas requisições
    writeDiskCache(BRAZIL_CACHE_FILE, mappedData)

    return { success: true, data: mappedData }
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
