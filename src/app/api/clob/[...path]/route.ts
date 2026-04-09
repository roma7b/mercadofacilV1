/**
 * Proxy server-side para clob.polymarket.com
 * Resolve o problema de CORS: o browser não pode chamar clob.polymarket.com diretamente,
 * mas o servidor Next.js puede fazê-lo sem restrições.
 */

import { type NextRequest, NextResponse } from 'next/server'

const POLYMARKET_CLOB = 'https://clob.polymarket.com'

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const targetPath = '/' + path.join('/')
  const search = req.nextUrl.search || ''
  const url = `${POLYMARKET_CLOB}${targetPath}${search}`

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    })
    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  catch (err) {
    return NextResponse.json({ error: 'Proxy error', detail: String(err) }, { status: 502 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const targetPath = '/' + path.join('/')
  const url = `${POLYMARKET_CLOB}${targetPath}`
  const body = await req.text()

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body,
    })
    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  catch (err) {
    return NextResponse.json({ error: 'Proxy error', detail: String(err) }, { status: 502 })
  }
}
