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

export default function EventOrderPanelSubmitButton({
  isLoading,
  isDisabled,
  onClick,
  label,
  type = 'submit',
  outcomeVariant,
}: EventOrderPanelSubmitButtonProps) {
  const t = useExtracted()

  const isYes = outcomeVariant === 'yes'
  const isNo = outcomeVariant === 'no'

  return (
    <div className="relative w-full">
      <button
        type={type}
        disabled={isDisabled}
        onClick={onClick}
        className={cn(
          'w-full h-14 rounded-[16px] text-[16px] font-bold tracking-tight transition-all duration-300',
          'hover:brightness-110 active:scale-[0.98] shadow-lg',
          'flex items-center justify-center gap-2',
          // Cores baseadas no variant
          isYes && 'bg-emerald-500 text-white shadow-emerald-500/20',
          isNo && 'bg-rose-500 text-white shadow-rose-500/20',
          (!isYes && !isNo) && 'bg-primary text-primary-foreground',
          // Estado desabilitado
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none',
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
