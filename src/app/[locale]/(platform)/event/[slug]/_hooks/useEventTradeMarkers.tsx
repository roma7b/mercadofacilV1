'use client'

import type { Event, Market } from '@/types'
import type { PredictionChartAnnotationMarker } from '@/types/PredictionChartTypes'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { OUTCOME_INDEX } from '@/lib/constants'
import { fetchEventTrades } from '@/lib/data-api/trades'
import { fromMicro } from '@/lib/formatters'

interface UseEventTradeMarkersProps {
  event: Event
  markerConditionIds: string[]
  showBothOutcomes: boolean
  enabled?: boolean
}

export function useEventTradeMarkers({
  event,
  markerConditionIds,
  showBothOutcomes,
  enabled = true,
}: UseEventTradeMarkersProps) {
  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['event-all-trade-markers', event.id, markerConditionIds],
    queryFn: ({ signal }) => fetchEventTrades({
      marketIds: markerConditionIds,
      pageParam: 0,
      signal,
    }),
    enabled: enabled && markerConditionIds.length > 0,
    staleTime: 30000,
    refetchInterval: 10000, // Refetch every 10s to keep it alive
  })

  const markers = useMemo<PredictionChartAnnotationMarker[]>(() => {
    if (!trades.length) { return [] }

    return trades.map((trade, index) => {
      const conditionId = trade.market.condition_id
      const createdAtTimestamp = new Date(trade.created_at).getTime()
      const rawPrice = Number(trade.price)
      const outcomeIndex = Number(trade.outcome.index)

      const isYesOutcome = outcomeIndex === OUTCOME_INDEX.YES

      // Normalização de preço para o gráfico (0-100)
      const normalizedLineValue = showBothOutcomes
        ? rawPrice * 100
        : (outcomeIndex === OUTCOME_INDEX.NO ? (1 - rawPrice) * 100 : rawPrice * 100)

      const sharesValue = Number.parseFloat(fromMicro(trade.amount, 2))
      const markerColor = isYesOutcome ? 'var(--color-yes)' : 'var(--color-no)'

      return {
        id: `all-trade-${trade.id}-${index}`,
        date: new Date(createdAtTimestamp),
        value: normalizedLineValue,
        color: markerColor,
        radius: 2.5, // Dot menor para não poluir muito
        tooltipContent: (
          <div className="flex items-center gap-1.5 text-2xs whitespace-nowrap">
            <span className="font-bold">{trade.side === 'buy' ? 'BUY' : 'SELL'}</span>
            <span>
              {sharesValue.toFixed(0)}
              {' '}
              shares
            </span>
            <span className="text-muted-foreground">@</span>
            <span className="font-mono">
              {(rawPrice * 100).toFixed(0)}
              ¢
            </span>
          </div>
        ),
      }
    })
  }, [trades, showBothOutcomes])

  return { markers, isLoading }
}
