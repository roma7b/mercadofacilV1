'use client'

import type { TimeRange } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import type { EventChartProps } from '@/app/[locale]/(platform)/event/[slug]/_types/EventChartTypes'
import type { ActivityOrder, Event, Market } from '@/types'
import type {
  DataPoint,
  PredictionChartAnnotationMarker,
  PredictionChartCursorSnapshot,
  PredictionChartProps,
  SeriesConfig,
} from '@/types/PredictionChartTypes'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEventTradeMarkers } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventTradeMarkers'
import { useMarketChannelSubscription } from '@/app/[locale]/(platform)/event/[slug]/_components/EventMarketChannelProvider'
import {
  useEventOutcomeChanceChanges,
  useEventOutcomeChances,
  useMarketQuotes,
  useMarketYesPrices,
  useUpdateEventOutcomeChanceChanges,
  useUpdateEventOutcomeChances,
  useUpdateMarketQuotes,
  useUpdateMarketYesPrices,
} from '@/app/[locale]/(platform)/event/[slug]/_components/EventOutcomeChanceProvider'
import { useEventMarketQuotes } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventMidPrices'
import {
  buildMarketTargets,
  TIME_RANGES,
  useEventPriceHistory,
} from '@/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory'
import { useXTrackerTweetCount } from '@/app/[locale]/(platform)/event/[slug]/_hooks/useXTrackerTweetCount'
import {
  areNumberMapsEqual,
  areQuoteMapsEqual,
  buildChartSeries,
  buildMarketSignature,
  computeChanceChanges,
  filterChartDataForSeries,
  getMaxSeriesCount,
  getOutcomeLabelForMarket,
  getTopMarketIds,
} from '@/app/[locale]/(platform)/event/[slug]/_utils/EventChartUtils'
import { isTweetMarketsEvent } from '@/app/[locale]/(platform)/event/[slug]/_utils/eventTweetMarkets'
import EventIconImage from '@/components/EventIconImage'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { useOutcomeLabel } from '@/hooks/useOutcomeLabel'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { useWindowSize } from '@/hooks/useWindowSize'
import { OUTCOME_INDEX } from '@/lib/constants'
import { fetchUserActivityData, mapDataApiActivityToActivityOrder } from '@/lib/data-api/user'
import { formatCurrency, formatSharePriceLabel, formatSharesLabel, fromMicro } from '@/lib/formatters'
import { buildChanceByMarket, normalizeMarketPrice, resolveDisplayPrice } from '@/lib/market-chance'
import { getUserPublicAddress } from '@/lib/user-address'
import { cn } from '@/lib/utils'
import { useIsSingleMarket, useOrder } from '@/stores/useOrder'
import { useUser } from '@/stores/useUser'
import { loadStoredChartSettings, storeChartSettings } from '../_utils/chartSettingsStorage'
import EventChartControls, { defaultChartSettings } from './EventChartControls'
import EventChartEmbedDialog from './EventChartEmbedDialog'
import EventChartExportDialog from './EventChartExportDialog'
import EventChartHeader from './EventChartHeader'
import EventChartLayout from './EventChartLayout'
import EventMetaInformation from './EventMetaInformation'

interface TradeFlowLabelItem {
  id: string
  label: string
  outcome: 'yes' | 'no'
  createdAt: number
}

const tradeFlowMaxItems = 6
const tradeFlowTtlMs = 8000
const tradeFlowCleanupIntervalMs = 500
const CHART_MARKER_ACTIVITY_PAGE_SIZE = 50
const CHART_MARKER_MAX_PAGES_PER_MARKET = 10
const EVENT_PLOT_CLIP_RIGHT_PADDING = 18
const TWEET_COUNT_METADATA_KEYS = [
  'tweet_count',
  'tweetCount',
  'tweets_count',
  'tweetsCount',
  'mention_count',
  'mentionCount',
  'mentions_count',
  'mentionsCount',
] as const
const tradeFlowTextStrokeStyle = {
  textShadow: `
    1px 0 0 var(--background),
    -1px 0 0 var(--background),
    0 1px 0 var(--background),
    0 -1px 0 var(--background),
    1px 1px 0 var(--background),
    -1px -1px 0 var(--background),
    1px -1px 0 var(--background),
    -1px 1px 0 var(--background)
  `,
} as const

