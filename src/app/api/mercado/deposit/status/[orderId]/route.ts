import type { NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { mercadoTransactions } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    })

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { orderId } = await params

    console.log(`[DEPOSIT_STATUS] Verificando status da transação ${orderId} para user ${session.user.id}`)

    const results = await db.select()
      .from(mercadoTransactions)
      .where(
        and(
          eq(mercadoTransactions.referencia_externa, orderId),
          eq(mercadoTransactions.user_id, session.user.id),
        ),
      )
      .limit(1)

    if (results.length === 0) {
      return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      status: results[0].status,
      valor: results[0].valor,
      created_at: results[0].created_at,
    })
  }
  catch (error: any) {
    console.error('[DEPOSIT_STATUS_ERROR]', error)
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 })
  }
}
