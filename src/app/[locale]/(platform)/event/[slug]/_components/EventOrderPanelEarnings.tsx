import type { OrderSide } from '@/types'
import { useExtracted } from 'next-intl'
import { ORDER_SIDE } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface EventOrderPanelEarningsProps {
  side: OrderSide
  sellAmountLabel: string
  avgSellPriceLabel: string
  avgBuyPriceLabel: string
  avgSellPriceCents: number | null
  avgBuyPriceCents: number | null
  buyPayout: number
  buyMultiplier: number
}

export default function EventOrderPanelEarnings({
  side,
  sellAmountLabel,
  avgSellPriceLabel,
  avgBuyPriceLabel,
  buyPayout,
  buyMultiplier,
}: EventOrderPanelEarningsProps) {
  const t = useExtracted()

  const isBuy = side === ORDER_SIDE.BUY
  const buyToWinLabel = formatCurrency(Math.max(0, buyPayout))

  const avgPrice = isBuy ? avgBuyPriceLabel : avgSellPriceLabel

  return (
    <div className="mt-2 flex flex-col px-1">
      <div className="flex items-center justify-between">
        {/* Lado Esquerdo - Ícone e Texto */}
        <div className="flex flex-col">
          <span className="text-[15px] font-bold text-foreground tracking-wide">
            {isBuy ? t('Para ganhar 💰') : t('Preço Médio')}
          </span>
          <span className="text-[12px] font-medium text-muted-foreground">
            {isBuy ? `${buyMultiplier.toFixed(2)}x` : avgPrice}
          </span>
        </div>

        {/* Lado Direito - Valores */}
        <div className="flex items-center justify-end">
          <span className={cn(
            'text-[22px] font-black tracking-tight',
            isBuy ? 'text-emerald-500' : 'text-foreground',
          )}
          >
            {isBuy ? buyToWinLabel : sellAmountLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
