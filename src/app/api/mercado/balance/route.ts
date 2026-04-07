import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(url, key)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID missing' }, { status: 400 })
    }

    const db = getAdminClient()
    const { data: wallet, error } = await db
      .from('wallets')
      .select('saldo')
      .eq('user_id', userId)
      .single()

    if (error || !wallet) {
      return NextResponse.json({
        raw: 0,
        text: '0.00',
        symbol: 'R$',
      })
    }

    const rawBalance = Number(wallet.saldo) || 0

    return NextResponse.json({
      raw: rawBalance,
      text: rawBalance.toFixed(2),
      symbol: 'R$',
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

