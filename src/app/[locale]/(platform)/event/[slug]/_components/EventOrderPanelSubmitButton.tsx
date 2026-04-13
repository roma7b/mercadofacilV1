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
  /** 'yes' = verde (comprar SIM), 'no' = vermelho (comprar NÃO), undefined = branco padrão */
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

  const bgColor = isYes
    ? '#10b981' // emerald-500
    : isNo
      ? '#f43f5e' // rose-500
      : '#ffffff'

  const textColor = '#000000'
  const shadowColor = isYes
    ? 'rgba(16,185,129,0.4)'
    : isNo
      ? 'rgba(244,63,94,0.4)'
      : 'rgba(255,255,255,0.15)'

  return (
    <div className="relative w-full group">
      <button
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        onClick={onClick}
        style={{
          backgroundColor: bgColor,
          color: textColor,
          boxShadow: `0 8px 25px ${shadowColor}`,
        }}
        className={cn(
          'w-full h-12 rounded-[14px] text-[16px] font-bold tracking-wide transition-all duration-200',
          'hover:scale-[1.02] active:scale-[0.98]',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100',
          isDisabled && 'bg-[#313030]! text-zinc-400! shadow-none!',
        )}
      >
        <span className="flex items-center justify-center gap-2 w-full">
          {isLoading ? (
            <>
              <div
                className="size-4 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: `${textColor}40`, borderTopColor: 'transparent' }}
              />
              <span className="animate-pulse" style={{ color: textColor }}>
                {t('Processing...') || 'Processando...'}
              </span>
            </>
          ) : (
            <>
              <span className="truncate" style={{ color: textColor }}>
                {label ?? (t('Confirm') || 'Confirmar')}
              </span>
            </>
          )}
        </span>
      </button>
    </div>
  )
}
