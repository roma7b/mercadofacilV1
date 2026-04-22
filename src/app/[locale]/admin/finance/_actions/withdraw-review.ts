'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { failWithdrawTransactionById, requestHorsePayWithdrawByTransactionId } from '@/lib/mercado-withdraw'

async function assertAdminSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  const user = session?.user as any
  if (!user?.is_admin) {
    throw new Error('Acesso negado')
  }
}

function revalidateFinancePages() {
  revalidatePath('/admin/finance')
  revalidatePath('/pt/admin/finance')
}

export async function approveWithdrawAction(formData: FormData) {
  await assertAdminSession()

  const transactionId = String(formData.get('transactionId') || '')
  if (!transactionId) {
    throw new Error('Transação inválida')
  }

  await requestHorsePayWithdrawByTransactionId(transactionId)
  revalidateFinancePages()
}

export async function rejectWithdrawAction(formData: FormData) {
  await assertAdminSession()

  const transactionId = String(formData.get('transactionId') || '')
  if (!transactionId) {
    throw new Error('Transação inválida')
  }

  await failWithdrawTransactionById(transactionId)
  revalidateFinancePages()
}
