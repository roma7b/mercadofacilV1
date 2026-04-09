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
  inputRef: RefObject<HTMLInputElement | null>
  onAmountChange: (value: string) => void
  shouldShake?: boolean
}

const BUY_CHIPS = ['+10', '+50', '+100', '+500']

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
      return
    }

    const maxBalance = Number.isFinite(balance.raw) ? balance.raw : 0
    const limitedBalance = Math.min(maxBalance, MAX_AMOUNT_INPUT)
    onAmountChange(formatAmountInputValue(limitedBalance, { roundingMode: 'floor' }))
    focusInput()
  }

  function renderActionButtons() {
    if (side === ORDER_SIDE.SELL) {
      const isDisabled = availableShares <= 0
      return ['25%', '50%', '75%'].map(percentage => (
        <Button
          type="button"
          key={percentage}
          size="sm"
          variant="outline"
          className={cn(
            'text-xs rounded-lg',
            { 'cursor-not-allowed opacity-50': isDisabled },
          )}
          disabled={isDisabled}
          onClick={() => {
            if (isDisabled) {
              return
            }

            const percentValue = Number.parseInt(percentage.replace('%', ''), 10) / 100
            const newValue = availableShares * percentValue
            onAmountChange(formatAmountInputValue(newValue))
            focusInput()
          }}
        >
          {percentage}
        </Button>
      ))
    }

    return BUY_CHIPS.map(chip => (
      <Button
        type="button"
        key={chip}
        size="sm"
        variant="outline"
        className="px-2 text-xs rounded-lg"
        onClick={() => {
          const chipValue = Number.parseInt(chip.substring(1), 10)
          const newValue = amountNumber + chipValue

          const limitedValue = Math.min(newValue, MAX_AMOUNT_INPUT)
          onAmountChange(formatAmountInputValue(limitedValue))
          focusInput()
        }}
      >
        {chip}
      </Button>
    ))
  }

  const locale = useLocale()
  const amountSizeClass = getAmountSizeClass(amount)
  const formattedBalanceText = Number.isFinite(balance.raw)
    ? balance.raw.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'

  const formattedAmount = formatDisplayAmount(amount)
  
  return (
    <>
      {isMobile
        ? (
            <div className="mb-4">
              <div className="mb-4 flex items-center justify-center gap-4">
                <Button
                  type="button"
                  onClick={() => decrementAmount(side === ORDER_SIDE.SELL ? 0.1 : 1)}
                  size="icon"
                  variant="ghost"
                  className="size-10 rounded-full bg-muted/20"
                >
                  −
                </Button>
                <div className="flex-1 text-center bg-muted/10 rounded-2xl py-2 shadow-inner border border-white/5 relative">
                   {side !== ORDER_SIDE.SELL && (
                     <span className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground font-black opacity-30">R$</span>
                   )}
                  <input
                    ref={inputRef}
                    type="text"
                    className={cn(
                      `
                        w-full [appearance:textfield] border-0 bg-transparent text-center font-black text-foreground
                        placeholder-muted-foreground/30 outline-hidden
                        [&::-webkit-inner-spin-button]:appearance-none
                        [&::-webkit-outer-spin-button]:appearance-none
                      `,
                      amountSizeClass,
                      { 'animate-order-shake': shouldShake },
                    )}
                    placeholder="0"
                    value={formattedAmount}
                    onChange={e => handleInputChange(e.target.value)}
                    onBlur={e => handleBlur(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => incrementAmount(side === ORDER_SIDE.SELL ? 0.1 : 1)}
                  size="icon"
                  variant="ghost"
                  className="size-10 rounded-full bg-muted/20"
                >
                  +
                </Button>
              </div>
            </div>
          )
        : (
            <div className="mb-4 flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {side === ORDER_SIDE.SELL ? t('Cotas para Venda') : t('Valor da Aposta')}
                </div>
                <div className="text-[10px] font-bold text-muted-foreground/60">
                  {side === ORDER_SIDE.SELL
                    ? null
                    : isBalanceLoading
                      ? <Skeleton className="inline-block h-3 w-16 align-middle" />
                      : (
                          <button
                            type="button"
                            className="cursor-pointer hover:text-foreground transition-colors"
                            onClick={handleBalanceClick}
                          >
                            {t('Saldo')}: {areValuesHidden ? '****' : `R$${formattedBalanceText}`}
                          </button>
                        )}
                </div>
              </div>
              <div className="relative flex items-center bg-muted/20 rounded-2xl px-4 border border-white/5 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-muted/30">
                {side !== ORDER_SIDE.SELL && (
                    <span className="text-xl font-black text-muted-foreground opacity-30 select-none mr-2">R$</span>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  className={cn(
                    `
                      h-16 w-full [appearance:textfield] border-0 bg-transparent text-right font-black text-foreground
                      placeholder-muted-foreground/20 outline-hidden
                      [&::-webkit-inner-spin-button]:appearance-none
                      [&::-webkit-outer-spin-button]:appearance-none
                    `,
                    amountSizeClass,
                    { 'animate-order-shake': shouldShake },
                  )}
                  placeholder="0"
                  value={formattedAmount}
                  onChange={e => handleInputChange(e.target.value)}
                  onBlur={e => handleBlur(e.target.value)}
                />
              </div>
            </div>
          )}

      <div
        className={cn(
          'mb-4 flex gap-2',
          isMobile ? 'justify-center' : 'justify-end',
        )}
      >
        <div className="flex gap-1.5 bg-muted/10 p-1 rounded-xl border border-white/5">
            {renderActionButtons()}
            <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
                'text-[10px] font-black uppercase tracking-wider px-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-all',
                { 'cursor-not-allowed opacity-50': side === ORDER_SIDE.SELL && availableShares <= 0 },
            )}
            disabled={side === ORDER_SIDE.SELL && availableShares <= 0}
            onClick={() => {
                if (side === ORDER_SIDE.SELL) {
                if (availableShares <= 0) {
                    return
                }
                onAmountChange(formatAmountInputValue(availableShares, { roundingMode: 'floor' }))
                }
                else {
                const maxBalance = balance.raw
                const limitedBalance = Math.min(maxBalance, MAX_AMOUNT_INPUT)
                onAmountChange(formatAmountInputValue(limitedBalance, { roundingMode: 'floor' }))
                }
                focusInput()
            }}
            >
            {t('Max')}
            </Button>
        </div>
      </div>
    </>
  )
}
