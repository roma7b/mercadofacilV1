import type { NextRequest } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isValidCpf, normalizeCpf } from '@/lib/cpf'
import { mercadoTransactions, mercadoWallets } from '@/lib/db/schema'
import { db } from '@/lib/drizzle'
import { reconcileUserWalletFromConfirmedTransactions } from '@/lib/mercado-wallet-reconcile'
import { buildWithdrawReference } from '@/lib/mercado-withdraw'

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { amount } = await req.json()
    const userId = session.user.id
    const withdrawAmount = Number(amount)
    const userCpf = normalizeCpf((session.user as any)?.settings?.identity?.cpf)

    if (!Number.isFinite(withdrawAmount) || withdrawAmount < 10) {
      return NextResponse.json({ error: 'Valor mínimo de saque: R$ 10,00' }, { status: 400 })
    }

    if (!isValidCpf(userCpf)) {
      return NextResponse.json({ error: 'Sua conta ainda não possui um CPF válido para saque.' }, { status: 400 })
    }

    const result = await db.transaction(async (tx) => {
      let walletResults = await tx.select().from(mercadoWallets).where(eq(mercadoWallets.user_id, userId)).limit(1)
      let wallet = walletResults[0]

      if (!wallet) {
        await reconcileUserWalletFromConfirmedTransactions(userId)
        walletResults = await tx.select().from(mercadoWallets).where(eq(mercadoWallets.user_id, userId)).limit(1)
        wallet = walletResults[0]
      }

      if (!wallet || Number(wallet.saldo) < withdrawAmount) {
        throw new Error('Saldo insuficiente para realizar o saque')
      }

      await tx.update(mercadoWallets)
        .set({ saldo: sql`${mercadoWallets.saldo} - ${withdrawAmount}`, updated_at: new Date() })
        .where(eq(mercadoWallets.user_id, userId))

      const referenceId = `WITH_${Date.now()}`
      const withdrawReference = buildWithdrawReference({
        referenceId,
        pixKey: userCpf,
        pixType: 'CPF',
      })

      const [transaction] = await tx.insert(mercadoTransactions).values({
        user_id: userId,
        tipo: 'SAQUE',
        valor: String(-withdrawAmount),
        status: 'EM_ANALISE',
        referencia_externa: withdrawReference,
      }).returning()

      return transaction
    })

    return NextResponse.json({
      success: true,
      message: 'Saque enviado para análise com sucesso. O pagamento será feito no CPF da conta.',
      transaction_id: result.id,
      status: 'EM_ANALISE',
    })
  }
  catch (error: any) {
    console.error('[WITHDRAW_ERROR]', error)
    return NextResponse.json({ error: error.message || 'Erro ao processar saque' }, { status: 500 })
  }
}
