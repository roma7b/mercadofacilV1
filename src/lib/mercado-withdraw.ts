import { eq, sql } from 'drizzle-orm'
import { mercadoTransactions, mercadoWallets } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'
import { HorsePayService, isHorsePayWithdrawApproved, isHorsePayWithdrawFailed } from '@/lib/horsepay'

function parseWithdrawAmount(transaction: { valor: string | number | null | undefined }) {
  const rawAmount = Number(transaction.valor)
  const amount = Math.abs(rawAmount)

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Valor de saque invalido para transacao ${String(transaction?.valor)}`)
  }

  return amount
}

function encodeWithdrawReferencePart(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function decodeWithdrawReferencePart(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

export function buildWithdrawReference(params: { referenceId: string, pixKey: string, pixType: string }) {
  return [
    params.referenceId,
    encodeWithdrawReferencePart(params.pixType),
    encodeWithdrawReferencePart(params.pixKey),
  ].join('|')
}

export function parseWithdrawReference(reference: string | null | undefined) {
  if (!reference) {
    return null
  }

  const [referenceId, encodedType, encodedKey] = reference.split('|')
  if (!referenceId || !encodedType || !encodedKey) {
    return null
  }

  try {
    return {
      referenceId,
      pixType: decodeWithdrawReferencePart(encodedType),
      pixKey: decodeWithdrawReferencePart(encodedKey),
    }
  }
  catch {
    return null
  }
}

export async function confirmWithdrawTransactionById(transactionId: string, externalId?: string | bigint | null) {
  return db.transaction(async (tx) => {
    const [transaction] = await tx
      .select()
      .from(mercadoTransactions)
      .where(eq(mercadoTransactions.id, transactionId))
      .limit(1)

    if (!transaction) {
      return { status: 'not_found' as const, transaction: null }
    }

    if (transaction.status === 'CONFIRMADO') {
      return { status: 'already_confirmed' as const, transaction }
    }

    if (transaction.tipo !== 'SAQUE') {
      return { status: 'ignored' as const, transaction }
    }

    await tx
      .update(mercadoTransactions)
      .set({
        status: 'CONFIRMADO',
        external_id_horsepay: externalId != null
          ? BigInt(String(externalId))
          : transaction.external_id_horsepay,
      })
      .where(eq(mercadoTransactions.id, transaction.id))

    return { status: 'confirmed' as const, transaction }
  })
}

export async function failWithdrawTransactionById(transactionId: string, externalId?: string | bigint | null) {
  return db.transaction(async (tx) => {
    const [transaction] = await tx
      .select()
      .from(mercadoTransactions)
      .where(eq(mercadoTransactions.id, transactionId))
      .limit(1)

    if (!transaction) {
      return { status: 'not_found' as const, transaction: null }
    }

    if (transaction.tipo !== 'SAQUE') {
      return { status: 'ignored' as const, transaction }
    }

    if (transaction.status === 'FALHOU') {
      return { status: 'already_failed' as const, transaction }
    }

    if (transaction.status === 'CONFIRMADO') {
      return { status: 'already_confirmed' as const, transaction }
    }

    const amount = parseWithdrawAmount(transaction)

    await tx
      .update(mercadoWallets)
      .set({
        saldo: sql`${mercadoWallets.saldo} + ${amount}`,
        updated_at: new Date(),
      })
      .where(eq(mercadoWallets.user_id, transaction.user_id))

    await tx
      .update(mercadoTransactions)
      .set({
        status: 'FALHOU',
        external_id_horsepay: externalId != null
          ? BigInt(String(externalId))
          : transaction.external_id_horsepay,
      })
      .where(eq(mercadoTransactions.id, transaction.id))

    return { status: 'failed' as const, transaction }
  })
}

export async function requestHorsePayWithdrawByTransactionId(transactionId: string) {
  const [transaction] = await db
    .select()
    .from(mercadoTransactions)
    .where(eq(mercadoTransactions.id, transactionId))
    .limit(1)

  if (!transaction) {
    return { status: 'not_found' as const, transaction: null }
  }

  if (transaction.tipo !== 'SAQUE') {
    return { status: 'ignored' as const, transaction }
  }

  if (transaction.status === 'CONFIRMADO') {
    return { status: 'already_confirmed' as const, transaction }
  }

  if (transaction.status === 'FALHOU') {
    return { status: 'already_failed' as const, transaction }
  }

  if (transaction.status !== 'EM_ANALISE') {
    return { status: 'invalid_state' as const, transaction }
  }

  const parsedReference = parseWithdrawReference(transaction.referencia_externa)
  if (!parsedReference?.pixKey || !parsedReference?.pixType) {
    throw new Error('Dados PIX do saque não encontrados para aprovação')
  }

  const amount = parseWithdrawAmount(transaction)
  const horsePayRes = await HorsePayService.createWithdraw({
    amount,
    pix_key: parsedReference.pixKey,
    pix_type: parsedReference.pixType,
    client_reference_id: transaction.id,
  })

  const externalId = horsePayRes?.external_id ?? null

  await db
    .update(mercadoTransactions)
    .set({
      status: 'PENDENTE',
      external_id_horsepay: externalId ? BigInt(String(externalId)) : null,
    })
    .where(eq(mercadoTransactions.id, transaction.id))

  if (isHorsePayWithdrawFailed(horsePayRes)) {
    const failed = await failWithdrawTransactionById(transaction.id, externalId)
    return { status: 'failed' as const, transaction: failed.transaction, externalId }
  }

  if (isHorsePayWithdrawApproved(horsePayRes)) {
    const confirmed = await confirmWithdrawTransactionById(transaction.id, externalId)
    return { status: 'confirmed' as const, transaction: confirmed.transaction, externalId }
  }

  return { status: 'pending' as const, transaction, externalId }
}
