/**
 * Endpoint direto para midpoint do Polymarket CLOB
 * Melhora a estabilidade e evita 404s em catch-all routes
 */
import { NextRequest, NextResponse } from 'next/server'

const POLYMARKET_CLOB = 'https://clob.polymarket.com'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tokenId = searchParams.get('token_id')

  if (!tokenId) {
    return NextResponse.json({ error: 'Missing token_id' }, { status: 400 })
  }

  const url = `${POLYMARKET_CLOB}/midpoint?token_id=${encodeURIComponent(tokenId)}`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
    
    if (!res.ok) {
      // Se falhar no Polymarket, retornamos o status deles
      return new NextResponse(null, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  }
  catch (err) {
    return NextResponse.json({ error: 'Proxy error', detail: String(err) }, { status: 502 })
  }
}
