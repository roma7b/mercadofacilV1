import type { OddsFormat } from '@/lib/odds-format'
import { Button } from '@/components/ui/button'
import { formatCentsLabel } from '@/lib/formatters'
import { formatOddsFromPrice } from '@/lib/odds-format'
import { cn } from '@/lib/utils'

interface EventOrderPanelOutcomeButtonProps {
  variant: 'yes' | 'no'
  price: number | null
  label: string
  isSelected: boolean
  oddsFormat?: OddsFormat
  styleVariant?: 'default' | 'sports3d'
  onSelect: () => void
}

export default function EventOrderPanelOutcomeButton({
  variant,
  price,
  label,
  isSelected,
  oddsFormat = 'price',
  styleVariant = 'default',
  onSelect,
}: EventOrderPanelOutcomeButtonProps) {
  const useSportsDepth = styleVariant === 'sports3d'
  const priceLabel = oddsFormat === 'price'
    ? formatCentsLabel(price)
    : formatOddsFromPrice(price, oddsFormat)

  if (useSportsDepth) {
    // Keep internal sports3d logic if needed, but for poly- events we use default
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="outcomeLg"
      className={cn(
        "flex flex-col items-center justify-center h-14 rounded-xl border-2 transition-all duration-200",
        variant === 'yes' 
          ? isSelected 
            ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20" 
            : "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10"
          : isSelected 
            ? "bg-red-500 border-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20" 
            : "bg-red-500/5 border-red-500/20 text-red-600 hover:bg-red-500/10"
      )}
      onClick={onSelect}
    >
      <span className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-0.5">
        {label}
      </span>
      <span className="text-lg font-black font-mono">
        {priceLabel}
      </span>
    </Button>
  )
}
