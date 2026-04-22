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
const REQUEST_TIMEOUT_MS = 12000
const GLOBAL_CACHE_VERSION = 2
const BRAZIL_CACHE_VERSION = 3

interface DiskCache {
  timestamp: number
  version?: number
  data: PolyHypeItem[]
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

function readDiskCache(filePath: string, expectedVersion: number): DiskCache | null {
  try {
    if (!fs.existsSync(filePath)) { return null }
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed: DiskCache = JSON.parse(raw)
    if (parsed.version !== expectedVersion) { return null }
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) { return parsed }
    return null
  }
  catch { return null }
}

function writeDiskCache(filePath: string, data: PolyHypeItem[], version: number) {
  try {
    ensureCacheDir()
    fs.writeFileSync(filePath, JSON.stringify({ timestamp: Date.now(), version, data }, null, 2), 'utf-8')
  }
  catch (err) {
    console.error('[CACHE_WRITE_ERROR]', err)
  }
}

async function fetchGammaJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'KuestBot/1.0',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Polymarket API ${response.status}`)
  }

  return await response.json() as T
}

export interface PolyHypeItem {
  id: string
  conditionId?: string | null
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
  const primaryMarket = ms[0] || {}
  const conditionId = String(
    primaryMarket.conditionId
    || primaryMarket.condition_id
    || item.conditionId
    || item.condition_id
    || '',
  ).trim() || null

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
    conditionId,
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

function scoreBrazilRelevance(item: any) {
  const text = [
    item.title,
    item.question,
    item.description,
    ...(Array.isArray(item.tags) ? item.tags.map((tag: any) => tag?.slug || tag?.label || tag?.name || '') : []),
  ].join(' ').toLowerCase()

  let score = 0

  if (text.includes('brazil') || text.includes('brasil')) { score += 8 }
  if (text.includes('lula')) { score += 6 }
  if (text.includes('bolsonaro')) { score += 6 }
  if (text.includes('petrobras')) { score += 5 }
  if (text.includes('selic')) { score += 5 }
  if (text.includes('copom')) { score += 5 }
  if (text.includes('stf')) { score += 4 }
  if (text.includes('neymar')) { score += 4 }
  if (text.includes('banco do brasil')) { score += 4 }
  if (text.includes('president')) { score += 1 }
  if (text.includes('election')) { score += 1 }

  return score
}

export async function getPolymarketHypeAction(limit = 40): Promise<{ success: boolean, data?: PolyHypeItem[], error?: string }> {
  try {
    const cached = readDiskCache(GLOBAL_CACHE_FILE, GLOBAL_CACHE_VERSION)
    if (cached) { return { success: true, data: cached.data } }

    const url = `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&order=volume&ascending=false&limit=${limit}`
    const data = await fetchGammaJson<any[]>(url)
    if (!Array.isArray(data)) { return { success: true, data: [] } }

    let mappedData = data.map(mapEvent)
    mappedData = await translateHypeItems(mappedData)
    writeDiskCache(GLOBAL_CACHE_FILE, mappedData, GLOBAL_CACHE_VERSION)
    return { success: true, data: mappedData }
  }
  catch (error: any) {
    console.error('[FETCH_HYPE_ERROR]', error.message)
    return { success: false, error: error.message }
  }
}

export async function getBrazillianHypeAction(limit = 30): Promise<{ success: boolean, data?: PolyHypeItem[], error?: string }> {
  try {
    const cached = readDiskCache(BRAZIL_CACHE_FILE, BRAZIL_CACHE_VERSION)
    if (cached) { return { success: true, data: cached.data } }

    const brazilTag = await fetchGammaJson<{ id: string }>(`${POLYMARKET_GAMMA_API}/tags/slug/brazil`)
    const relatedUrl = `${POLYMARKET_GAMMA_API}/events?tag_id=${encodeURIComponent(brazilTag.id)}&related_tags=true&active=true&closed=false&order=volume&ascending=false&limit=${Math.max(limit, 60)}`
    const keywordUrls = [
      `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&search=Brazil&order=volume&ascending=false&limit=20`,
      `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&search=Brasil&order=volume&ascending=false&limit=20`,
      `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&search=Lula&order=volume&ascending=false&limit=20`,
      `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&search=Bolsonaro&order=volume&ascending=false&limit=20`,
      `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&search=Petrobras&order=volume&ascending=false&limit=20`,
      `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&search=Selic&order=volume&ascending=false&limit=20`,
      `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&search=STF&order=volume&ascending=false&limit=20`,
      `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&search=Neymar&order=volume&ascending=false&limit=20`,
    ]

    const responses = await Promise.allSettled([
      fetchGammaJson<any[]>(relatedUrl),
      ...keywordUrls.map(url => fetchGammaJson<any[]>(url)),
    ])

    const allResults = responses.flatMap((result) => {
      if (result.status !== 'fulfilled' || !Array.isArray(result.value)) {
        return []
      }
      return result.value
    })

    const unique = Array.from(new Map(allResults.map(m => [m.id, m])).values())
    const ranked = unique
      .map(item => ({ item, score: scoreBrazilRelevance(item) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || Number(b.item.volume || 0) - Number(a.item.volume || 0))
      .map(({ item }) => item)

    let mappedData = ranked.slice(0, limit).map(mapEvent)
    mappedData = await translateHypeItems(mappedData)
    writeDiskCache(BRAZIL_CACHE_FILE, mappedData, BRAZIL_CACHE_VERSION)
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
