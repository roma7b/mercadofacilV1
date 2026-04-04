import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/drizzle'
import { mercadoTransactions } from '@/lib/db/schema/mercado_facil_tables'
import { HorsePayService } from '@/lib/horsepay'
import siteUrlUtils from '@/lib/site-url'

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers
    })

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { amount, payer_name } = await req.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }

    const userId = session.user.id
    const orderId = `DEP_${Date.now()}`
    
    const { resolveSiteUrl } = siteUrlUtils
    const SITE_URL = resolveSiteUrl(process.env)
    const callbackUrl = `${SITE_URL}/api/mercado/deposit/webhook`

    console.log(`[DEPOSIT] Gerando PIX para usuario ${userId}, valor ${amount}`)

    const horsePayOrder = await HorsePayService.createOrder({
      amount: Number(amount),
      payer_name: payer_name || session.user.name || 'Cliente Kuest',
      client_reference_id: orderId,
      callback_url: callbackUrl
    })

    // Inserir registro de transação pendente
    await db.insert(mercadoTransactions).values({
      user_id: userId,
      tipo: 'DEPOSITO',
      valor: String(amount),
      status: 'PENDENTE',
      referencia_externa: orderId,
      external_id_horsepay: BigInt(horsePayOrder.external_id)
    })

    return NextResponse.json({
      qr_code: horsePayOrder.payment,
      copy_past: horsePayOrder.copy_past,
      order_id: orderId,
      external_id: horsePayOrder.external_id
    })

  } catch (error: any) {
    console.error('[DEPOSIT_CREATE_ERROR]', error)
    return NextResponse.json({ error: error.message || 'Erro ao gerar PIX' }, { status: 500 })
  }
}
