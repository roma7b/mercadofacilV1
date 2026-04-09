import type { Event } from '@/types'

export type MarketType = 'clob' | 'livePool'

interface EventLike {
  slug?: string | null
  main_tag?: string | null
  market_type?: MarketType | null
}

export function resolveMarketTypeFromSlug(slug: string | null | undefined): MarketType {
  if (!slug) {
    return 'clob'
  }
  // Se contiver 'poly-', é CLOB direto ou importado da Polymarket
  if (slug.includes('poly-')) {
    return 'clob'
  }
  // Prefixo live_ para os mercados reais do Mercado Fácil (ex: rodovia)
  if (slug.startsWith('live_')) {
    return 'livePool'
  }
  // Padrão: CLOB (Polymarket)
  return 'clob'
}

export function resolveMarketType(event: EventLike | null | undefined): MarketType {
  if (!event) {
    return 'clob'
  }
  if (event.market_type === 'livePool' || event.market_type === 'clob') {
    return event.market_type
  }
  if (event.main_tag === 'live_cam') {
    return 'livePool'
  }
  return resolveMarketTypeFromSlug(event.slug)
}

export function isLivePoolMarketType(type: MarketType): boolean {
  return type === 'livePool'
}

export function isLivePoolEvent(event: EventLike | null | undefined): boolean {
  return isLivePoolMarketType(resolveMarketType(event))
}
