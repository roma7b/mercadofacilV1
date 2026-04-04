'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { TradingOnboardingContext } from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'

export function MockTradingOnboardingProvider({ children }: { children: ReactNode }) {
  const contextValue = useMemo(() => ({
    startDepositFlow: () => console.log('Mock Deposit Flow'),
    startWithdrawFlow: () => console.log('Mock Withdraw Flow'),
    ensureTradingReady: () => true,
    openTradeRequirements: () => console.log('Mock Requirements'),
    hasProxyWallet: true,
    openWalletModal: () => console.log('Mock Wallet Modal'),
  }), [])

  return (
    <TradingOnboardingContext value={contextValue}>
      {children}
    </TradingOnboardingContext>
  )
}