async function fetchUserTradeActivityForConditionIds(params: {
  userAddress: string
  conditionIds: string[]
  signal?: AbortSignal
}) {
  const { userAddress, conditionIds, signal } = params
  if (!userAddress || conditionIds.length === 0) {
    return [] as ActivityOrder[]
  }

  const collected: ActivityOrder[] = []

  for (const conditionId of conditionIds) {
    let offset = 0

    for (let page = 0; page < CHART_MARKER_MAX_PAGES_PER_MARKET; page += 1) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const response = await fetchUserActivityData({
        pageParam: offset,
        userAddress,
        conditionId,
        signal,
      })
      const mapped = response.map(mapDataApiActivityToActivityOrder)
      const trades = mapped.filter(activity =>
        activity.type === 'trade' && activity.market.condition_id === conditionId)

      collected.push(...trades)

      if (response.length < CHART_MARKER_ACTIVITY_PAGE_SIZE) {
        break
      }

      offset += response.length
    }
  }

  const deduped = new Map<string, ActivityOrder>()
  collected.forEach((activity) => {
    const existing = deduped.get(activity.id)
    if (!existing) {
      deduped.set(activity.id, activity)
      return
    }

    if (new Date(activity.created_at).getTime() > new Date(existing.created_at).getTime()) {
      deduped.set(activity.id, activity)
    }
  })

  return Array.from(deduped.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

const PredictionChart = dynamic<PredictionChartProps>(
  () => import('@/components/PredictionChart'),
  { ssr: false, loading: () => <div className="h-83 w-full" /> },
)

function getOutcomeTokenIds(market: Market | null) {
  if (!market) {
    return null
  }
  const yesOutcome = market.outcomes?.find(outcome => outcome.outcome_index === OUTCOME_INDEX.YES)
  const noOutcome = market.outcomes?.find(outcome => outcome.outcome_index === OUTCOME_INDEX.NO)

  if (!yesOutcome?.token_id || !noOutcome?.token_id) {
    return null
  }

  return {
    yesTokenId: String(yesOutcome.token_id),
    noTokenId: String(noOutcome.token_id),
  }
}

function buildTradeFlowLabel(price: number, size: number) {
  const notional = price * size
  if (!Number.isFinite(notional) || notional <= 0) {
    return null
  }
  return formatSharePriceLabel(notional / 100, { fallback: '0¢', currencyDigits: 0 })
}

function resolveOutcomeIconUrl(iconUrl?: string | null) {
  if (!iconUrl) {
    return ''
  }

  const trimmed = iconUrl.trim()
  if (!trimmed) {
    return ''
  }

  return trimmed.startsWith('http') ? trimmed : `https://gateway.irys.xyz/${trimmed}`
}

function pruneTradeFlowItems(items: TradeFlowLabelItem[], now: number) {
  return items.filter(item => now - item.createdAt <= tradeFlowTtlMs)
}

function trimTradeFlowItems(items: TradeFlowLabelItem[]) {
  return items.slice(-tradeFlowMaxItems)
}

function resolveEventHistoryEndAt(event: Event) {
  const resolvedAt = event.resolved_at ?? null
  if (resolvedAt) {
    const resolvedMs = new Date(resolvedAt).getTime()
    if (Number.isFinite(resolvedMs)) {
      return resolvedAt
    }
  }

  if (event.status === 'resolved' || event.status === 'archived') {
    const endDate = event.end_date ?? null
    if (!endDate) {
      return null
    }

    const endDateMs = new Date(endDate).getTime()
    return Number.isFinite(endDateMs) ? endDate : null
  }

  return null
}

function parseTimestampToMs(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseCountValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 ? value : null
  }

  if (typeof value === 'string') {
    const normalized = value.replaceAll(',', '').trim()
    if (!normalized) {
      return null
    }

    const parsed = Number(normalized)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return null
}

function resolveTweetCountFromRecord(record: Record<string, unknown> | null | undefined): number | null {
  if (!record) {
    return null
  }

  for (const key of TWEET_COUNT_METADATA_KEYS) {
    const parsed = parseCountValue(record[key])
    if (parsed != null) {
      return parsed
    }
  }

  return null
}

function resolveTweetCount(event: Event): number | null {
  const fromEvent = resolveTweetCountFromRecord(event as unknown as Record<string, unknown>)
  if (fromEvent != null) {
    return fromEvent
  }

  for (const market of event.markets) {
    if (!market.metadata || typeof market.metadata !== 'object') {
      continue
    }

    const fromMarket = resolveTweetCountFromRecord(market.metadata as Record<string, unknown>)
    if (fromMarket != null) {
      return fromMarket
    }
  }

  return null
}

function resolveTweetCountdownTargetMs(event: Event): number | null {
  const eventEndMs = parseTimestampToMs(event.end_date)
  if (eventEndMs != null) {
    return eventEndMs
  }

  const marketEndTimes = event.markets
    .map(market => parseTimestampToMs(market.end_time ?? null))
    .filter((timestamp): timestamp is number => timestamp != null)

  if (marketEndTimes.length === 0) {
    return null
  }

  return Math.min(...marketEndTimes)
}

function buildCombinedOutcomeHistory(
  yesHistory: DataPoint[],
  noHistory: DataPoint[],
  conditionId: string,
  yesKey: string,
  noKey: string,
) {
  if (!conditionId) {
    return { points: [], latestSnapshot: {} as Record<string, number> }
  }

  const yesByTimestamp = new Map<number, number>()
  const noByTimestamp = new Map<number, number>()

  yesHistory.forEach((point) => {
    const value = point[conditionId]
    if (typeof value === 'number' && Number.isFinite(value)) {
      yesByTimestamp.set(point.date.getTime(), value)
    }
  })

  noHistory.forEach((point) => {
    const value = point[conditionId]
    if (typeof value === 'number' && Number.isFinite(value)) {
      noByTimestamp.set(point.date.getTime(), value)
    }
  })

  const timestamps = Array.from(new Set([
    ...yesByTimestamp.keys(),
    ...noByTimestamp.keys(),
  ])).sort((a, b) => a - b)

  let lastYes: number | null = null
  let lastNo: number | null = null
  const points: DataPoint[] = []

  timestamps.forEach((timestamp) => {
    const yesValue = yesByTimestamp.get(timestamp)
    const noValue = noByTimestamp.get(timestamp)
    if (typeof yesValue === 'number') {
      lastYes = yesValue
    }
    if (typeof noValue === 'number') {
      lastNo = noValue
    }
    if (lastYes === null && lastNo === null) {
      return
    }
    const point: DataPoint = { date: new Date(timestamp) }
    if (lastYes !== null) {
      point[yesKey] = lastYes
    }
    if (lastNo !== null) {
      point[noKey] = lastNo
    }
    points.push(point)
  })

  const latestSnapshot: Record<string, number> = {}
  const latestPoint = points.at(-1)
  if (latestPoint) {
    const yesValue = latestPoint[yesKey]
    const noValue = latestPoint[noKey]
    if (typeof yesValue === 'number' && Number.isFinite(yesValue)) {
      latestSnapshot[yesKey] = yesValue
    }
    if (typeof noValue === 'number' && Number.isFinite(noValue)) {
      latestSnapshot[noKey] = noValue
    }
  }

  return { points, latestSnapshot }
}

function EventChartComponent({
  event,
  isMobile,
  seriesEvents = [],
  showControls = true,
  showSeriesNavigation = true,
}: EventChartProps) {
  const site = useSiteIdentity()
  const user = useUser()
  const userAddress = getUserPublicAddress(user)
  const normalizeOutcomeLabel = useOutcomeLabel()
  const isSingleMarketBase = useIsSingleMarket()
  const isCategorical = useMemo(() => event.markets.some(m => m.outcomes && m.outcomes.length > 2), [event.markets])
  const isSingleMarket = isSingleMarketBase && !isCategorical
  
  const allCategoricalTokenIds = useMemo(() => {
    const ids: string[] = []
    event.markets.forEach(m => {
      if (m.outcomes && m.outcomes.length > 2) {
        m.outcomes.forEach(o => {
          if (o.token_id) ids.push(o.token_id)
        })
      }
    })
    return ids
  }, [event.markets])

  const isNegRiskEnabled = Boolean(event.enable_neg_risk || event.neg_risk)
  // Non-single markets with neg_risk=false should hide chart, UNLESS it's a categorical market 
  // (which is treated as a multi-outcome single market).
  const shouldHideChart = !isSingleMarketBase && !isNegRiskEnabled && !isCategorical
  const currentOutcomeChances = useEventOutcomeChances()
  const currentOutcomeChanceChanges = useEventOutcomeChanceChanges()
  const currentMarketQuotes = useMarketQuotes()
  const currentMarketYesPrices = useMarketYesPrices()
  const updateOutcomeChances = useUpdateEventOutcomeChances()
  const updateMarketYesPrices = useUpdateMarketYesPrices()
  const updateMarketQuotes = useUpdateMarketQuotes()
  const updateOutcomeChanceChanges = useUpdateEventOutcomeChanceChanges()
  
  const selectedOutcomeStore = useOrder(state => state.outcome)

  // LOG PARA DEPURAR O SERVIDOR SSR
  if (typeof window === 'undefined') {
    event.markets.forEach(m => {
      console.log(`[SSR] EventChart render: Market ${m.condition_id} has ${m.outcomes?.length} outcomes.`)
      m.outcomes?.forEach((o, i) => {
        if (i < 2) console.log(`[SSR] Outcome ${i}: text=${o.outcome_text}, token_id=${o.token_id}`)
      })
    })
    console.log(`[SSR] Computed isCategorical=${isCategorical}, shouldHideChart=${shouldHideChart}`)
  }


  const fallbackPrices = useQuery({
    queryKey: ['mercado-live-pool-fallback', event.slug],
    queryFn: async () => {
      if (!event.slug?.startsWith('poly-') && !event.slug?.startsWith('live_')) return null
      try {
        const res = await fetch(`/api/mercado/${event.slug}`)
        const json = await res.json()
        if (json.success && json.data) {
           return {
              sim: Number(json.data.total_sim) || null,
              nao: Number(json.data.total_nao) || null
           }
        }
      } catch (e) { return null }
      return null
    },
    enabled: Boolean(event.slug && (event.slug.startsWith('poly-') || event.slug.startsWith('live_')))
  })

  const [activeTimeRange, setActiveTimeRange] = useState<TimeRange>('ALL')
  const [activeOutcomeIndex, setActiveOutcomeIndex] = useState<
    typeof OUTCOME_INDEX.YES | typeof OUTCOME_INDEX.NO
  >(OUTCOME_INDEX.YES)
  const [cursorSnapshot, setCursorSnapshot] = useState<PredictionChartCursorSnapshot | null>(null)
  const [tradeFlowItems, setTradeFlowItems] = useState<TradeFlowLabelItem[]>([])
  const [chartSettings, setChartSettings] = useState(() => ({ ...defaultChartSettings }))
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const [nowMs, setNowMs] = useState(0)
  const tradeFlowIdRef = useRef(0)
  const lastEventIdRef = useRef(event.id)

  useEffect(() => {
    setCursorSnapshot(null)
  }, [activeTimeRange, event.slug, activeOutcomeIndex, chartSettings.bothOutcomes])

  useEffect(() => {
    setChartSettings(loadStoredChartSettings())
    setHasLoadedSettings(true)
  }, [])

  useEffect(() => {
    if (!hasLoadedSettings) {
      return
    }
    storeChartSettings(chartSettings)
  }, [chartSettings, hasLoadedSettings])

  useEffect(() => {
    setNowMs(Date.now())

    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 30_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  const showBothOutcomes = isSingleMarket && chartSettings.bothOutcomes
  const eventHistoryEndAt = useMemo(
    () => resolveEventHistoryEndAt(event),
    [event],
  )
  const shouldShowTweetMarketsPanel = useMemo(
    () => isTweetMarketsEvent(event),
    [event],
  )
  const tweetCount = useMemo(
    () => resolveTweetCount(event),
    [event],
  )
  const tweetCountdownTargetMs = useMemo(
    () => resolveTweetCountdownTargetMs(event),
    [event],
  )
  const xtrackerTweetCountQuery = useXTrackerTweetCount(event, shouldShowTweetMarketsPanel)
  const resolvedTweetCount = xtrackerTweetCountQuery.data?.totalCount ?? tweetCount
  const resolvedTweetCountdownTargetMs = useMemo(() => {
    const trackingEndMs = xtrackerTweetCountQuery.data?.trackingEndMs
    if (typeof trackingEndMs === 'number' && Number.isFinite(trackingEndMs) && trackingEndMs > 0) {
      return trackingEndMs
    }

    return tweetCountdownTargetMs
  }, [tweetCountdownTargetMs, xtrackerTweetCountQuery.data?.trackingEndMs])
  const resolvedTweetStartTargetMs = useMemo(() => {
    const trackingStartMs = xtrackerTweetCountQuery.data?.trackingStartMs
    if (typeof trackingStartMs === 'number' && Number.isFinite(trackingStartMs) && trackingStartMs > 0) {
      return trackingStartMs
    }

    return parseTimestampToMs(event.start_date ?? null)
  }, [event.start_date, xtrackerTweetCountQuery.data?.trackingStartMs])
  const shouldRenderTweetMarketsPanel = shouldShowTweetMarketsPanel
    && resolvedTweetStartTargetMs != null
    && nowMs >= resolvedTweetStartTargetMs
  const isTweetMarketsFinal = Boolean(event.resolved_at || event.status === 'resolved')
    || (
      resolvedTweetCountdownTargetMs != null
      && Number.isFinite(resolvedTweetCountdownTargetMs)
      && nowMs >= resolvedTweetCountdownTargetMs
    )

  const yesMarketTargets = useMemo(() => {
    const targets: { conditionId: string, tokenId: string }[] = []
    const addedTokens = new Set<string>()

    event.markets.forEach(m => {
      if (m.outcomes && m.outcomes.length > 2) {
        // Categorical
        m.outcomes.slice(0, 10).forEach(o => {
          if (o.token_id) {
            targets.push({ conditionId: o.token_id, tokenId: o.token_id })
            addedTokens.add(o.token_id)
          }
        })
        
        // Ensure selected is included
        if (selectedOutcomeStore?.token_id && !addedTokens.has(selectedOutcomeStore.token_id)) {
           const belongsToThisMarket = m.outcomes.some(o => o.token_id === selectedOutcomeStore.token_id)
           if (belongsToThisMarket) {
              targets.push({ conditionId: selectedOutcomeStore.token_id, tokenId: selectedOutcomeStore.token_id })
              addedTokens.add(selectedOutcomeStore.token_id)
           }
        }
      } else if (m.outcomes?.[OUTCOME_INDEX.YES]?.token_id) {
        targets.push({ conditionId: m.condition_id, tokenId: m.outcomes[OUTCOME_INDEX.YES].token_id })
        addedTokens.add(m.outcomes[OUTCOME_INDEX.YES].token_id)
      }
    })
    return targets
  }, [event.markets, selectedOutcomeStore?.token_id])

  const noMarketTargets = useMemo(() => {
    if (shouldHideChart || !isSingleMarket) return []
    const targets: { conditionId: string, tokenId: string }[] = []
    event.markets.forEach(m => {
      if (m.outcomes?.[OUTCOME_INDEX.NO]?.token_id) {
        targets.push({ conditionId: m.condition_id, tokenId: m.outcomes[OUTCOME_INDEX.NO].token_id })
      }
    })
    return targets
  }, [event.markets, isSingleMarket, shouldHideChart])

  const yesPriceHistory = useEventPriceHistory({
    event,
    eventId: event.id,
    range: activeTimeRange,
    targets: yesMarketTargets,
    eventCreatedAt: event.created_at,
    eventResolvedAt: eventHistoryEndAt,
  })
  const noPriceHistory = useEventPriceHistory({
    event,
    eventId: event.id,
    range: activeTimeRange,
    targets: noMarketTargets,
    eventCreatedAt: event.created_at,
    eventResolvedAt: eventHistoryEndAt,
  })
  const marketQuotesByMarket = useEventMarketQuotes(yesMarketTargets)
  const chanceChangeByMarket = useMemo(
    () => computeChanceChanges(yesPriceHistory.points),
    [yesPriceHistory.points],
  )
  const displayChanceByMarket = useMemo(() => {
    const marketIds = new Set([
      ...Object.keys(marketQuotesByMarket),
      ...Object.keys(yesPriceHistory.latestRawPrices),
    ])
    const entries: Array<[string, number]> = []

    marketIds.forEach((marketId) => {
      const quote = marketQuotesByMarket[marketId]
      const lastTrade = yesPriceHistory.latestRawPrices[marketId]
      const displayPrice = resolveDisplayPrice({
        bid: quote?.bid ?? null,
        ask: quote?.ask ?? null,
        midpoint: quote?.mid ?? null,
        lastTrade,
      })

      if (displayPrice != null) {
        entries.push([marketId, displayPrice * 100])
      }
    })

    return Object.fromEntries(entries)
  }, [marketQuotesByMarket, yesPriceHistory.latestRawPrices])

  const chartHistory = isSingleMarket && activeOutcomeIndex === OUTCOME_INDEX.NO
    ? noPriceHistory
    : yesPriceHistory
  const marketSnapshot = showBothOutcomes ? yesPriceHistory.latestSnapshot : chartHistory.latestSnapshot

  useEffect(() => {
    if (Object.keys(displayChanceByMarket).length > 0) {
      if (areNumberMapsEqual(displayChanceByMarket, currentOutcomeChances)) {
        return
      }
      updateOutcomeChances(displayChanceByMarket)
    }
  }, [currentOutcomeChances, displayChanceByMarket, updateOutcomeChances])

  useEffect(() => {
    if (Object.keys(yesPriceHistory.latestRawPrices).length > 0) {
      if (areNumberMapsEqual(yesPriceHistory.latestRawPrices, currentMarketYesPrices)) {
        return
      }
      updateMarketYesPrices(yesPriceHistory.latestRawPrices)
    }
  }, [currentMarketYesPrices, yesPriceHistory.latestRawPrices, updateMarketYesPrices])

  useEffect(() => {
    if (Object.keys(chanceChangeByMarket).length > 0) {
      if (areNumberMapsEqual(chanceChangeByMarket, currentOutcomeChanceChanges)) {
        return
      }
      updateOutcomeChanceChanges(chanceChangeByMarket)
    }
  }, [chanceChangeByMarket, currentOutcomeChanceChanges, updateOutcomeChanceChanges])

  useEffect(() => {
    if (Object.keys(marketQuotesByMarket).length > 0) {
      if (areQuoteMapsEqual(marketQuotesByMarket, currentMarketQuotes)) {
        return
      }
      updateMarketQuotes(marketQuotesByMarket)
    }
  }, [currentMarketQuotes, marketQuotesByMarket, updateMarketQuotes])

  const maxSeriesCount = getMaxSeriesCount()
  const allMarketIds = useMemo(
    () => {
      const ids: string[] = []
      event.markets.forEach(market => {
        if (market.outcomes && market.outcomes.length > 2) {
          // Mercado categórico: usa token_id dos outcomes (se disponíveis)
          let addedCount = 0
          market.outcomes.slice(0, 10).forEach(o => {
            if (o.token_id) {
              ids.push(o.token_id)
              addedCount++
            }
          })
          // Fallback: se não tiver token_ids, usa condition_id do mercado
          if (addedCount === 0) {
            const id = market.condition_id || market.id
            if (id) ids.push(id)
          }
        } else {
          const id = market.condition_id || market.id
          if (id) ids.push(id)
        }
      })
      return ids
    },
    [event.markets],
  )
  const topMarketIds = useMemo(
    () => getTopMarketIds(marketSnapshot, maxSeriesCount),
    [marketSnapshot, maxSeriesCount],
  )
  const fallbackMarketIds = useMemo(
    () => allMarketIds.slice(0, maxSeriesCount),
    [allMarketIds, maxSeriesCount],
  )
  const defaultMarketIds = useMemo(
    () => (topMarketIds.length > 0 ? topMarketIds : fallbackMarketIds),
    [topMarketIds, fallbackMarketIds],
  )
  // Para mercados categóricos com token_ids, inicializamos com os ids reais para não ficar em branco
  const initialMarketIds = useMemo(
    () => fallbackMarketIds.length > 0 ? fallbackMarketIds : defaultMarketIds,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [selectedMarketIds, setSelectedMarketIds] = useState<string[]>(() => initialMarketIds)
  const [hasCustomSelection, setHasCustomSelection] = useState(false)

  useEffect(() => {
    if (lastEventIdRef.current === event.id) {
      return
    }

    lastEventIdRef.current = event.id
    setHasCustomSelection(false)
    if (!isSingleMarket) {
      setSelectedMarketIds(defaultMarketIds)
    }
  }, [defaultMarketIds, event.id, isSingleMarket])

  useEffect(() => {
    if (isSingleMarket || hasCustomSelection) {
      return
    }
    setSelectedMarketIds(defaultMarketIds)
  }, [defaultMarketIds, hasCustomSelection, isSingleMarket])

  useEffect(() => {
    if (isSingleMarket) {
      return
    }
    setSelectedMarketIds((prev) => {
      const filtered = prev.filter(id => allMarketIds.includes(id))
      if (filtered.length > 0) {
        return filtered
      }
      return defaultMarketIds
    })
  }, [allMarketIds, defaultMarketIds, isSingleMarket])

  const handleToggleMarket = useCallback((marketId: string) => {
    if (isSingleMarket) {
      return
    }

    setHasCustomSelection(true)
    setSelectedMarketIds((prev) => {
      const isSelected = prev.includes(marketId)
      if (isSelected) {
        const next = prev.filter(id => id !== marketId)
        return next.length > 0 ? next : prev
      }
      if (prev.length >= maxSeriesCount) {
        return prev
      }
      const nextSet = new Set(prev)
      nextSet.add(marketId)
      return allMarketIds.filter(id => nextSet.has(id)).slice(0, maxSeriesCount)
    })
  }, [allMarketIds, isSingleMarket, maxSeriesCount])

  const chartSeries = useMemo(
    () => buildChartSeries(event, topMarketIds),
    [event, topMarketIds],
  )
  const fallbackChartSeries = useMemo(
    () => buildChartSeries(event, fallbackMarketIds),
    [event, fallbackMarketIds],
  )
  const allSeries = useMemo(
    () => buildChartSeries(event, allMarketIds),
    [event, allMarketIds],
  )
  const selectedSeries = useMemo(
    () => buildChartSeries(event, selectedMarketIds),
    [event, selectedMarketIds],
  )
  const selectedColors = useMemo(
    () => Object.fromEntries(selectedSeries.map(series => [series.key, series.color])),
    [selectedSeries],
  )
  const marketOptions = useMemo(
    () => allSeries.map(series => ({
      ...series,
      color: selectedColors[series.key] ?? '#374151',
    })),
    [allSeries, selectedColors],
  )

  const baseSeries = useMemo(() => {
    if (!isSingleMarket) {
      if (selectedSeries.length > 0) {
        return selectedSeries
      }
      return chartSeries.length > 0 ? chartSeries : fallbackChartSeries
    }
    return chartSeries.length > 0 ? chartSeries : fallbackChartSeries
  }, [chartSeries, fallbackChartSeries, isSingleMarket, selectedSeries])

  const primaryMarket = useMemo(
    () => {
      if (isSingleMarket) {
        return event?.markets?.[0]
      }
      const primaryId = baseSeries?.[0]?.key
      return (primaryId
        ? event?.markets?.find(market => market.condition_id === primaryId)
        : null) ?? event?.markets?.[0]
    },
    [event.markets, baseSeries, isSingleMarket],
  )

  const primaryConditionId = primaryMarket?.condition_id ?? ''
  const yesSeriesKey = showBothOutcomes && primaryConditionId
    ? `${primaryConditionId}-yes`
    : primaryConditionId
  const noSeriesKey = showBothOutcomes && primaryConditionId
    ? `${primaryConditionId}-no`
    : primaryConditionId
  const yesOutcomeLabel = getOutcomeLabelForMarket(primaryMarket, OUTCOME_INDEX.YES)
  const noOutcomeLabel = getOutcomeLabelForMarket(primaryMarket, OUTCOME_INDEX.NO)
  const bothOutcomeSeries = useMemo(
    () => {
      if (!showBothOutcomes || !primaryConditionId) {
        return []
      }
      return [
        { key: yesSeriesKey, name: yesOutcomeLabel, color: 'var(--primary)' },
        { key: noSeriesKey, name: noOutcomeLabel, color: '#FF6600' },
      ]
    },
    [showBothOutcomes, primaryConditionId, yesSeriesKey, noSeriesKey, yesOutcomeLabel, noOutcomeLabel],
  )

  const effectiveSeries = useMemo(() => {
    if (showBothOutcomes) {
      return bothOutcomeSeries
    }
    if (!isSingleMarket || baseSeries.length === 0) {
      return baseSeries
    }
    const primaryColor = activeOutcomeIndex === OUTCOME_INDEX.NO ? '#FF6600' : 'var(--primary)'
    return baseSeries.map((seriesItem, index) => (index === 0
      ? { ...seriesItem, color: primaryColor }
      : seriesItem))
  }, [activeOutcomeIndex, baseSeries, isSingleMarket, showBothOutcomes, bothOutcomeSeries])

  const watermark = useMemo(
    () => ({
      iconSvg: site.logoSvg,
      iconImageUrl: site.logoImageUrl,
      label: site.name,
    }),
    [site.logoImageUrl, site.logoSvg, site.name],
  )
  const chartLogo = (watermark.iconSvg || watermark.label)
    ? (
        <div className="flex items-center gap-1 text-xl text-muted-foreground opacity-50 select-none">
          {watermark.iconSvg
            ? (
                <SiteLogoIcon
                  logoSvg={watermark.iconSvg}
                  logoImageUrl={watermark.iconImageUrl}
                  alt={`${watermark.label} logo`}
                  className="size-[1em] **:fill-current **:stroke-current"
                  imageClassName="size-[1em] object-contain"
                  size={20}
                />
              )
            : null}
          {watermark.label
            ? (
                <span className="font-semibold">
                  {watermark.label}
                </span>
              )
            : null}
        </div>
      )
    : null

  const legendSeries = effectiveSeries
  const hasLegendSeries = legendSeries.length > 0
  const oppositeOutcomeIndex = activeOutcomeIndex === OUTCOME_INDEX.YES
    ? OUTCOME_INDEX.NO
    : OUTCOME_INDEX.YES
  const oppositeOutcomeLabel = getOutcomeLabelForMarket(primaryMarket, oppositeOutcomeIndex)
  const activeOutcomeLabel = getOutcomeLabelForMarket(primaryMarket, activeOutcomeIndex)
  const markerConditionIds = useMemo(() => {
    if (!userAddress) {
      return []
    }

    if (showBothOutcomes || isSingleMarket) {
      return primaryConditionId ? [primaryConditionId] : []
    }

    const unique = new Set<string>()
    effectiveSeries.forEach((seriesItem) => {
      if (seriesItem.key) {
        unique.add(seriesItem.key)
      }
    })
    return Array.from(unique)
  }, [effectiveSeries, isSingleMarket, primaryConditionId, showBothOutcomes, userAddress])
  const markerConditionSignature = useMemo(
    () => markerConditionIds.slice().sort().join(','),
    [markerConditionIds],
  )
  const { data: userTradeActivities = [] } = useQuery({
    queryKey: ['event-chart-user-trade-markers', event.id, userAddress, markerConditionSignature],
    queryFn: ({ signal }) => fetchUserTradeActivityForConditionIds({
      userAddress: userAddress!,
      conditionIds: markerConditionIds,
      signal,
    }),
    enabled: Boolean(chartSettings.annotations && userAddress && markerConditionIds.length > 0),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })
  const { markers: allTradeMarkers } = useEventTradeMarkers({
    event,
    markerConditionIds,
    showBothOutcomes,
    enabled: Boolean(chartSettings.annotations),
  })

  const chartAnnotationMarkers = useMemo<PredictionChartAnnotationMarker[]>(() => {
    const userMarkers = userTradeActivities.flatMap((activity, index) => {
      const conditionId = activity.market.condition_id
      if (!conditionId || !markerConditionIds.includes(conditionId)) return []
      const createdAtTimestamp = new Date(activity.created_at).getTime()
      if (!Number.isFinite(createdAtTimestamp)) return []
      const rawPrice = Number(activity.price)
      if (!Number.isFinite(rawPrice)) return []
      const outcomeIndex = Number(activity.outcome.index)
      const isYesOutcome = outcomeIndex === OUTCOME_INDEX.YES
      const isNoOutcome = outcomeIndex === OUTCOME_INDEX.NO
      if (!isYesOutcome && !isNoOutcome) return []
      const normalizedLineValue = showBothOutcomes ? rawPrice * 100 : (isNoOutcome ? (1 - rawPrice) * 100 : rawPrice * 100)
      if (!Number.isFinite(normalizedLineValue)) return []
      const sharesValue = Number.parseFloat(fromMicro(activity.amount, 4))
      const outcomeLabel = normalizeOutcomeLabel(activity.outcome.text)
      const actionLabel = activity.side === 'sell' ? 'Vendeu' : 'Comprou'
      const priceLabel = formatSharePriceLabel(rawPrice, { fallback: '—' })
      const totalValue = Number.parseFloat(fromMicro(activity.total_value, 2))
      const markerColor = isYesOutcome ? 'var(--color-yes)' : 'var(--color-no)'

      return [{
        id: `user-trade-${activity.id}-${index}`,
        date: new Date(createdAtTimestamp),
        value: normalizedLineValue,
        color: markerColor,
        radius: 4.5,
        tooltipContent: (
          <div className="flex items-center gap-2 text-xs whitespace-nowrap">
            <span className="font-bold text-primary">SUA APOSTA:</span>
            <span className="font-semibold text-foreground">{actionLabel}</span>
            <span className={cn('font-semibold', isYesOutcome ? 'text-yes' : 'text-no')}>
              {formatSharesLabel(sharesValue)} {outcomeLabel}
            </span>
          </div>
        ),
      }]
    })

    const combined = [...userMarkers, ...allTradeMarkers]
    return combined.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [markerConditionIds, normalizeOutcomeLabel, showBothOutcomes, userTradeActivities, allTradeMarkers])
  const outcomeTokenIds = useMemo(
    () => {
      return getOutcomeTokenIds(primaryMarket)
    },
    [primaryMarket],
  )

  const bothOutcomeHistory = useMemo(() => {
    if (!showBothOutcomes || !primaryConditionId) {
      return { points: [] as DataPoint[], latestSnapshot: {} as Record<string, number> }
    }
    return buildCombinedOutcomeHistory(
      yesPriceHistory.points,
      noPriceHistory.points,
      primaryConditionId,
      yesSeriesKey,
      noSeriesKey,
    )
  }, [
    showBothOutcomes,
    primaryConditionId,
    yesSeriesKey,
    noSeriesKey,
    yesPriceHistory.points,
    noPriceHistory.points,
  ])

  const normalizedHistory = showBothOutcomes
    ? bothOutcomeHistory.points
    : chartHistory.points
  const leadingGapStart = normalizedHistory?.[0]?.date ?? null
  const latestSnapshot = showBothOutcomes
    ? bothOutcomeHistory.latestSnapshot
    : chartHistory.latestSnapshot

  const chartData = useMemo(
    () => filterChartDataForSeries(
      normalizedHistory,
      effectiveSeries.map(series => series.key),
    ),
    [normalizedHistory, effectiveSeries],
  )
  const hasChartData = chartData.length > 0
  const chartSignature = useMemo(() => {
    const seriesKeys = effectiveSeries.map(series => series.key).join(',')
    return `${event.id}:${activeTimeRange}:${activeOutcomeIndex}:${seriesKeys}`
  }, [event.id, activeTimeRange, activeOutcomeIndex, effectiveSeries])

  const { width: windowWidth } = useWindowSize()
  const chartWidth = isMobile ? ((windowWidth || 400) * 0.84) : Math.min((windowWidth ?? 1440) * 0.55, 900)

  const legendEntries = useMemo<Array<SeriesConfig & { value: number | null }>>(
    () => legendSeries.map((seriesItem) => {
      const hoveredValue = cursorSnapshot?.values?.[seriesItem.key]
      const snapshotValue = showBothOutcomes
        ? latestSnapshot[seriesItem.key]
        : (currentOutcomeChances[seriesItem.key] ?? latestSnapshot[seriesItem.key])
      const value = typeof hoveredValue === 'number' && Number.isFinite(hoveredValue)
        ? hoveredValue
        : (Number.isFinite(snapshotValue)
            ? snapshotValue
            : null)
      return { ...seriesItem, value }
    }),
    [legendSeries, cursorSnapshot, currentOutcomeChances, latestSnapshot, showBothOutcomes],
  )

  const activeSeriesKey = showBothOutcomes
    ? (activeOutcomeIndex === OUTCOME_INDEX.NO ? noSeriesKey : yesSeriesKey)
    : legendSeries[0]?.key
  const primarySeriesColor = showBothOutcomes
    ? (activeOutcomeIndex === OUTCOME_INDEX.NO ? '#FF6600' : 'var(--primary)')
    : (legendSeries[0]?.color ?? 'currentColor')
  const hoveredActiveChance = activeSeriesKey
    ? cursorSnapshot?.values?.[activeSeriesKey]
    : null
  const primaryMarketKey = primaryConditionId || legendSeries[0]?.key
  const storedYesChance = primaryMarketKey
    ? currentOutcomeChances[primaryMarketKey]
    : null
  const latestYesChance = primaryMarketKey
    ? yesPriceHistory.latestSnapshot[primaryMarketKey]
    : null
  const baseYesChance = typeof storedYesChance === 'number' && Number.isFinite(storedYesChance)
    ? storedYesChance
    : (typeof latestYesChance === 'number' && Number.isFinite(latestYesChance)
        ? latestYesChance
        : (primaryMarket?.price ? (normalizeMarketPrice(primaryMarket.price) || 0) * 100 : null))
  const fallbackActivePrice = activeOutcomeIndex === OUTCOME_INDEX.YES ? fallbackPrices.data?.sim : Math.max(0, fallbackPrices.data?.nao ?? (fallbackPrices.data?.sim !== undefined && fallbackPrices.data?.sim !== null ? 1 - fallbackPrices.data.sim! : fallbackPrices.data?.nao!))

  const derivedActiveChance = typeof baseYesChance === 'number'
    ? (activeOutcomeIndex === OUTCOME_INDEX.NO
        ? Math.max(0, Math.min(100, 100 - baseYesChance))
        : baseYesChance)
    : fallbackActivePrice != null ? fallbackActivePrice * 100 : null
  const snapshotActiveChance = showBothOutcomes && activeSeriesKey
    ? (typeof latestSnapshot[activeSeriesKey] === 'number' ? latestSnapshot[activeSeriesKey] : null)
    : null
  const baseActiveChance = snapshotActiveChance ?? derivedActiveChance
  const resolvedActiveChance = typeof hoveredActiveChance === 'number' && Number.isFinite(hoveredActiveChance)
    ? hoveredActiveChance
    : (typeof baseActiveChance === 'number' && Number.isFinite(baseActiveChance)
        ? baseActiveChance
        : null)
  const yesChanceValue = typeof resolvedActiveChance === 'number' ? resolvedActiveChance : null
  const legendEntriesWithValues = useMemo(
    () => legendEntries.filter(entry => typeof entry.value === 'number' && Number.isFinite(entry.value)),
    [legendEntries],
  )
  const shouldRenderLegendEntries = chartSeries.length > 0 && legendEntriesWithValues.length > 0
  const cursorActiveChance = typeof hoveredActiveChance === 'number' && Number.isFinite(hoveredActiveChance)
    ? hoveredActiveChance
    : null
  const defaultBaselineYesChance = useMemo(() => {
    if (!activeSeriesKey) {
      return null
    }
    for (const point of chartData) {
      const value = point[activeSeriesKey]
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
    }
    return null
  }, [chartData, activeSeriesKey])
  const defaultCurrentYesChance = useMemo(() => {
    if (!activeSeriesKey) {
      return null
    }
    for (let index = chartData.length - 1; index >= 0; index -= 1) {
      const value = chartData[index]?.[activeSeriesKey]
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }
    }
    return null
  }, [chartData, activeSeriesKey])
  const isHovering = cursorSnapshot !== null
    && cursorActiveChance !== null
    && Number.isFinite(cursorActiveChance)
  const effectiveBaselineYesChance = defaultBaselineYesChance
  const effectiveCurrentYesChance = isHovering
    ? cursorActiveChance
    : defaultCurrentYesChance
  const hasTradeFlowLabels = tradeFlowItems.length > 0

  useEffect(() => {
    if (!outcomeTokenIds) {
      setTradeFlowItems([])
    }
  }, [outcomeTokenIds])
  useMarketChannelSubscription((payload) => {
    if (!outcomeTokenIds) {
      return
    }

    if (payload?.event_type !== 'last_trade_price') {
      return
    }

    const { yesTokenId, noTokenId } = outcomeTokenIds
    const assetId = payload.asset_id
    const price = Number(payload.price)
    const size = Number(payload.size)
    const label = buildTradeFlowLabel(price, size)

    if (!label) {
      return
    }

    let outcome: 'yes' | 'no' | null = null

    if (assetId === yesTokenId) {
      outcome = 'yes'
    }

    if (assetId === noTokenId) {
      outcome = 'no'
    }

    if (!outcome) {
      return
    }

    const createdAt = Date.now()
    const id = String(tradeFlowIdRef.current)
    tradeFlowIdRef.current += 1

    setTradeFlowItems((prev) => {
      const next = [...prev, { id, label, outcome, createdAt }]
      return trimTradeFlowItems(pruneTradeFlowItems(next, createdAt))
    })
  })

  useEffect(() => {
    if (!hasTradeFlowLabels) {
      return
    }

    const interval = window.setInterval(() => {
      const now = Date.now()
      setTradeFlowItems((prev) => {
        const next = pruneTradeFlowItems(prev, now)
        if (next.length === prev.length) {
          return prev
        }
        return next
      })
    }, tradeFlowCleanupIntervalMs)

    return () => {
      window.clearInterval(interval)
    }
  }, [hasTradeFlowLabels])

  const legendContent = shouldRenderLegendEntries
    ? (
        <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-x-4 sm:gap-y-2">
          {legendEntriesWithValues.map((entry) => {
            const resolvedValue = entry.value as number
            return (
              <div key={entry.key} className="flex max-w-full items-center gap-2">
                <div
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span
                  className="
                    inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium
                    text-muted-foreground
                  "
                >
                  <span className="min-w-0 wrap-break-word">{entry.name}</span>
                  <span className={`
                    inline-flex min-w-8 shrink-0 items-baseline justify-end text-sm font-semibold whitespace-nowrap
                    text-foreground tabular-nums
                  `}
                  >
                    {resolvedValue.toFixed(0)}
                    <span className="ml-0.5 text-sm text-foreground">%</span>
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )
    : null

  if (shouldHideChart) {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <EventMetaInformation event={event} currentTimestamp={nowMs || null} />
        {chartLogo}
      </div>
    )
  }

  if (!hasLegendSeries) {
    // Para mercados categóricos, aguardar os dados mas mostrar um placeholder
    if (isCategorical && allMarketIds.length > 0) {
      return (
        <div className="flex items-center justify-center min-h-[300px] text-muted-foreground text-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Carregando histórico de preços...</span>
          </div>
        </div>
      )
    }
    return null
  }
  return (
    <>

      <EventChartLayout
        header={(
          <EventChartHeader
            isSingleMarket={isSingleMarket}
            activeOutcomeIndex={activeOutcomeIndex}
            activeOutcomeLabel={activeOutcomeLabel}
            primarySeriesColor={primarySeriesColor}
            yesChanceValue={yesChanceValue}
            effectiveBaselineYesChance={effectiveBaselineYesChance}
            effectiveCurrentYesChance={effectiveCurrentYesChance}
            watermark={watermark}
            currentEventSlug={event.slug}
            seriesEvents={seriesEvents}
            showSeriesNavigation={showSeriesNavigation}
            showTweetMarketsPanel={shouldRenderTweetMarketsPanel}
            tweetCount={resolvedTweetCount}
            tweetCountdownTargetMs={resolvedTweetCountdownTargetMs}
            tweetMarketsFinal={isTweetMarketsFinal}
          />
        )}
        chart={(
          <div className="relative">
            <PredictionChart
              data={chartData}
              series={legendSeries}
              width={chartWidth}
              height={332}
              margin={{ top: 30, right: 40, bottom: 52, left: 0 }}
              dataSignature={chartSignature}
              onCursorDataChange={setCursorSnapshot}
              xAxisTickCount={isMobile ? 2 : 4}
              autoscale={chartSettings.autoscale}
              showXAxis={chartSettings.xAxis}
              showYAxis={chartSettings.yAxis}
              showHorizontalGrid={chartSettings.horizontalGrid}
              showVerticalGrid={chartSettings.verticalGrid}
              showAnnotations={chartSettings.annotations && chartAnnotationMarkers.length > 0}
              annotationMarkers={chartAnnotationMarkers}
              leadingGapStart={leadingGapStart}
              legendContent={legendContent}
              showLegend={!isSingleMarket}
              showVolumeBars={true}
              watermark={isSingleMarket ? undefined : watermark}
              lineCurve="monotoneX"
              plotClipPadding={{ right: EVENT_PLOT_CLIP_RIGHT_PADDING }}
            />
            {hasTradeFlowLabels
              ? (
                  <div className={`
                    pointer-events-none absolute bottom-6 left-4 flex flex-col gap-1 text-sm font-semibold tabular-nums
                  `}
                  >
                    {tradeFlowItems.map(item => (
                      <span
                        key={item.id}
                        className={cn(`${item.outcome === 'yes' ? 'text-yes' : 'text-no'} animate-trade-flow-rise`)}
                        style={tradeFlowTextStrokeStyle}
                      >
                        +
                        {item.label}
                      </span>
                    ))}
                  </div>
                )
              : null}
          </div>
        )}
        controls={showControls
          ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <EventMetaInformation event={event} currentTimestamp={nowMs || null} />
                {hasChartData
                  ? (
                      <EventChartControls
                        timeRanges={TIME_RANGES}
                        activeTimeRange={activeTimeRange}
                        onTimeRangeChange={setActiveTimeRange}
                        showOutcomeSwitch={isSingleMarket}
                        oppositeOutcomeLabel={oppositeOutcomeLabel}
                        onShuffle={() => {
                          setActiveOutcomeIndex(oppositeOutcomeIndex)
                          setCursorSnapshot(null)
                        }}
                        showMarketSelector={!isSingleMarket}
                        marketOptions={marketOptions}
                        selectedMarketIds={selectedMarketIds}
                        maxSeriesCount={maxSeriesCount}
                        onToggleMarket={handleToggleMarket}
                        settings={chartSettings}
                        onSettingsChange={setChartSettings}
                        onExportData={() => setExportDialogOpen(true)}
                        onEmbed={() => setEmbedDialogOpen(true)}
                      />
                    )
                  : null}
              </div>
            )
          : undefined}
      />
      <EventChartExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        eventCreatedAt={event.created_at}
        markets={event.markets}
        isMultiMarket={event.total_markets_count > 1}
      />
      <EventChartEmbedDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        markets={event.markets}
        initialMarketId={primaryMarket?.condition_id ?? null}
      />
    </>
  )
}

function areChartPropsEqual(prev: EventChartProps, next: EventChartProps) {
  if (prev.isMobile !== next.isMobile) {
    return false
  }
  if ((prev.showControls ?? true) !== (next.showControls ?? true)) {
    return false
  }
  if ((prev.showSeriesNavigation ?? true) !== (next.showSeriesNavigation ?? true)) {
    return false
  }
  if (prev.event.id !== next.event.id) {
    return false
  }
  if (prev.event.updated_at !== next.event.updated_at) {
    return false
  }

  return buildMarketSignature(prev.event) === buildMarketSignature(next.event)
}
export default memo(EventChartComponent, areChartPropsEqual)

// trigger HMR
