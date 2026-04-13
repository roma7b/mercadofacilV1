'use client'

import type { MouseEvent } from 'react'
import { useExtracted } from 'next-intl'

interface EventOrderPanelSubmitButtonProps {
  isLoading: boolean
  isDisabled: boolean
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  label?: string
  type?: 'button' | 'submit'
  /** 'yes' = verde, 'no' = vermelho */
  outcomeVariant?: 'yes' | 'no' | null
}

const VARIANT_STYLES: Record<string, { background: string, shadow: string }> = {
  yes: { background: '#10b981', shadow: 'rgba(16,185,129,0.35)' },
  no: { background: '#f43f5e', shadow: 'rgba(244,63,94,0.35)' },
  default: { background: '#3b82f6', shadow: 'rgba(59,130,246,0.25)' },
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
  const { background, shadow } = VARIANT_STYLES[variantKey]

  return (
    <div className="relative w-full">
      <button
        type={type}
        disabled={isDisabled}
        onClick={onClick}
        style={{
          background,
          boxShadow: `0 8px 20px ${shadow}`,
          opacity: isDisabled ? 0.5 : 1,
        }}
        className="w-full h-14 rounded-[16px] text-[16px] font-bold text-white tracking-tight transition-all duration-300 hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:scale-100"
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
