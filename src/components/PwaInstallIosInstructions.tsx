'use client'

import type { PropsWithChildren } from 'react'
import { MoreHorizontalIcon, ShareIcon, SquarePlusIcon } from 'lucide-react'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'

interface IosInstallCopy {
  inSafari: string
  tapMenu: string
  thenShare: string
  nextTap: string
  more: string
  share: string
  addToHomeScreen: string
}

const iosInstallCopyByLocale: Record<string, IosInstallCopy> = {
  de: {
    inSafari: 'In Safari,',
    tapMenu: 'tippe auf das MenÃ¼',
    thenShare: 'und dann auf',
    nextTap: 'AnschlieÃŸend tippe auf',
    more: 'Mehr',
    share: 'Teilen',
    addToHomeScreen: 'Zu Home-Bildschirm hinzufÃ¼gen',
  },
  en: {
    inSafari: 'In Safari,',
    tapMenu: 'tap the',
    thenShare: 'menu and then',
    nextTap: 'Then tap',
    more: 'More',
    share: 'Share',
    addToHomeScreen: 'Add to Home Screen',
  },
  es: {
    inSafari: 'En Safari,',
    tapMenu: 'toca el menÃº',
    thenShare: 'y despuÃ©s',
    nextTap: 'Luego toca',
    more: 'MÃ¡s',
    share: 'Compartir',
    addToHomeScreen: 'AÃ±adir a pantalla de inicio',
  },
  fr: {
    inSafari: 'Dans Safari,',
    tapMenu: 'touchez le menu',
    thenShare: 'puis',
    nextTap: 'Ensuite, touchez',
    more: 'Plus',
    share: 'Partager',
    addToHomeScreen: 'Sur lâ€™Ã©cran dâ€™accueil',
  },
  pt: {
    inSafari: 'No Safari,',
    tapMenu: 'toque no menu',
    thenShare: 'e depois em',
    nextTap: 'Em seguida, toque em',
    more: 'Mais',
    share: 'Compartilhar',
    addToHomeScreen: 'Adicionar Ã  Tela de InÃ­cio',
  },
  zh: {
    inSafari: 'åœ¨ Safari ä¸­ï¼Œ',
    tapMenu: 'è½»ç‚¹èœå•',
    thenShare: 'ï¼Œç„¶åŽè½»ç‚¹',
    nextTap: 'æŽ¥ç€è½»ç‚¹',
    more: 'æ›´å¤š',
    share: 'å…±äº«',
    addToHomeScreen: 'æ·»åŠ åˆ°ä¸»å±å¹•',
  },
}

function InstructionBadge({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border bg-muted/60 px-2 py-0.5 font-medium text-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

export default function PwaInstallIosInstructions({ className }: { className?: string }) {
  const locale = useLocale().split('-')[0]?.toLowerCase() ?? 'en'
  const copy = iosInstallCopyByLocale[locale] ?? iosInstallCopyByLocale.en

  return (
    <span className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground', className)}>
      <span>{copy.inSafari}</span>
      <span>{copy.tapMenu}</span>
      <InstructionBadge>
        <MoreHorizontalIcon className="size-3.5" />
        <span>{copy.more}</span>
      </InstructionBadge>
      <span>{copy.thenShare}</span>
      <InstructionBadge>
        <ShareIcon className="size-3.5" />
        <span>{copy.share}</span>
      </InstructionBadge>
      <span>.</span>
      <span>{copy.nextTap}</span>
      <InstructionBadge className="gap-1.5">
        <SquarePlusIcon className="size-3.5" />
        <span>{copy.addToHomeScreen}</span>
      </InstructionBadge>
      <span>.</span>
    </span>
  )
}
