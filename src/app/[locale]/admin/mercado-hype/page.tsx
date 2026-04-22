import { desc } from 'drizzle-orm'
import { connection } from 'next/server'
import { mercadosLive } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'
import {
  getBrazillianHypeAction,
  getPolymarketHypeAction,
} from './_actions/fetch-hype'
import MercadoHypeClient from './_components/MercadoHypeClient'

export default async function MercadoHypePage() {
  await connection()

  const [globalRes, brazilRes, publishedRes] = await Promise.allSettled([
    getPolymarketHypeAction(),
    getBrazillianHypeAction(),
    db.select().from(mercadosLive).orderBy(desc(mercadosLive.id)),
  ])

  const initialGlobalHype = globalRes.status === 'fulfilled' && globalRes.value.success
    ? (globalRes.value.data || [])
    : []

  const initialBrazilHype = brazilRes.status === 'fulfilled' && brazilRes.value.success
    ? (brazilRes.value.data || [])
    : []

  const initialPublished = publishedRes.status === 'fulfilled'
    ? (publishedRes.value || [])
    : []

  return (
    <MercadoHypeClient
      initialGlobalHype={initialGlobalHype}
      initialBrazilHype={initialBrazilHype}
      initialPublished={initialPublished}
    />
  )
}
