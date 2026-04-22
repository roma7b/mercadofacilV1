import { desc } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { mercadosLive } from '@/lib/db/schema/mercado_facil_tables'
import { db } from '@/lib/drizzle'

function isAdminSession(session: any) {
  const wallet = session?.user?.wallet?.toLowerCase?.() || ''
  const email = session?.user?.email?.toLowerCase?.() || ''

  return wallet === '0x9dcae5a5998efe007edac6b79b4fb7631f83cf34'
    || email === 'yuji.orochi@gmail.com'
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!isAdminSession(session)) {
      return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 403 })
    }

    const data = await db
      .select()
      .from(mercadosLive)
      .orderBy(desc(mercadosLive.id))

    return NextResponse.json({ success: true, data })
  }
  catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Falha ao carregar mercados publicados' }, { status: 500 })
  }
}
