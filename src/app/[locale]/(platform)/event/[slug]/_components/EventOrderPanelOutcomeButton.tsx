'use client'

import type { OddsFormat } from '@/lib/odds-format'
import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EventOrderPanelOutcomeButtonProps {
  variant: 'yes' | 'no'
  price: number | null
  label: string
  isSelected: boolean
  onSelect: () => void
  oddsFormat?: OddsFormat
  styleVariant?: 'default' | 'sports3d'
}

export default function EventOrderPanelOutcomeButton({
  variant,
  price,
  label,
  isSelected,
  onSelect,
  oddsFormat,
  styleVariant,
}: EventOrderPanelOutcomeButtonProps) {
  // Multiplicador: preço 0.20 → 5.00x
  const rawMultiplier = price && price > 0 ? 1 / price : 1
  const multiplier = rawMultiplier.toFixed(2)

  const isYes = variant === 'yes'

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        backgroundColor: isSelected ? (isYes ? '#10b981' : '#f43f5e') : undefined,
        boxShadow: isSelected ? `0 0 20px ${isYes ? 'rgba(16,185,129,0.35)' : 'rgba(244,63,94,0.35)'}` : undefined,
      }}
      className={cn(
        // Base: pílula horizontal, h-12
        'relative flex h-12 w-full flex-1 items-center justify-center overflow-hidden rounded-[14px] px-2 transition-all duration-200 active:scale-[0.98]',
        // Estado SIM
        isYes && !isSelected && 'bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-500/40',
        // Estado NÃO
        !isYes && !isSelected && 'bg-rose-500/10 border border-transparent hover:bg-rose-500/20 hover:border-rose-500/40',
      )}
    >
      <span
        className={cn(
          'text-[15px] font-bold tracking-tight',
          isSelected ? 'text-white' : (isYes ? 'text-emerald-400' : 'text-rose-500/80'),
        )}
      >
        {label} <span className="font-medium opacity-90">({multiplier}x)</span>
      </span>
    </button>
  )
}
