import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
 
 

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Missing env vars', url: !!url, serviceKey: !!serviceKey })
    }

    const admin = createClient(url, serviceKey)

    // Analisa se mandamos '?id=...'
    const searchParams = new URL(request.url).searchParams
    const eventId = searchParams.get('id')

    if (eventId) {
      const { data, error } = await admin.from('markets').select('condition_id, event_id, slug, title, is_active').order('created_at', { ascending: false }).limit(20)
      return NextResponse.json({ latestMarkets: data, error: error?.message })
    }

    // Lista tabelas disponíveis
    const { data: tables, error: tablesError } = await admin
      .rpc('get_tables')
      .single()

    // Tenta consultar tabelas alternativas
    const results: any = { tablesError: tablesError?.message }

    for (const tableName of ['markets', 'mercados', 'apostas', 'events', 'bets', 'predictions']) {
      const { data, error } = await admin.from(tableName).select('*').limit(1)
      results[tableName] = {
        ok: !error,
        error: error?.message,
        columns: data?.[0] ? Object.keys(data[0]) : [],
      }
    }

    return NextResponse.json(results)
  }
  catch (e: any) {
    return NextResponse.json({ exception: e.message })
  }
}
