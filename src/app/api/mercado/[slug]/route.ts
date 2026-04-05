import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    // Lógica para mercados Mercado Fácil (Câmeras)
    // Slug esperado: live-[uuid] ou apenas [uuid]
    let id = slug
    if (id.startsWith('live-')) {
      id = id.replace('live-', '')
    }

    // Verifica se id é um UUID válido
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    if (isUuid || slug.startsWith('live-')) {
      console.log(`[DEBUG FETCH] Buscando mercado live ID: ${id}`)
      const { data: row, error } = await supabase
        .from('mercados_live')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) console.error(`[DEBUG FETCH] Erro Supabase:`, error)
      console.log(`[DEBUG FETCH] Resultado row:`, !!row)

      if (error || !row) {
        return NextResponse.json({ error: 'Mercado não encontrado' }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: {
          id: row.id,
          titulo: row.titulo,
          status: row.status,
          total_sim: row.total_sim || 0,
          total_nao: row.total_nao || 0,
          data_resolucao: row.created_at,
        }
      })
    }

    // Se não for um mercado live, podemos retornar erro ou tentar buscar em outra tabela
    return NextResponse.json({ error: 'Tipo de mercado não suportado' }, { status: 400 })
  } catch (error: any) {
    console.error('API Error /api/mercado/[slug]:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
