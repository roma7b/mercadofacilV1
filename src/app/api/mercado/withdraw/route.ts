import type { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { mercadoTransactions, mercadoWallets } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { HorsePayService } from '@/lib/horsepay'

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { amount, pix_key, pix_type } = await req.json()
    const userId = session.user.id
    const withdrawAmount = Number(amount)

    if (!Number.isFinite(withdrawAmount) || withdrawAmount < 10) {
      return NextResponse.json({ error: 'Valor mínimo de saque: R$ 10,00' }, { status: 400 })
    }
    if (!pix_key || !pix_type) {
      return NextResponse.json({ error: 'Chave PIX e tipo são obrigatórios' }, { status: 400 })
    }

    const result = await db.transaction(async (tx) => {
      const walletResults = await tx.select().from(mercadoWallets).where(eq(mercadoWallets.user_id, userId)).limit(1)
      const wallet = walletResults[0]

      if (!wallet || Number(wallet.saldo) < withdrawAmount) {
        throw new Error('Saldo insuficiente para realizar o saque')
      }

      await tx.update(mercadoWallets)
        .set({ saldo: sql`${mercadoWallets.saldo} - ${withdrawAmount}`, updated_at: new Date() })
        .where(eq(mercadoWallets.user_id, userId))

      const [transaction] = await tx.insert(mercadoTransactions).values({
        user_id: userId,
        tipo: 'SAQUE',
        valor: String(-withdrawAmount),
        status: 'PENDENTE',
        referencia_externa: `WITH_${Date.now()}`,
      }).returning()

      return transaction
    })

    try {
      const horsePayRes = await HorsePayService.createWithdraw({
        amount: withdrawAmount,
        pix_key,
        pix_type,
        client_reference_id: result.id,
      })

      await db.update(mercadoTransactions)
        .set({
          status: 'CONFIRMADO',
          external_id_horsepay: horsePayRes?.external_id ? BigInt(horsePayRes.external_id) : null,
        })
        .where(eq(mercadoTransactions.id, result.id))

      return NextResponse.json({
        success: true,
        message: 'Saque solicitado com sucesso!',
        external_id: horsePayRes.external_id,
      })
    }
    catch (hpError: any) {
      await db.transaction(async (tx) => {
        await tx.update(mercadoWallets)
          .set({ saldo: sql`${mercadoWallets.saldo} + ${withdrawAmount}`, updated_at: new Date() })
          .where(eq(mercadoWallets.user_id, userId))

        await tx.update(mercadoTransactions)
          .set({ status: 'FALHOU' })
          .where(eq(mercadoTransactions.id, result.id))
      })

      throw new Error(`Erro na processadora de pagamentos: ${hpError.message}`)
    }
  }
  catch (error: any) {
    console.error('[WITHDRAW_ERROR]', error)
    return NextResponse.json({ error: error.message || 'Erro ao processar saque' }, { status: 500 })
  }
}
