'use client'

import type { Event, Market } from '@/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

export const TIME_RANGES = [
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '1d', value: '1d' },
  { label: '1w', value: '1w' },
  { label: '1m', value: '1m' },
  { label: 'Tudo', value: 'all' },
] as const

export function buildMarketTargets(markets: Market[] = [], outcomeIndex: number = 0) {
  if (!Array.isArray(markets)) { return [] }
  return markets
    .map(m => ({ conditionId: m.condition_id, tokenId: m.outcomes?.[outcomeIndex]?.token_id }))
    .filter(t => t.tokenId)
}

export interface MarketTokenTarget {
  conditionId: string
  tokenId: string
}

export interface PriceHistoryPoint {
  t: number // timestamp em segundos
  p: number // preço entre 0 e 1
  v?: number // volume (opcional)
}

export type PriceHistoryByMarket = Record<string, PriceHistoryPoint[]>

export interface NormalizedHistoryResult {
  points: Array<Record<string, number | Date> & { date: Date }>
  latestSnapshot: Record<string, number>
  latestRawPrices: Record<string, number>
  latestVolumes: Record<string, number>
}

export type TimeRange = '1h' | '6h' | '1d' | '1w' | '1m' | 'all'

interface RangeFilters {
  fidelity: string
  startTs: string
  endTs: string
}

function buildTimeRangeFilters(range: TimeRange, eventCreatedAt: string): RangeFilters {
  const now = new Date()
  const nowSeconds = Math.floor(now.getTime() / 1000)
  let startSeconds: number
  let fidelity = 60 // 1 min default

  switch (range) {
    case '1h':
      startSeconds = nowSeconds - 3600
      fidelity = 1
      break
    case '6h':
      startSeconds = nowSeconds - 6 * 3600
      fidelity = 5
      break
    case '1d':
      startSeconds = nowSeconds - 86400
      fidelity = 15
      break
    case '1w':
      startSeconds = nowSeconds - 7 * 86400
      fidelity = 60
      break
    case '1m':
      startSeconds = nowSeconds - 30 * 86400
      fidelity = 360
      break
    default:
      // Para "Tudo": busca 1 ano atrás para pegar histórico de mercados Polymarket
      startSeconds = nowSeconds - 365 * 86400
      fidelity = 720
  }

  return {
    fidelity: fidelity.toString(),
    startTs: startSeconds.toString(),
    endTs: nowSeconds.toString(),
  }
}

export function buildNormalizedHistory(historyByMarket: PriceHistoryByMarket = {}): NormalizedHistoryResult {
  const timeline = new Map<number, Map<string, { p: number, v: number }>>()

  if (historyByMarket && typeof historyByMarket === 'object') {
    Object.entries(historyByMarket).forEach(([id, history]) => {
      if (Array.isArray(history)) {
        history.forEach((point) => {
          if (point && typeof point.t === 'number') {
            const timestampMs = Math.floor(point.t) * 1000
            if (!timeline.has(timestampMs)) {
              timeline.set(timestampMs, new Map())
            }
            timeline.get(timestampMs)!.set(id, { p: point.p ?? 0.5, v: point.v ?? 0 })
          }
        })
      }
    })
  }

  const sortedTimestamps = Array.from(timeline.keys()).sort((a, b) => a - b)
  const lastKnownPrice = new Map<string, number>()
  const points: NormalizedHistoryResult['points'] = []
  const latestRawPrices: Record<string, number> = {}
  const latestVolumes: Record<string, number> = {}

  sortedTimestamps.forEach((timestamp) => {
    const updates = timeline.get(timestamp)
    updates?.forEach((data, id) => {
      lastKnownPrice.set(id, data.p)
    })

    if (!lastKnownPrice.size) { return }

    const point: Record<string, number | Date> & { date: Date } = { date: new Date(timestamp) }
    lastKnownPrice.forEach((price, id) => {
      latestRawPrices[id] = price
      point[id] = price * 100

      const updateData = updates?.get(id)
      if (updateData) {
        point[`${id}-volume`] = updateData.v
        latestVolumes[id] = updateData.v
      }
      else {
        point[`${id}-volume`] = 0
      }
    })
    points.push(point)
  })

  const latestSnapshot: Record<string, number> = {}
  const latestPoint = points.at(-1)
  if (latestPoint) {
    Object.entries(latestPoint).forEach(([key, value]) => {
      if (key !== 'date' && !key.endsWith('-volume') && typeof value === 'number') {
        latestSnapshot[key] = value
      }
    })
  }

  return { points, latestSnapshot, latestRawPrices, latestVolumes }
}

