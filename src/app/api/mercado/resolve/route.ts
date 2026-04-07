import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolveMercadoLive } from '@/lib/mercado-payout'

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar Autenticação de Admin
    const session = await auth.api.getSession({
      headers: req.headers
    })

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Usar a propriedade is_admin injetada pelo Better Auth no auth.ts
    const user = session.user as any
    if (!user.is_admin) {
      return NextResponse.json({ error: 'Acesso negado: Requer privilégios de administrador' }, { status: 403 })
    }

    // 2. Extrair dados da resolução
    const { market_id, vencedor_label } = await req.json()

    if (!market_id || !['SIM', 'NAO'].includes(vencedor_label)) {
      return NextResponse.json({ error: 'ID do mercado e Vencedor são obrigatórios' }, { status: 400 })
    }

    // 3. Executar o Motor de Payout
    console.log(`[ADMIN_RESOLVE] Admin ${session.user.id} resolvendo mercado ${market_id} como ${vencedor_label}`)
    const result = await resolveMercadoLive(market_id, vencedor_label)

    return NextResponse.json({
      success: true,
      message: `Mercado resolvido com sucesso! ${result.winners} vencedores pagos.`,
      data: result
    })

  } catch (error: any) {
    console.error('[ADMIN_RESOLVE_ERROR]', error)
    return NextResponse.json({ 
      error: error.message || 'Erro ao resolver mercado' 
    }, { status: 500 })
  }
}

