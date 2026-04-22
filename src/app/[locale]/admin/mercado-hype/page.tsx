import { connection } from 'next/server'
import {
  getBrazillianHypeAction,
  getPolymarketHypeAction,
  getPublishedMercadosAction,
} from './_actions/fetch-hype'
import MercadoHypeClient from './_components/MercadoHypeClient'

export default async function MercadoHypePage() {
  await connection()

  const [globalRes, brazilRes, publishedRes] = await Promise.allSettled([
    getPolymarketHypeAction(),
    getBrazillianHypeAction(),
    getPublishedMercadosAction(),
  ])

  const initialGlobalHype = globalRes.status === 'fulfilled' && globalRes.value.success
    ? (globalRes.value.data || [])
    : []

  const initialBrazilHype = brazilRes.status === 'fulfilled' && brazilRes.value.success
    ? (brazilRes.value.data || [])
    : []

  const initialPublished = publishedRes.status === 'fulfilled' && publishedRes.value.success
    ? (publishedRes.value.data || [])
    : []

  return (
    <MercadoHypeClient
      initialGlobalHype={initialGlobalHype}
      initialBrazilHype={initialBrazilHype}
      initialPublished={initialPublished}
    />
  )
}
