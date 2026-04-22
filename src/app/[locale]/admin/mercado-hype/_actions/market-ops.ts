'use server'

import { desc, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { translateTexts } from '@/lib/ai/translate'
import { auth } from '@/lib/auth'
import { mercadoBets, mercadosLive, mercadoTransactions } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'
import { resolveMercadoLive } from '@/lib/mercado-payout'

function sanitizeImportedText(value: string) {
  return String(value || '')
    .replace(/^\s*\[BR\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractClobTokenIds(market: any): string[] {
  try {
    const raw = market?.clobTokenIds
    if (!raw) {
      return []
    }
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed.map(String) : []
  }
  catch {
    return []
  }
}

function parseOutcomePrices(raw: unknown): string[] {
  try {
    if (Array.isArray(raw)) {
      return raw.map(value => String(value))
    }
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map(value => String(value)) : []
    }
  }
  catch {
    return []
  }
  return []
}

function parseOutcomes(raw: unknown): string[] {
  try {
    if (Array.isArray(raw)) {
      return raw.map(value => String(value))
    }
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map(value => String(value)) : []
    }
  }
  catch {
    return []
  }
  return []
}

function parsePolymarketEvent(polyId: string, event: any) {
  const markets = Array.isArray(event?.markets) ? event.markets : []
  const primaryMarket = markets[0] ?? {}
  const conditionId = String(
    primaryMarket.conditionId
    || primaryMarket.condition_id
    || event?.conditionId
    || event?.condition_id
    || '',
  ).trim() || null

  if (markets.length > 1) {
    return {
      polyId,
      conditionId,
      title: sanitizeImportedText(String(event?.title || event?.question || 'Sem titulo')),
      description: sanitizeImportedText(String(event?.description || primaryMarket?.description || '')),
      image: String(event?.image || event?.icon || primaryMarket?.image || primaryMarket?.icon || ''),
      volume: String(event?.volume || primaryMarket?.volume || '0'),
      volume_24h: String(event?.volume24h || event?.volume1wk || primaryMarket?.volume24h || '0'),
      endDate: event?.endDate || primaryMarket?.endDate || null,
      rules: sanitizeImportedText(String(event?.description || primaryMarket?.description || '')),
      outcomes: markets.map((market: any, index: number) => {
        const marketPrices = parseOutcomePrices(market?.outcomePrices)
        const tokenIds = extractClobTokenIds(market)
        return {
          text: sanitizeImportedText(String(market?.groupItemTitle || market?.question || market?.title || `Opcao ${index + 1}`)),
          price: Number(marketPrices[0] || 0),
          tokenId: tokenIds[0] || undefined,
        }
      }),
    }
  }

  const outcomePrices = parseOutcomePrices(primaryMarket?.outcomePrices)
  const outcomes = parseOutcomes(primaryMarket?.outcomes)
  const tokenIds = extractClobTokenIds(primaryMarket)

  return {
    polyId,
    conditionId,
    title: sanitizeImportedText(String(event?.title || event?.question || primaryMarket?.question || 'Sem titulo')),
    description: sanitizeImportedText(String(event?.description || primaryMarket?.description || '')),
    image: String(event?.image || event?.icon || primaryMarket?.image || primaryMarket?.icon || ''),
    volume: String(event?.volume || primaryMarket?.volume || '0'),
    volume_24h: String(event?.volume24h || event?.volume1wk || primaryMarket?.volume24h || '0'),
    endDate: event?.endDate || primaryMarket?.endDate || null,
    rules: sanitizeImportedText(String(event?.description || primaryMarket?.description || '')),
    outcomes: (outcomes.length ? outcomes : ['Sim', 'Nao']).map((outcome, index) => ({
      text: sanitizeImportedText(outcome),
      price: Number(outcomePrices[index] || 0),
      tokenId: tokenIds[index] || undefined,
    })),
  }
}

async function ensureAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  const user = session?.user as any
  if (!user?.is_admin) {
    throw new Error('Acesso negado')
  }

  return user
}

async function fetchPolymarketEvent(polyId: string) {
  const response = await fetch(`https://gamma-api.polymarket.com/events/${polyId}`, {
    cache: 'no-store',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'MercadoFacilAdmin/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Polymarket retornou ${response.status}`)
  }

  return await response.json()
}

async function syncMarketRowFromPolymarket(marketId: string, reimportContent: boolean) {
  const [market] = await db
    .select()
    .from(mercadosLive)
    .where(eq(mercadosLive.id, marketId))
    .limit(1)

  if (!market) {
    throw new Error('Mercado nao encontrado')
  }

  if (market.market_origin !== 'polymarket') {
    throw new Error('Somente mercados importados da Polymarket podem ser sincronizados')
  }

  const polyId = market.id.startsWith('poly-') ? market.id.slice(5) : market.id
  if (!polyId) {
    throw new Error('Nao foi possivel identificar o mercado original na Polymarket')
  }

  const rawEvent = await fetchPolymarketEvent(polyId)
  const parsed = parsePolymarketEvent(polyId, rawEvent)

  let translatedTitle = market.titulo
  let translatedDescription = market.descricao || ''
  let translatedOutcomes = parsed.outcomes.map(outcome => outcome.text)

  if (reimportContent) {
    const translated = await translateTexts(
      [parsed.title, parsed.description, parsed.rules, ...parsed.outcomes.map(outcome => outcome.text)],
      'Portuguese (Brazil)',
    )

    translatedTitle = sanitizeImportedText(translated[0] || parsed.title)
    translatedDescription = sanitizeImportedText(translated[1] || parsed.description)
    translatedOutcomes = parsed.outcomes.map((outcome, index) => sanitizeImportedText(translated[index + 3] || outcome.text))
  }
  else {
    const currentOptions = (market.opcoes && typeof market.opcoes === 'object') ? market.opcoes as Record<string, any> : {}
    translatedOutcomes = parsed.outcomes.map((outcome, index) => {
      const existing = currentOptions[`op_${index}`]
      return sanitizeImportedText(String(existing?.text || outcome.text))
    })
  }

  const nextOptions = Object.fromEntries(
    parsed.outcomes.map((outcome, index) => [
      `op_${index}`,
      {
        text: translatedOutcomes[index] || outcome.text,
        tokenId: outcome.tokenId || `${market.id}-${index}`,
        price: Number(outcome.price || 0),
      },
    ]),
  )

  await db
    .update(mercadosLive)
    .set({
      titulo: translatedTitle,
      descricao: translatedDescription,
      opcoes: nextOptions,
      volume: String(parsed.volume || market.volume || '0'),
      volume_24h: String(parsed.volume_24h || market.volume_24h || '0'),
      camera_url: parsed.image || market.camera_url,
      polymarket_condition_id: parsed.conditionId || market.polymarket_condition_id,
      polymarket_last_prob: parsed.outcomes[0] ? String(Number(parsed.outcomes[0].price || 0)) : market.polymarket_last_prob,
      polymarket_last_sync: new Date(),
      updated_at: new Date(),
    })
    .where(eq(mercadosLive.id, market.id))

  revalidatePath('/admin/mercado-hype')
  revalidatePath('/')
  revalidatePath(`/event/live_${market.id}`)
}

export async function getPublishedMercadoOperationsAction() {
  const published = await db
    .select()
    .from(mercadosLive)
    .orderBy(desc(mercadosLive.updated_at), desc(mercadosLive.created_at))

  if (published.length === 0) {
    return { success: true, data: [] }
  }

  const marketIds = published.map(market => market.id)
  const bets = await db
    .select()
    .from(mercadoBets)
    .where(inArray(mercadoBets.live_id, marketIds))

  const betIds = bets.map(bet => bet.id)
  const transactions = betIds.length
    ? await db
        .select()
        .from(mercadoTransactions)
        .where(inArray(mercadoTransactions.referencia_externa, betIds))
    : []

  const data = published.map((market) => {
    const marketBets = bets
      .filter(bet => bet.live_id === market.id)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

    const marketBetIds = new Set(marketBets.map(bet => bet.id))
    const marketAudit = transactions
      .filter(transaction => transaction.referencia_externa && marketBetIds.has(transaction.referencia_externa))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

    const totalApostado = marketBets.reduce((sum, bet) => sum + Number(bet.valor || 0), 0)
    const totalGarantido = marketBets.reduce((sum, bet) => sum + Number(bet.payout_garantido || 0), 0)
    const recentBets = marketBets.slice(0, 5).map(bet => ({
      id: bet.id,
      userId: bet.user_id,
      opcao: bet.opcao,
      valor: Number(bet.valor || 0),
      payoutGarantido: Number(bet.payout_garantido || 0),
      status: bet.status,
      createdAt: bet.created_at,
    }))
    const recentAudit = marketAudit.slice(0, 6).map(entry => ({
      id: entry.id,
      userId: entry.user_id,
      tipo: entry.tipo,
      valor: Number(entry.valor || 0),
      status: entry.status,
      createdAt: entry.created_at,
    }))

    return {
      ...market,
      totalApostado,
      totalGarantido,
      betCount: marketBets.length,
      recentBets,
      recentAudit,
    }
  })

  return { success: true, data }
}

export async function syncPublishedMercadoAction(marketId: string) {
  try {
    await ensureAdmin()
    await syncMarketRowFromPolymarket(marketId, false)
    return { success: true }
  }
  catch (error: any) {
    return { success: false, error: error.message || 'Falha ao sincronizar mercado' }
  }
}

export async function reimportPublishedMercadoAction(marketId: string) {
  try {
    await ensureAdmin()
    await syncMarketRowFromPolymarket(marketId, true)
    return { success: true }
  }
  catch (error: any) {
    return { success: false, error: error.message || 'Falha ao reimportar mercado' }
  }
}

export async function resolvePublishedMercadoAction(marketId: string, winner: 'SIM' | 'NAO') {
  try {
    await ensureAdmin()
    const result = await resolveMercadoLive(marketId, winner)
    revalidatePath('/admin/mercado-hype')
    revalidatePath('/')
    revalidatePath(`/event/live_${marketId}`)
    return { success: true, data: result }
  }
  catch (error: any) {
    return { success: false, error: error.message || 'Falha ao resolver mercado' }
  }
}
