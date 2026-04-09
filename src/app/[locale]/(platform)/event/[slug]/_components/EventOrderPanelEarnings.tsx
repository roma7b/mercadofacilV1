import type { OrderSide } from '@/types'
import { useExtracted } from 'next-intl'
import { ORDER_SIDE } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EventOrderPanelEarningsProps {
  isMobile: boolean
  side: OrderSide
  sellAmountLabel: string
  avgSellPriceLabel: string
  avgBuyPriceLabel: string
  avgSellPriceCents: number | null
  avgBuyPriceCents: number | null
  buyPayout: number
  buyProfit: number
  buyChangePct: number
  buyMultiplier: number
}

export default function EventOrderPanelEarnings({
  isMobile: _isMobile,
  side,
  sellAmountLabel,
  avgSellPriceLabel,
  avgBuyPriceLabel,
  buyPayout,
  buyProfit,
  buyChangePct,
}: EventOrderPanelEarningsProps) {
  const t = useExtracted()
  
  const isBuy = side === ORDER_SIDE.BUY
  const buyToWinLabel = formatCurrency(Math.max(0, buyPayout))
  const buyProfitLabel = formatCurrency(buyProfit)
  const buyChangeLabel = `${buyChangePct >= 0 ? '+' : ''}${Math.abs(buyChangePct).toFixed(0)}%`

  const avgPrice = isBuy ? avgBuyPriceLabel : avgSellPriceLabel

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {isBuy ? 'Para ganhar' : 'Você receberá'}
          </span>
          <span className="text-xs font-bold text-foreground/70">
            {`Preço Médio ${avgPrice}`}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className={cn(
            "text-2xl font-black font-mono tracking-tighter",
            isBuy ? "text-emerald-500 dark:text-emerald-400" : "text-foreground"
          )}>
            {isBuy ? buyToWinLabel : sellAmountLabel}
          </span>
          
          {isBuy && buyProfit > 0 && (
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400">
                +{buyProfitLabel} Lucro
              </span>
              <span className="text-[10px] font-black text-emerald-500/70 dark:text-emerald-500/50">
                {buyChangeLabel}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
