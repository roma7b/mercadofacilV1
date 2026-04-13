import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    const diagnostics: any = {
      hasUrl: Boolean(url),
      hasServiceKey: Boolean(serviceKey),
      hasAnonKey: Boolean(anonKey),
      urlPreview: url.slice(0, 30),
    }

    // Testa com service role
    if (url && serviceKey) {
      const admin = createClient(url, serviceKey)
      const { data, error } = await admin.from('markets').select('*').limit(3)
      diagnostics.serviceRole = {
        data: data ? data.map(r => Object.keys(r)) : null, // só mostra as colunas, não os dados
        sample: data?.[0],
        error: error?.message,
      }
    }

    // Testa com anon
    if (url && anonKey) {
      const anon = createClient(url, anonKey)
      const { data, error } = await anon.from('markets').select('id').limit(1)
      diagnostics.anonRole = { count: data?.length, error: error?.message }
    }

    return NextResponse.json(diagnostics)
  }
  catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}
