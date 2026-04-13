import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { runOracleAdjust } from '@/lib/bot/oracle-adjust'

// Vercel Cron: a cada 5 minutos
// Definir em vercel.json:
// { "crons": [{ "path": "/api/cron/bot-oracle", "schedule": "*/5 * * * *" }] }

// Segment configs removidos para compatibilidade com 'use cache'

export async function GET(req: NextRequest) {
  // Verificar token de segurança do cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const stats = await runOracleAdjust()
    return NextResponse.json({ success: true, stats })
  }
  catch (error: any) {
    console.error('[CRON_ORACLE_ERROR]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
