'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const TestModeBanner = dynamic(
  () => import('@/components/TestModeBanner'),
  { ssr: false },
)

export default function TestModeBannerDeferred() {
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    function renderBanner() {
      setShouldRender(true)
    }

    const passiveOnceOptions = { once: true, passive: true } satisfies AddEventListenerOptions

    window.addEventListener('scroll', renderBanner, passiveOnceOptions)
    window.addEventListener('pointerdown', renderBanner, passiveOnceOptions)
    window.addEventListener('keydown', renderBanner, { once: true })

    return () => {
      window.removeEventListener('scroll', renderBanner)
      window.removeEventListener('pointerdown', renderBanner)
      window.removeEventListener('keydown', renderBanner)
    }
  }, [])

  if (!shouldRender) {
    return null
  }

  return <TestModeBanner />
}
