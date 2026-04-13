'use client'

import type { OrderSide, OrderType } from '@/types'
import { useExtracted } from 'next-intl'
import { useEffect, useRef } from 'react'
import { ORDER_SIDE, ORDER_TYPE } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface EventOrderPanelBuySellTabsProps {
  side: OrderSide
  onSideChange: (side: OrderSide) => void
  onTypeChange: (type: OrderType) => void
  onAmountReset: () => void
  onFocusInput: () => void
}

export default function EventOrderPanelBuySellTabs({
  side,
  onSideChange,
  onTypeChange,
  onAmountReset,
  onFocusInput,
}: EventOrderPanelBuySellTabsProps) {
  const t = useExtracted()
  const hasHydratedTypeRef = useRef(false)

  // Forçar sempre MARKET para simplificar o modelo Brasil
  useEffect(() => {
    if (hasHydratedTypeRef.current) return
    hasHydratedTypeRef.current = true
    onTypeChange(ORDER_TYPE.MARKET)
  }, [onTypeChange])

  function handleSideChange(nextSide: OrderSide) {
    onSideChange(nextSide)
    onAmountReset()
    onFocusInput()
  }

  const tabs = [
    { id: ORDER_SIDE.BUY, label: t('Buy') || 'Comprar' },
    { id: ORDER_SIDE.SELL, label: t('Sell') || 'Vender' },
  ]

  return (
    <div className="mt-4 mb-2 border-b border-white/5 pb-0">
      <div className="flex gap-6">
        {tabs.map((tab) => {
          const isActive = side === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSideChange(tab.id as OrderSide)}
              className={cn(
                'relative pb-2 text-[14px] font-bold capitalize transition-all duration-200 border-b-2',
                isActive
                  ? 'text-white border-white'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
