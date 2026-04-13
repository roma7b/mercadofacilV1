'use client'

import type { RefObject } from 'react'
import type { OrderSide } from '@/types'
import { useExtracted, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDisplayAmount, getAmountSizeClass, MAX_AMOUNT_INPUT, sanitizeNumericInput } from '@/lib/amount-input'
import { ORDER_SIDE } from '@/lib/constants'
import { formatAmountInputValue } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { usePortfolioValueVisibility } from '@/stores/usePortfolioValueVisibility'
import { Minus, Plus } from 'lucide-react'

interface BalanceSummary {
  raw: number
  text: string
  symbol?: string
}

interface EventOrderPanelInputProps {
  isMobile: boolean
  side: OrderSide
  amount: string
  amountNumber: number
  availableShares: number
  balance: BalanceSummary
  isBalanceLoading?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  onAmountChange: (amount: string) => void
  shouldShake?: boolean
}

const BUY_CHIPS = ['1', '10', '50', '100', 'MÁX']

export default function EventOrderPanelInput({
  isMobile,
  side,
  amount,
  amountNumber,
  availableShares,
  balance,
  isBalanceLoading = false,
  inputRef,
  onAmountChange,
  shouldShake,
}: EventOrderPanelInputProps) {
  const t = useExtracted()
  const areValuesHidden = usePortfolioValueVisibility(state => state.isHidden)

  function focusInput() {
    inputRef?.current?.focus()
  }

  function handleInputChange(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)

    if (side === ORDER_SIDE.SELL) {
      onAmountChange(cleaned)
      return
    }

    const numericValue = Number.parseFloat(cleaned)

    if (cleaned === '' || numericValue <= MAX_AMOUNT_INPUT) {
      onAmountChange(cleaned)
    }
  }

  function handleBlur(value: string) {
    const cleaned = sanitizeNumericInput(value)
    const numeric = Number.parseFloat(cleaned)

    if (!cleaned || Number.isNaN(numeric)) {
      onAmountChange('')
      return
    }

    const clampedValue = side === ORDER_SIDE.SELL
      ? numeric
      : Math.min(numeric, MAX_AMOUNT_INPUT)

    onAmountChange(formatAmountInputValue(clampedValue))
  }

  function incrementAmount(delta: number) {
    const nextValue = amountNumber + delta

    if (side === ORDER_SIDE.SELL) {
      onAmountChange(formatAmountInputValue(nextValue))
      return
    }

    const limitedValue = Math.min(nextValue, MAX_AMOUNT_INPUT)
    onAmountChange(formatAmountInputValue(limitedValue))
  }

  function decrementAmount(delta: number) {
    const nextValue = Math.max(0, amountNumber - delta)
    onAmountChange(formatAmountInputValue(nextValue))
  }

  function handleBalanceClick() {
    if (side === ORDER_SIDE.SELL) {
      const maxAvailable = Number.isFinite(availableShares) ? availableShares : 0
      onAmountChange(formatAmountInputValue(maxAvailable, { roundingMode: 'floor' }))
    } else {
      const maxBalance = Number.isFinite(balance.raw) ? balance.raw : 0
      const limitedBalance = Math.min(maxBalance, MAX_AMOUNT_INPUT)
      onAmountChange(formatAmountInputValue(limitedBalance, { roundingMode: 'floor' }))
    }
    focusInput()
  }

  const locale = useLocale()
  const formattedBalanceText = Number.isFinite(balance.raw)
    ? balance.raw.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'

  const formattedAmount = formatDisplayAmount(amount)

  return (
    <div className="mb-3 flex flex-col gap-2">
      {/* Header Info: Quantia e Saldo */}
      <div className="flex flex-col px-1 mb-1">
        <span className="text-[13px] font-bold text-white tracking-wide">{t('Quantia')}</span>
        <button 
          type="button"
          onClick={handleBalanceClick}
          className="text-left text-[12px] font-medium text-white/40 hover:text-white transition-colors"
        >
          {side === ORDER_SIDE.SELL ? t('Minhas cotas') : t('Saldo')}: 
          <span className="ml-1">R$ {areValuesHidden ? '****' : (side === ORDER_SIDE.SELL ? availableShares.toFixed(2) : formattedBalanceText)}</span>
        </button>
      </div>

      {/* Main Input Component - Dashboard Style */}
      <div className={cn(
        "flex items-center gap-2 bg-[#212b36] rounded-xl p-1.5 border border-transparent",
        shouldShake && "animate-order-shake"
      )}>
        {/* Minus Button */}
        <button
          type="button"
          onClick={() => decrementAmount(1)}
          className="flex size-11 items-center justify-center rounded-lg bg-[#1e2836] text-white hover:bg-zinc-800 transition-all border border-white/5 active:scale-95"
        >
          <Minus className="size-5" strokeWidth={3} />
        </button>

        {/* Input Area */}
        <div className="flex flex-1 items-center justify-center gap-1 group">
          <span className="text-2xl font-black text-white/50">R$</span>
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent p-0 text-center text-3xl font-black text-white outline-none placeholder:text-zinc-600 appearance-none"
            placeholder="0"
            value={formattedAmount}
            onChange={e => handleInputChange(e.target.value)}
            onBlur={e => handleBlur(e.target.value)}
          />
        </div>

        {/* Plus Button */}
        <button
          type="button"
          onClick={() => incrementAmount(1)}
          className="flex size-11 items-center justify-center rounded-lg bg-[#1e2836] text-white hover:bg-zinc-800 transition-all border border-white/5 active:scale-95"
        >
          <Plus className="size-5" strokeWidth={3} />
        </button>
      </div>

      {/* Chips Selection */}
      <div className="flex items-center justify-center gap-2">
        {BUY_CHIPS.map(chip => (
          <button
            type="button"
            key={chip}
            className="
              min-w-[50px] px-3 py-1.5 rounded-full bg-[#1e2836] text-[11px] font-black 
              text-zinc-500 border border-white/5 hover:bg-[#2a3648] hover:text-white 
              transition-all active:scale-95
            "
            onClick={() => {
              if (chip === 'MÁX') {
                handleBalanceClick()
              } else {
                incrementAmount(Number.parseInt(chip, 10))
              }
              focusInput()
            }}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}
