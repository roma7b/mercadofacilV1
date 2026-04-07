import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurado no .env' }, { status: 500 })
  }
  const db = createClient(url, key)

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || ''
  const amount = Number(searchParams.get('amount')) || 100

  if (!userId) {
    return NextResponse.json({ error: 'Passe ?userId=<uuid-do-usuario>' }, { status: 400 })
  }

  // Buscar carteira existente
  const { data: wallet } = await db
    .from('wallets')
    .select('saldo')
    .eq('user_id', userId)
    .maybeSingle()

  if (!wallet) {
    const { error } = await db.from('wallets').insert({ user_id: userId, saldo: amount })
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  } else {
    const { error } = await db.from('wallets').update({ saldo: Number(wallet.saldo) + amount }).eq('user_id', userId)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, userId, added: amount, newBalance: (Number(wallet?.saldo ?? 0) + amount).toFixed(2) })
}

