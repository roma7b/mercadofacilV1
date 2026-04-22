'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { reconcileAllWalletsFromConfirmedTransactions } from '@/lib/mercado-wallet-reconcile'

export async function reconcileWalletsAction() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  const user = session?.user as any
  if (!user?.is_admin) {
    throw new Error('Acesso negado')
  }

  await reconcileAllWalletsFromConfirmedTransactions()
  revalidatePath('/admin/finance')
}
