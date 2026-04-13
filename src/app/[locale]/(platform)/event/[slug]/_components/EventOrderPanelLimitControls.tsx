import type { RefObject } from 'react'
import type { LimitExpirationOption } from '@/stores/useOrder'
import type { OrderSide } from '@/types'
import { InfoIcon, TriangleAlertIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import EventLimitExpirationCalendar from '@/app/[locale]/(platform)/event/[slug]/_components/EventLimitExpirationCalendar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/number-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useBalance } from '@/hooks/useBalance'
import { formatDisplayAmount, getAmountSizeClass, MAX_AMOUNT_INPUT, sanitizeNumericInput } from '@/lib/amount-input'
import { ORDER_SIDE } from '@/lib/constants'
import { formatAmountInputValue, formatCurrency, formatSharesLabel } from '@/lib/formatters'
import { MIN_LIMIT_ORDER_SHARES } from '@/lib/orders/validation'
import { cn } from '@/lib/utils'
import { usePortfolioValueVisibility } from '@/stores/usePortfolioValueVisibility'

const QUICK_BUTTON_CLASS = `
  h-8 rounded-md bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors
  hover:bg-muted/80
`

const BUY_CHIPS = [-100, -10, 10, 100]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function resolveDraftExpirationFromNow() {
  const nextDate = new Date(Date.now())
  nextDate.setMinutes(nextDate.getMinutes() + 30, 0, 0)
  return nextDate
}

interface EventOrderPanelLimitControlsProps {
  side: OrderSide
  limitPrice: string
  limitShares: string
  limitExpirationEnabled: boolean
  limitExpirationOption: LimitExpirationOption
  limitExpirationTimestamp: number | null
  isLimitOrder: boolean
  matchingShares?: number | null
  availableShares: number
  showLimitMinimumWarning: boolean
  shouldShakeShares?: boolean
  limitSharesRef?: RefObject<HTMLInputElement | null>
  onLimitPriceChange: (value: string) => void
  onLimitSharesChange: (value: string) => void
  onLimitExpirationEnabledChange: (value: boolean) => void
  onLimitExpirationOptionChange: (value: LimitExpirationOption) => void
  onLimitExpirationTimestampChange: (value: number | null) => void
  onAmountUpdateFromLimit: (value: string) => void
}

export default function EventOrderPanelLimitControls({
  side,
  limitPrice,
  limitShares,
  limitExpirationEnabled,
  limitExpirationOption,
  limitExpirationTimestamp,
  isLimitOrder,
  matchingShares,
  availableShares,
  showLimitMinimumWarning,
  shouldShakeShares,
  limitSharesRef,
  onLimitPriceChange,
  onLimitSharesChange,
  onLimitExpirationEnabledChange,
  onLimitExpirationOptionChange,
  onLimitExpirationTimestampChange,
  onAmountUpdateFromLimit,
}: EventOrderPanelLimitControlsProps) {
  const t = useExtracted()
  const { balance } = useBalance()
  const areValuesHidden = usePortfolioValueVisibility(state => state.isHidden)
  const limitPriceNumber = useMemo(
    () => Number.parseFloat(limitPrice) || 0,
    [limitPrice],
  )

  const limitSharesNumber = useMemo(
    () => Number.parseFloat(limitShares) || 0,
    [limitShares],
  )

  const totalValue = useMemo(() => {
    const total = (limitPriceNumber * limitSharesNumber) / 100
    return Number.isFinite(total) ? total : 0
  }, [limitPriceNumber, limitSharesNumber])

  const effectivePriceDollars = Number.isFinite(limitPriceNumber) && limitPriceNumber > 0
    ? limitPriceNumber / 100
    : null
  const decimalOdds = effectivePriceDollars ? 1 / effectivePriceDollars : null
  const americanOdds = (() => {
    if (!decimalOdds || decimalOdds <= 0) {
      return null
    }
    if (decimalOdds === 1) {
      return null
    }
    if (decimalOdds >= 2) {
      return (decimalOdds - 1) * 100
    }
    return -100 / (decimalOdds - 1)
  })()

  const potentialWin = useMemo(() => {
    if (limitSharesNumber <= 0) {
      return 0
    }

    if (side === ORDER_SIDE.SELL) {
      const total = (limitPriceNumber * limitSharesNumber) / 100
      return Number.isFinite(total) ? total : 0
    }

    return Number.isFinite(limitSharesNumber) ? limitSharesNumber : 0
  }, [limitPriceNumber, limitSharesNumber, side])

  const maxSharesForSide = MAX_AMOUNT_INPUT

  const locale = useLocale()
  const totalValueLabel = formatCurrency(totalValue)
  const safeTotalValueLabel = totalValueLabel.trim() ? totalValueLabel : '0'
  const americanOddsLabel = americanOdds != null
    ? `${americanOdds >= 0 ? '+' : ''}${americanOdds.toFixed(1)}`
    : '0'
  const decimalOddsLabel = decimalOdds != null ? decimalOdds.toFixed(3) : '0'
  const potentialWinLabel = formatCurrency(potentialWin)
  const showMinimumSharesWarning = showLimitMinimumWarning && isLimitOrder && limitSharesNumber < MIN_LIMIT_ORDER_SHARES
  const formattedBalanceText = Number.isFinite(balance?.raw)
    ? (balance?.raw ?? 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'
  const maxLabel = t('Max')
  const matchingSharesLabel = matchingShares && matchingShares > 0
    ? formatSharesLabel(matchingShares)
    : null
  const [isExpirationModalOpen, setIsExpirationModalOpen] = useState(false)
  const [draftExpiration, setDraftExpiration] = useState<Date | null>(
    () => limitExpirationTimestamp ? new Date(limitExpirationTimestamp * 1000) : null,
  )
  const customExpirationLabel = useMemo(() => {
    if (!limitExpirationTimestamp) {
      return null
    }
    const date = new Date(limitExpirationTimestamp * 1000)
    return date.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [limitExpirationTimestamp, locale])

  function syncAmount(priceValue: number, sharesValue: number) {
    if (!isLimitOrder) {
      return
    }

    const nextAmount = (priceValue * sharesValue) / 100
    onAmountUpdateFromLimit(formatAmountInputValue(nextAmount))
  }

  function handleLimitSharesInputChange(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)

    if (cleaned === '') {
      onLimitSharesChange('')
      syncAmount(limitPriceNumber, 0)
      return
    }

    const numericValue = Number.parseFloat(cleaned)
    if (Number.isNaN(numericValue)) {
      onLimitSharesChange('')
      syncAmount(limitPriceNumber, 0)
      return
    }

    if (numericValue > maxSharesForSide) {
      const clamped = Math.min(numericValue, maxSharesForSide)
      onLimitSharesChange(formatAmountInputValue(clamped))
      syncAmount(limitPriceNumber, clamped)
      return
    }

    // Preserve the raw decimal typing state (e.g. `1.`) and normalize on blur.
    onLimitSharesChange(cleaned)
    syncAmount(limitPriceNumber, numericValue)
  }

  function handleLimitSharesBlur(rawValue: string) {
    const cleaned = sanitizeNumericInput(rawValue)
    const numericValue = Number.parseFloat(cleaned)

    if (!cleaned || Number.isNaN(numericValue)) {
      onLimitSharesChange('')
      syncAmount(limitPriceNumber, 0)
      return
    }

    const clamped = Math.min(numericValue, maxSharesForSide)
    onLimitSharesChange(formatAmountInputValue(clamped))
    syncAmount(limitPriceNumber, clamped)
  }

  function updateLimitPrice(nextValue: number) {
    const clampedValue = clamp(Number.isNaN(nextValue) ? 0 : nextValue, 0, 99.9)
    const nextPrice = clampedValue.toFixed(1)
    onLimitPriceChange(nextPrice)
    syncAmount(clampedValue, Number.parseFloat(limitShares) || 0)
  }

  function updateLimitShares(nextValue: number, roundingMode: 'round' | 'floor' = 'round') {
    const numericValue = Number.isNaN(nextValue) ? 0 : nextValue
    const clampedValue = clamp(numericValue, 0, maxSharesForSide)
    onLimitSharesChange(formatAmountInputValue(clampedValue, { roundingMode }))
    syncAmount(Number.parseFloat(limitPrice) || 0, clampedValue)
  }

  const formattedLimitShares = formatDisplayAmount(limitShares)
  const limitSharesSizeClass = getAmountSizeClass(limitShares, {
    large: 'text-lg',
    medium: 'text-base',
    small: 'text-sm',
  })
  useEffect(() => {
    if (limitExpirationTimestamp) {
      setDraftExpiration(new Date(limitExpirationTimestamp * 1000))
      return
    }

    setDraftExpiration(resolveDraftExpirationFromNow())
  }, [limitExpirationTimestamp])

  function openExpirationModal() {
    if (!draftExpiration) {
      setDraftExpiration(resolveDraftExpirationFromNow())
    }
    setIsExpirationModalOpen(true)
  }

  function handleExpirationModalChange(open: boolean) {
    setIsExpirationModalOpen(open)
  }

  function handleApplyExpiration() {
    if (!draftExpiration) {
      return
    }

    if (draftExpiration.getTime() <= Date.now()) {
      toast.error(t('Expiration must be in future. Try again'))
      return
    }

    const timestampSeconds = Math.floor(draftExpiration.getTime() / 1000)
    onLimitExpirationTimestampChange(timestampSeconds)
    setIsExpirationModalOpen(false)
  }

  return (
    <div className="mt-4 space-y-6">
      {/* Input de Preço Limite */}
      <div className="
        group relative flex items-center justify-between rounded-2xl border border-white/5 bg-zinc-900/40 p-4
        transition-all
        focus-within:border-emerald-500/30 focus-within:bg-zinc-900/60
      "
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs font-black tracking-[0.2em] text-zinc-500 uppercase">
            {t('Limit Price')}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-emerald-500">R$</span>
            <span className="text-xs font-bold text-zinc-400">
              {side === ORDER_SIDE.BUY ? (areValuesHidden ? '****' : formattedBalanceText) : t('Venda')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="font-mono text-2xl font-black tracking-tighter text-white">
            {limitPriceNumber.toFixed(1)}
            %
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => updateLimitPrice(limitPriceNumber + 0.1)}
              className="rounded-sm bg-white/5 p-1 transition-colors hover:bg-white/10"
            >
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="rotate-180"><path d="M1 1L5 5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
            <button
              type="button"
              onClick={() => updateLimitPrice(limitPriceNumber - 0.1)}
              className="rounded-sm bg-white/5 p-1 transition-colors hover:bg-white/10"
            >
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Input de Cotas (Shares) */}
      <div className="space-y-3">
        <div className={cn(
          `
            group relative flex flex-col rounded-2xl border border-white/5 bg-zinc-900/40 p-4 transition-all
            focus-within:border-emerald-500/30 focus-within:bg-zinc-900/60
          `,
          { 'animate-order-shake border-rose-500/50': shouldShakeShares },
        )}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-2xs font-black tracking-[0.2em] text-zinc-500 uppercase">
              {t('Shares to buy')}
            </span>
            <div className="text-2xs font-bold text-zinc-600">
              {t('Available')}
              :
              {formatSharesLabel(availableShares)}
            </div>
          </div>

          <input
            ref={limitSharesRef}
            placeholder="0"
            inputMode="decimal"
            value={formattedLimitShares}
            onChange={event => handleLimitSharesInputChange(event.target.value)}
            onBlur={event => handleLimitSharesBlur(event.target.value)}
            className="
              w-full border-0 bg-transparent p-0 font-mono text-3xl font-black tracking-tighter text-white outline-none
              placeholder:text-white/5
            "
          />
        </div>

        {/* Botões Rápidos de Ajuste */}
        <div className="grid grid-cols-4 gap-2">
          {side === ORDER_SIDE.SELL
            ? (['25%', '50%', '75%', 'MAX'].map((value) => {
                const label = value
                return (
                  <button
                    type="button"
                    key={value}
                    className="
                      rounded-xl border border-white/5 bg-zinc-900/60 py-2.5 text-2xs font-black tracking-widest
                      text-zinc-500 uppercase transition-all
                      hover:border-white/20 hover:text-white
                    "
                    onClick={() => {
                      if (availableShares <= 0) { return }
                      if (value === 'MAX') {
                        updateLimitShares(availableShares, 'floor')
                        return
                      }
                      const percent = Number.parseInt(label.replace('%', ''), 10) / 100
                      const calculatedShares = Number.parseFloat((availableShares * percent).toFixed(2))
                      updateLimitShares(calculatedShares)
                    }}
                  >
                    {label}
                  </button>
                )
              }))
            : (BUY_CHIPS.map((chip) => {
                const label = chip > 0 ? `+${chip}` : `${chip}`
                return (
                  <button
                    type="button"
                    key={chip}
                    className="
                      rounded-xl border border-white/5 bg-zinc-900/60 py-2.5 font-mono text-2xs font-black text-zinc-500
                      transition-all
                      hover:border-white/20 hover:text-white
                    "
                    onClick={() => updateLimitShares(limitSharesNumber + chip)}
                  >
                    {label}
                  </button>
                )
              }))}
        </div>
        {matchingSharesLabel && (
          <div className="mt-2 ml-auto flex w-1/2 justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`
                    inline-flex items-center gap-1 rounded-md bg-yes/15 p-1 text-xs font-semibold text-yes-foreground
                    transition-colors
                  `}
                >
                  <InfoIcon className="size-3" aria-hidden />
                  <span>{t('{shares} matching', { shares: matchingSharesLabel })}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-48" side="bottom">
                {t('{shares} shares from this order will be executed immediatelly', { shares: matchingSharesLabel })}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      <div className="my-4 border-b border-border" />

      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
          <span>{t('Set Expiration')}</span>
          <Switch
            checked={limitExpirationEnabled}
            onCheckedChange={(checked) => {
              onLimitExpirationEnabledChange(checked)
              if (!checked) {
                onLimitExpirationOptionChange('end-of-day')
                onLimitExpirationTimestampChange(null)
              }
            }}
          />
        </div>

        {limitExpirationEnabled && (
          <div className="space-y-3">
            <Select
              value={limitExpirationOption}
              onValueChange={(value) => {
                const nextValue = value as LimitExpirationOption
                onLimitExpirationOptionChange(nextValue)

                if (nextValue === 'custom') {
                  openExpirationModal()
                }
                else {
                  onLimitExpirationTimestampChange(null)
                }
              }}
            >
              <SelectTrigger className="w-full justify-between bg-background text-sm font-medium">
                <SelectValue placeholder={t('Select expiration')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="end-of-day">{t('End of Day')}</SelectItem>
                <SelectItem value="custom">{t('Custom')}</SelectItem>
              </SelectContent>
            </Select>

            {limitExpirationOption === 'custom' && (
              <div className={`
                flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground
              `}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">{t('Custom expiration')}</span>
                  <span>{customExpirationLabel ?? t('Select a date and time to apply.')}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={openExpirationModal}
                >
                  {t('Edit')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1">
        {side === ORDER_SIDE.SELL
          ? (
              <div className="flex items-center justify-between text-lg font-bold text-foreground">
                <span>{t('You\'ll receive')}</span>
                <span className="inline-flex items-center gap-2 text-xl font-bold text-yes">
                  <Image
                    src="/images/trade/money.svg"
                    alt=""
                    width={20}
                    height={14}
                    className="h-4 w-6"
                  />
                  {potentialWinLabel}
                </span>
              </div>
            )
          : (
              <>
                <div className="flex items-center justify-between text-lg font-bold text-foreground">
                  <span>{t('Total')}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="border-b border-dotted border-primary font-semibold text-primary">
                        {safeTotalValueLabel}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="w-52 p-3"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-1.5 rounded-full bg-blue-500" />
                            <span>{t('Price')}</span>
                          </div>
                          <span className="text-base font-bold">
                            {limitPriceNumber.toFixed(1)}
                            %
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-1.5 rounded-full bg-amber-400" />
                            <span>{t('American')}</span>
                          </div>
                          <span className="text-base font-bold">
                            {americanOddsLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-1.5 rounded-full bg-yes" />
                            <span>{t('Decimal')}</span>
                          </div>
                          <span className="text-base font-bold">
                            {decimalOddsLabel}
                          </span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center justify-between text-lg font-bold">
                  <span className="flex items-center gap-2 text-foreground">
                    {t('To win')}
                    <Image
                      src="/images/trade/money.svg"
                      alt=""
                      width={20}
                      height={14}
                      className="h-4 w-6"
                    />
                  </span>
                  <span className="text-xl font-bold text-yes">
                    {potentialWinLabel}
                  </span>
                </div>
              </>
            )}
      </div>
      {showMinimumSharesWarning && (
        <div className="flex items-center justify-center gap-2 pt-2 text-sm font-semibold text-orange-500">
          <TriangleAlertIcon className="size-4" />
          {t('Minimum {min} shares for limit orders', { min: MIN_LIMIT_ORDER_SHARES.toString() })}
        </div>
      )}

      <Dialog open={isExpirationModalOpen} onOpenChange={handleExpirationModalChange}>
        <DialogContent className="w-fit border-0 bg-transparent p-0 shadow-none">
          {isExpirationModalOpen && (
            <EventLimitExpirationCalendar
              title={t('Select expiration')}
              value={draftExpiration ?? undefined}
              onChange={(nextDate) => {
                if (nextDate) {
                  setDraftExpiration(nextDate)
                }
              }}
              onCancel={() => setIsExpirationModalOpen(false)}
              onApply={handleApplyExpiration}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