interface UseEventPriceHistoryOptions {
  event: Event
  eventId?: string
  range: TimeRange
  targets?: { conditionId: string, tokenId: string }[]
  eventCreatedAt?: string
  eventResolvedAt?: string | null
}

export function useEventPriceHistory({
  event,
  range = '1d',
  targets: providedTargets,
  eventCreatedAt: providedCreatedAt,
}: UseEventPriceHistoryOptions) {
  const eventId = event?.id
  const eventCreatedAt = providedCreatedAt || event?.created_at || new Date().toISOString()
  const markets = event?.markets || []

  const { data, isLoading } = useQuery({
    queryKey: ['event-price-history', eventId, range],
    queryFn: async () => {
      if (!eventId || !markets.length) { return {} }

      const targets: { key: string, tokenId: string }[] = []

      markets.forEach((m) => {
        if (m.outcomes && m.outcomes.length > 2) {
          // Categorical market: fetch top 10 outcomes by default or all if reasonable
          m.outcomes.slice(0, 10).forEach((o) => {
            if (o.token_id) {
              targets.push({ key: o.token_id, tokenId: o.token_id })
            }
          })
        }
        else {
          // Binary market: just fetch the first outcome (YES)
          if (m.outcomes?.[0]?.token_id) {
            targets.push({ key: m.condition_id, tokenId: m.outcomes[0].token_id })
          }
        }
      })

      if (targets.length === 0) { return {} }

      const filters = buildTimeRangeFilters(range, eventCreatedAt)
      const results: PriceHistoryByMarket = {}

      await Promise.all(targets.map(async (target) => {
        try {
          // Usamos prices-history via proxy local (sem CORS). Formato: {history: [{t, p}]}
          const url = `/api/clob/prices-history?market=${target.tokenId}&fidelity=${filters.fidelity}&startTs=${filters.startTs}`
          const res = await fetch(url)
          if (res.ok) {
            const json = await res.json()
            // prices-history retorna { history: [{t, p},...] }
            if (json?.history && Array.isArray(json.history)) {
              results[target.key] = json.history
            }
            // Fallback: se vier array diretamente (formato OHLC não suportado, mas caso futuro)
            else if (Array.isArray(json)) {
              results[target.key] = json.map((p: any) => ({
                t: p[0],
                p: p[4], // close price
                v: p[5], // volume
              }))
            }
          }
        }
        catch (e) {
          console.error('[PriceHistory] Fetch error:', e)
        }
      }))

      return results
    },
    enabled: !!eventId,
    staleTime: 60000,
  })

  return useMemo(() => {
    let historyByMarket = data ?? {}
    let normalized = buildNormalizedHistory(historyByMarket)

    if (normalized.points.length === 0 && markets.length > 0) {
      const simulated: PriceHistoryByMarket = {}
      const now = Date.now()
      const startMs = new Date(eventCreatedAt).getTime() || (now - 86400000)
      const totalSpan = now - startMs
      const steps = 100

      const keysToSimulate: string[] = []
      markets.forEach((market) => {
        if (market.outcomes && market.outcomes.length > 2) {
          market.outcomes.slice(0, 10).forEach((o) => {
            if (o.token_id) { keysToSimulate.push(o.token_id) }
          })
        }
        else {
          const key = market.condition_id
          if (key) { keysToSimulate.push(key) }
        }
      })

      keysToSimulate.forEach((key) => {
        const points: PriceHistoryPoint[] = []
        let lastP = 0.45 + (Math.random() * 0.1)

        for (let i = 0; i <= steps; i++) {
          const t = Math.floor((startMs + (totalSpan * (i / steps))) / 1000)
          lastP = Math.max(0.05, Math.min(0.95, lastP + (Math.random() * 0.04 - 0.02)))
          const v = Math.random() > 0.7 ? Math.random() * 1000 : 0
          points.push({ t, p: lastP, v })
        }
        simulated[key] = points
      })
      normalized = buildNormalizedHistory(simulated)
    }

    return {
      ...normalized,
      isLoading,
    }
  }, [data, isLoading, eventCreatedAt, markets])
}
