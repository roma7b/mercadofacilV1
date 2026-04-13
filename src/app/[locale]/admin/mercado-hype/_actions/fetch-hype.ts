'use server'

import fs from 'node:fs'
import path from 'node:path'
import { desc } from 'drizzle-orm'
import { translateTexts } from '@/lib/ai/translate'
import { mercadosLive } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'
import { deleteEventAction } from '../../events/_actions/delete-event'

const POLYMARKET_GAMMA_API = 'https://gamma-api.polymarket.com'

// Cache em disco: persiste entre hot-reloads
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
    if (!fs.existsSync(filePath)) { return null }
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed: DiskCache = JSON.parse(raw)
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) { return parsed }
    return null
  }
  catch { return null }
}

function writeDiskCache(filePath: string, data: PolyHypeItem[]) {
  try {
    ensureCacheDir()
    fs.writeFileSync(filePath, JSON.stringify({ timestamp: Date.now(), data }, null, 2), 'utf-8')
  }
  catch (err) {
    console.error('[CACHE_WRITE_ERROR]', err)
  }
}

export interface PolyHypeItem {
  id: string
  question: string
  description: string
  image: string
  volume: string
  volume_24h?: string
  outcomePrices: string[]
  outcomes: string[]
  outcomesTokens: string[] // clobTokenIds reais da Polymarket
  active: boolean
  endDate: string | null
  rules?: string
}

/**
 * Extrai os clobTokenIds reais da Polymarket de um market.
 * Para mercados binários: vem no campo `clobTokenIds` como JSON string.
 * Para mercados categóricos (multi-outcome): cada market tem seu próprio clobTokenIds.
 */
function extractClobTokenIds(market: any): string[] {
  try {
    const raw = market.clobTokenIds
    if (!raw) { return [] }
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(parsed)) { return parsed.map(String) }
  }
  catch { /* silencioso */ }
  return []
}

function mapEvent(item: any): PolyHypeItem {
  let prices: string[] = []
  let outcomesArr: string[] = []
  let outcomesTokens: string[] = []
  const ms = item.markets || []

  if (ms.length > 1) {
    // Multi-market: cada market é uma "opção" (ex: eleições com candidatos)
    outcomesArr = ms.map((m: any) => m.groupItemTitle || m.question || m.title || 'Opção')
    prices = ms.map((m: any) => {
      try {
        const ps = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices
        return String(Array.isArray(ps) ? ps[0] : '0.5')
      }
      catch { return '0.5' }
    })
    // Para multi-market, o token YES de cada sub-mercado é o primeiro clobTokenId
    outcomesTokens = ms.map((m: any) => {
      const tokens = extractClobTokenIds(m)
      return tokens[0] || ''
    })
  }
  else {
    // Mercado único (binary ou categorical)
    const activeMarket = ms[0] || {}

    // Extrair preços
    try {
      const p = activeMarket.outcomePrices
      if (p) {
        const parsed = typeof p === 'string' ? JSON.parse(p) : p
        prices = Array.isArray(parsed) ? parsed.map(String) : ['0.5', '0.5']
      }
    }
    catch { prices = ['0.5', '0.5'] }

    // Extrair nomes dos outcomes
    try {
      const o = activeMarket.outcomes
      if (o) {
        const parsed = typeof o === 'string' ? JSON.parse(o) : o
        outcomesArr = Array.isArray(parsed) ? parsed.map(String) : ['Sim', 'Não']
      }
    }
    catch { outcomesArr = ['Sim', 'Não'] }

    // Extrair clobTokenIds reais (campo mais importante para o gráfico!)
    outcomesTokens = extractClobTokenIds(activeMarket)
  }

  // Fallbacks seguros
  if (outcomesArr.length === 0) { outcomesArr = ['Sim', 'Não'] }
  if (prices.length === 0) { prices = outcomesArr.map(() => '0.5') }
  if (outcomesTokens.length === 0) { outcomesTokens = outcomesArr.map(() => '') }

  return {
    id: item.id || String(Math.random()),
    question: item.title || item.question || 'Sem título',
    description: item.description || ms[0]?.description || '',
    image: item.image || item.icon || ms[0]?.image || ms[0]?.icon || '',
    volume: String(item.volume || ms[0]?.volume || '0'),
    volume_24h: String(item.volume24h || item.volume1wk || ms[0]?.volume24h || '0'),
    outcomePrices: prices.map(String),
    outcomes: outcomesArr.map(String),
    outcomesTokens: outcomesTokens.map(String),
    active: item.active !== false && item.closed !== true,
    endDate: item.endDate || ms[0]?.endDate || null,
    rules: item.description || ms[0]?.description || '',
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
      let i = 0
      for (const item of items) {
        item.question = translated[i++] || item.question
        item.description = translated[i++] || item.description
        for (let j = 0; j < item.outcomes.length; j++) {
          item.outcomes[j] = translated[i++] || item.outcomes[j]
        }
      }
    }
  }
  catch (err) {
    console.error('[TRANSLATE_HYPE_ERROR]', err)
  }
  return items
}

export async function getPolymarketHypeAction(limit = 40): Promise<{ success: boolean, data?: PolyHypeItem[], error?: string }> {
  try {
    const cached = readDiskCache(GLOBAL_CACHE_FILE)
    if (cached) { return { success: true, data: cached.data } }

    const url = `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&limit=${limit}`
    const res = await fetch(url, { cache: 'no-store', headers: { 'Accept': 'application/json', 'User-Agent': 'KuestBot/1.0' } })
    if (!res.ok) { throw new Error(`Polymarket API ${res.status}`) }

    const data = await res.json()
    if (!Array.isArray(data)) { return { success: true, data: [] } }

    let mappedData = data.map(mapEvent)
    mappedData = await translateHypeItems(mappedData)
    writeDiskCache(GLOBAL_CACHE_FILE, mappedData)
    return { success: true, data: mappedData }
  }
  catch (error: any) {
    console.error('[FETCH_HYPE_ERROR]', error.message)
    return { success: false, error: error.message }
  }
}

export async function getBrazillianHypeAction(limit = 30): Promise<{ success: boolean, data?: PolyHypeItem[], error?: string }> {
  try {
    const cached = readDiskCache(BRAZIL_CACHE_FILE)
    if (cached) { return { success: true, data: cached.data } }

    const keywords = ['Brazil', 'Lula', 'Bolsonaro', 'Neymar', 'Petrobras', 'Selic', 'STF']
    const allResults: any[] = []

    for (const keyword of keywords) {
      try {
        const url = `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&search=${encodeURIComponent(keyword)}&limit=20`
        const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) { allResults.push(...data) }
        }
      }
      catch { /* ignora */ }
    }

    const unique = Array.from(new Map(allResults.map(m => [m.id, m])).values())
    let mappedData = unique.slice(0, limit).map(mapEvent)
    mappedData = await translateHypeItems(mappedData)
    writeDiskCache(BRAZIL_CACHE_FILE, mappedData)
    return { success: true, data: mappedData }
  }
  catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getPublishedMercadosAction() {
  try {
    const data = await db.select().from(mercadosLive).orderBy(desc(mercadosLive.id))
    return { success: true, data }
  }
  catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteMercadoAction(id: string) {
  return await deleteEventAction(id)
}
