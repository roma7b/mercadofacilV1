import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('[MOCK TRADE] Recebido:', body)

    // Simula um pequeno delay de processamento
    await new Promise(resolve => setTimeout(resolve, 1000))

    return NextResponse.json({
      success: true,
      data: {
        tx_hash: `0x${Array.from({ length: 64 }).fill(Math.floor(Math.random() * 16).toString(16)).join('')}`,
        status: 'completed',
        message: 'Aposta realizada com sucesso!',
      },
    })
  }
  catch (error) {
    return NextResponse.json({ success: false, error: 'Erro ao processar trade' }, { status: 500 })
  }
}
