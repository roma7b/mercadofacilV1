'use client'

import type { MouseEvent } from 'react'
import { useExtracted } from 'next-intl'
import { cn } from '@/lib/utils'

interface EventOrderPanelSubmitButtonProps {
  isLoading: boolean
  isDisabled: boolean
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  label?: string
  type?: 'button' | 'submit'
  /** 'yes' = verde, 'no' = vermelho */
  outcomeVariant?: 'yes' | 'no' | null
}

const VARIANT_STYLES: Record<string, { background: string, shadow: string, glow: string }> = {
  yes: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    shadow: 'rgba(16,185,129,0.4)',
    glow: 'rgba(16,185,129,0.2)',
  },
  no: {
    background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    shadow: 'rgba(244,63,94,0.4)',
    glow: 'rgba(244,63,94,0.2)',
  },
  default: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    shadow: 'rgba(59,130,246,0.3)',
    glow: 'rgba(59,130,246,0.1)',
  },
}

export default function EventOrderPanelSubmitButton({
  isLoading,
  isDisabled,
  onClick,
  label,
  type = 'submit',
  outcomeVariant,
}: EventOrderPanelSubmitButtonProps) {
  const t = useExtracted()

  const variantKey = outcomeVariant === 'yes' ? 'yes' : outcomeVariant === 'no' ? 'no' : 'default'
  const { background, shadow, glow } = VARIANT_STYLES[variantKey]

  return (
    <div className="relative w-full group">
      {/* Outer glow effect on hover */}
      <div 
        className="absolute -inset-1 rounded-[20px] blur-xl transition-all duration-500 opacity-0 group-hover:opacity-100"
        style={{ background: glow }}
      />
      
      <button
        type={type}
        disabled={isDisabled}
        onClick={onClick}
        style={{
          background,
          boxShadow: `0 10px 25px -5px ${shadow}, 0 8px 10px -6px ${shadow}`,
          opacity: isDisabled ? 0.5 : 1,
        }}
        className={cn(
          "relative w-full h-14 rounded-[16px] text-[16px] font-bold text-white tracking-tight",
          "transition-all duration-300 ease-out",
          "hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0",
          "flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:scale-100 disabled:translate-y-0",
          isDisabled ? "grayscale-[0.5]" : ""
        )}
      >
        {isLoading ? (
          <>
            <div className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <span className="animate-pulse">
              {t('Processing...') || 'Processando...'}
            </span>
          </>
        ) : (
          <span className="truncate px-4">
            {label ?? (t('Confirm') || 'Confirmar')}
          </span>
        )}
      </button>
    </div>
  )
}
