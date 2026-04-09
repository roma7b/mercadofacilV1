import type { MarketTokenTarget } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { normalizeClobMarketPrice } from '@/lib/clob-price'

interface PriceApiResponse {
  [tokenId: string]: { BUY?: string, SELL?: string } | undefined
}

interface MidpointApiResponse {
  mid?: string
}

export interface MarketQuote {
  bid: number | null
  ask: number | null
  mid: number | null
}

export type MarketQuotesByMarket = Record<string, MarketQuote>

const PRICE_REFRESH_INTERVAL_MS = 60_000
const CLOB_BASE_URL = process.env.CLOB_URL
// Proxy local para evitar CORS com clob.polymarket.com
const CLOB_PROXY_URL = '/api/clob'

function normalizePrice(value: string | number | undefined | null) {
  return normalizeClobMarketPrice(value)
}

function resolveQuote(
  priceBySide: { BUY?: string, SELL?: string } | undefined,
  midpoint: number | null,
): MarketQuote {
  // CLOB /prices returns BUY as best ask and SELL as best bid for the token.
  const ask = normalizePrice(priceBySide?.BUY)
  const bid = normalizePrice(priceBySide?.SELL)
  const normalizedMidpoint = normalizePrice(midpoint)
  const mid = bid != null && ask != null
    ? (normalizedMidpoint ?? (bid + ask) / 2)
    : (normalizedMidpoint ?? ask ?? bid ?? null)

  return { bid, ask, mid }
}

async function fetchMidpointByToken(tokenId: string): Promise<number | null> {
  // Usa sempre o proxy local para evitar CORS com clob.polymarket.com
  try {
    const response = await fetch(`/api/clob/midpoint?token_id=${encodeURIComponent(tokenId)}`)
    if (response.ok) {
      const payload = await response.json() as MidpointApiResponse
      return normalizePrice(payload?.mid)
    }
  }
  catch {
    // silencioso
  }
  return null
}

async function fetchQuotesByMarket(targets: MarketTokenTarget[]): Promise<MarketQuotesByMarket> {
  const uniqueTokenIds = Array.from(
    new Set(targets.map(target => target.tokenId).filter(Boolean)),
  )

  if (!uniqueTokenIds.length) {
    return {}
  }

  // Usa sempre o proxy /api/clob para evitar CORS
  try {
    const response = await fetch('/api/clob/prices', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(uniqueTokenIds.map(tokenId => ({ token_id: tokenId }))),
    })

    if (!response.ok) {
      console.warn(`[MarketQuotes] /api/clob/prices responded ${response.status}`)
      return {}
    }

    const data = await response.json() as PriceApiResponse
    const midpointResults = await Promise.allSettled(
      uniqueTokenIds.map(tokenId => fetchMidpointByToken(tokenId)),
    )
    const quotesByToken = new Map<string, MarketQuote>()
    const midpointByToken = new Map<string, number | null>()

    midpointResults.forEach((result, index) => {
      const tokenId = uniqueTokenIds[index]
      midpointByToken.set(tokenId, result.status === 'fulfilled' ? result.value : null)
    })

    uniqueTokenIds.forEach((tokenId) => {
      quotesByToken.set(tokenId, resolveQuote(data?.[tokenId], midpointByToken.get(tokenId) ?? null))
    })

    return targets.reduce<MarketQuotesByMarket>((acc, target) => {
      const quote = quotesByToken.get(target.tokenId)
      if (quote) {
        acc[target.conditionId] = quote
      }
      return acc
    }, {})
  }
  catch (err) {
    console.warn('[MarketQuotes] Fetch failed:', err)
    return {}
  }
}

export function useEventMarketQuotes(targets: MarketTokenTarget[]) {
  const tokenSignature = useMemo(
    () => targets.map(target => `${target.conditionId}:${target.tokenId}`).sort().join(','),
    [targets],
  )

  const { data } = useQuery({
    queryKey: ['event-market-quotes', tokenSignature],
    queryFn: () => fetchQuotesByMarket(targets),
    enabled: targets.length > 0,
    staleTime: 'static',
    gcTime: PRICE_REFRESH_INTERVAL_MS,
    refetchInterval: PRICE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    placeholderData: keepPreviousData,
  })

  return data ?? {}
}
