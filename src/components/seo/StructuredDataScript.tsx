import type { StructuredDataNode } from '@/lib/structured-data'
import Script from 'next/script'
import { useId } from 'react'

interface StructuredDataScriptProps {
  data: StructuredDataNode
}

function serializeStructuredData(data: StructuredDataNode) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export default function StructuredDataScript({ data }: StructuredDataScriptProps) {
  const compId = useId()

  if (typeof window !== 'undefined') {
    return null
  }

  return (
    <Script
      id={`structured-data-${compId}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }}
      strategy="afterInteractive"
    />
  )
}
