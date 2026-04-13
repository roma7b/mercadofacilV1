import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { runNoise } from '@/lib/bot/noise'

// Vercel Cron: a cada 15 minutos
// { "crons": [{ "path": "/api/cron/bot-noise", "schedule": "*/15 * * * *" }] }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const stats = await runNoise()
    return NextResponse.json({ success: true, stats })
  }
  catch (error: any) {
    console.error('[CRON_NOISE_ERROR]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
