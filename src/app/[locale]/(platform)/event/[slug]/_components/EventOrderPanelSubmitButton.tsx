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
          'w-full h-12 rounded-[14px] text-[16px] font-bold tracking-wide transition-all duration-200',
          'hover:scale-[1.01] active:scale-[0.99]',
          'flex items-center justify-center gap-2',
          // Cores baseadas no variant
          isYes && 'bg-[#10b981] text-black shadow-[0_8px_20px_rgba(16,185,129,0.3)]',
          isNo && 'bg-[#f43f5e] text-black shadow-[0_8px_20px_rgba(244,63,94,0.3)]',
          (!isYes && !isNo) && 'bg-white text-black shadow-[0_8px_20px_rgba(255,255,255,0.1)]',
          // Estado desabilitado
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none',
        )}
      >
        {isLoading ? (
          <>
            <div className="size-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
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
