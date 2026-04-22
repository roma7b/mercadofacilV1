import type { NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { mercadoTransactions } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'
import { HorsePayService, isHorsePayOrderConfirmed } from '@/lib/horsepay'
import { confirmDepositTransactionById } from '@/lib/mercado-deposit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { orderId } = await params

    const loadTransaction = async () => {
      const results = await db.select()
        .from(mercadoTransactions)
        .where(
          and(
            eq(mercadoTransactions.referencia_externa, orderId),
            eq(mercadoTransactions.user_id, session.user.id),
          ),
        )
        .limit(1)

      return results[0] ?? null
    }

    let transaction = await loadTransaction()

    if (!transaction) {
      return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 })
    }

    if (transaction.status === 'PENDENTE' && transaction.external_id_horsepay) {
      try {
        const horsePayStatus = await HorsePayService.checkOrderStatus(String(transaction.external_id_horsepay))

        if (isHorsePayOrderConfirmed(horsePayStatus)) {
          await confirmDepositTransactionById(transaction.id)
          transaction = await loadTransaction()
        }
      }
      catch (error) {
        console.warn('[DEPOSIT_STATUS] Falha ao consultar HorsePay:', error)
      }
    }

    return NextResponse.json({
      status: transaction?.status ?? 'PENDENTE',
      valor: transaction?.valor ?? '0',
      created_at: transaction?.created_at ?? null,
    })
  }
  catch (error: any) {
    console.error('[DEPOSIT_STATUS_ERROR]', error)
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 })
  }
}
