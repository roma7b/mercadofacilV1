'use client'

import { useState } from 'react'
import { useAppKitAccount } from '@/hooks/useAppKitMock'
import { useExtracted } from 'next-intl'
import dynamic from 'next/dynamic'
import HeaderDropdownUserMenuGuest from '@/app/[locale]/(platform)/_components/HeaderDropdownUserMenuGuest'
import HeaderNotifications from '@/app/[locale]/(platform)/_components/HeaderNotifications'
import { useOptionalTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingContext'
import HeaderDropdownUserMenuAuth from '@/components/HeaderDropdownUserMenuAuth'
import HeaderPortfolio from '@/components/HeaderPortfolio'
import { Button } from '@/components/ui/button'
import { useAppKit } from '@/hooks/useAppKitMock'
import { useIsMobile } from '@/hooks/useIsMobile'
import { authClient } from '@/lib/auth-client'
import { useUser } from '@/stores/useUser'
import { GenericAuthModal } from '@/components/GenericAuthModal'

const { useSession } = authClient

const HeaderDepositButton = dynamic(
  () => import('@/app/[locale]/(platform)/_components/HeaderDepositButton'),
  { ssr: false },
)

export default function HeaderMenu() {
  return <HeaderMenuClient />
}

function HeaderMenuClient() {
  const t = useExtracted()
  const { open } = useAppKit()
  const { isConnected } = useAppKitAccount()
  const { data: session, isPending: isSessionPending } = useSession()
  const isMobile = useIsMobile()
  const tradingOnboarding = useOptionalTradingOnboarding()
  const user = useUser()

  const isAuthenticated = Boolean(session?.user) || Boolean(user) || isConnected
  const shouldShowGuestActions = !isAuthenticated && !isSessionPending
  const startDepositFlow = tradingOnboarding?.startDepositFlow

  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalSignUp, setAuthModalSignUp] = useState(false)

  function handleOpenLogin() {
    setAuthModalSignUp(false)
    setAuthModalOpen(true)
  }

  function handleOpenSignUp() {
    setAuthModalSignUp(true)
    setAuthModalOpen(true)
  }

  return (
    <>
      <GenericAuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
        defaultIsSignUp={authModalSignUp}
      />
      {isAuthenticated && (
        <div className="flex items-center gap-2 md:gap-3">
          <HeaderPortfolio className="hidden md:flex" />
          {startDepositFlow
            ? (
                <Button 
                  size="headerCompact" 
                  onClick={startDepositFlow}
                  className="hidden md:inline-flex bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20"
                >
                  {t('Deposit')}
                </Button>
              )
            : (
                <div className="hidden md:block">
                  <HeaderDepositButton />
                </div>
              )
          }
          <HeaderNotifications />
          <div className="-ml-1 hidden h-5 w-px bg-border md:block" aria-hidden="true" />
          <HeaderDropdownUserMenuAuth />
        </div>
      )}

      {shouldShowGuestActions && (
        <>
          <Button
            size="headerCompact"
            variant="link"
            className="no-underline hover:bg-accent/70 hover:no-underline"
            data-testid="header-login-button"
            onClick={handleOpenLogin}
          >
            {t('Log In')}
          </Button>
          <Button
            size="headerCompact"
            data-testid="header-signup-button"
            onClick={handleOpenSignUp}
          >
            {t('Sign Up')}
          </Button>
          {!isMobile && <HeaderDropdownUserMenuGuest />}
        </>
      )}
    </>
  )
}
