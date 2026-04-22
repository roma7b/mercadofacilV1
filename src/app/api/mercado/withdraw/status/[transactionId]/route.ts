import type { NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { mercadoTransactions } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'
import { HorsePayService, isHorsePayWithdrawApproved, isHorsePayWithdrawFailed } from '@/lib/horsepay'
import { confirmWithdrawTransactionById, failWithdrawTransactionById } from '@/lib/mercado-withdraw'

export async function GET(req: NextRequest, { params }: { params: Promise<{ transactionId: string }> }) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { transactionId } = await params

    const loadTransaction = async () => {
      const results = await db.select()
        .from(mercadoTransactions)
        .where(
          and(
            eq(mercadoTransactions.id, transactionId),
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

    if (transaction.tipo !== 'SAQUE') {
      return NextResponse.json({ error: 'Transação inválida para consulta de saque' }, { status: 400 })
    }

    if (transaction.status === 'PENDENTE' && transaction.external_id_horsepay) {
      try {
        const horsePayStatus = await HorsePayService.checkWithdrawStatus(String(transaction.external_id_horsepay))

        if (isHorsePayWithdrawFailed(horsePayStatus)) {
          await failWithdrawTransactionById(transaction.id, String(transaction.external_id_horsepay))
          transaction = await loadTransaction()
        }
        else if (isHorsePayWithdrawApproved(horsePayStatus)) {
          await confirmWithdrawTransactionById(transaction.id, String(transaction.external_id_horsepay))
          transaction = await loadTransaction()
        }
      }
      catch (error) {
        console.warn('[WITHDRAW_STATUS] Falha ao consultar HorsePay:', error)
      }
    }

    return NextResponse.json({
      status: transaction?.status ?? 'PENDENTE',
      valor: transaction?.valor ?? '0',
      created_at: transaction?.created_at ?? null,
      external_id: transaction?.external_id_horsepay != null ? String(transaction.external_id_horsepay) : null,
    })
  }
  catch (error: any) {
    console.error('[WITHDRAW_STATUS_ERROR]', error)
    return NextResponse.json({ error: 'Erro ao verificar status do saque' }, { status: 500 })
  }
}
