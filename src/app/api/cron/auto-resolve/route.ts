import type { NextRequest } from 'next/server'
import { and, eq, isNotNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { mercadosLive } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { resolveByExternalResult } from '@/lib/mercado-payout'

// Vercel Cron: a cada hora
// { "crons": [{ "path": "/api/cron/auto-resolve", "schedule": "0 * * * *" }] }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    // Buscar mercados Polymarket abertos com conditionId
    const markets = await db
      .select()
      .from(mercadosLive)
      .where(
        and(
          eq(mercadosLive.market_origin, 'polymarket'),
          isNotNull(mercadosLive.polymarket_condition_id),
        ),
      )

    const openMarkets = markets.filter(m => ['AO_VIVO', 'ABERTO'].includes(m.status))
    const stats = { resolved: 0, skipped: 0, errors: 0 }

    for (const market of openMarkets) {
      try {
        const result = await resolveByExternalResult(
          market.id,
          market.polymarket_condition_id!,
        )
        if (result !== null) {
          stats.resolved++
        }
        else {
          stats.skipped++
        }
      }
      catch {
        stats.errors++
      }
    }

    console.log(`[AUTO_RESOLVE] Resolvidos: ${stats.resolved}, Pulados: ${stats.skipped}, Erros: ${stats.errors}`)
    return NextResponse.json({ success: true, stats })
  }
  catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
