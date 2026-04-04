'use client'

import type { ReactNode } from 'react'
import type { PlatformNavigationTag } from '@/lib/platform-navigation'
import { createContext, use, useMemo } from 'react'

interface PlatformNavigationContextValue {
  childParentMap: Record<string, string>
  tags: PlatformNavigationTag[]
}

const PlatformNavigationContext = createContext<PlatformNavigationContextValue | null>(null)

export default function PlatformNavigationProvider({
  tags,
  childParentMap,
  children,
}: PlatformNavigationContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({
    childParentMap,
    tags,
  }), [childParentMap, tags])

  return (
    <PlatformNavigationContext value={value}>
      {children}
    </PlatformNavigationContext>
  )
}

export function usePlatformNavigationData() {
  const context = use(PlatformNavigationContext)

  if (!context) {
    return {
      childParentMap: {},
      tags: [],
    }
  }

  return context
}
