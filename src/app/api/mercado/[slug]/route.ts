import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-client'
import { fetchPolymarketOdds } from '@/lib/polymarket'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    // 1. Resolver Slug -> ID via tabela de eventos
    // O slug pode vir com prefixo ou não dependendo de quem chama
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, condition_id:markets(condition_id)')
      .eq('slug', slug)
      .single()

    let targetId = slug
    if (slug.startsWith('live_')) {
      targetId = slug.replace('live_', '')
    }
    
    let conditionId: string | null = null

    if (eventData) {
      targetId = eventData.id
      // Pegar o condition_id do primeiro mercado associado se existir
      const marketsArray = eventData.condition_id as any[]
      if (marketsArray && marketsArray.length > 0) {
        conditionId = marketsArray[0].condition_id
      }
    }

    // 2. Buscar dados no pool Mercado Fácil utilizando o ID resolvido
    const { data: row, error } = await supabase
      .from('mercados_live')
      .select('*')
      .eq('id', targetId)
      .single()
    
    // Se não encontrar no pool local e for um slug da poly, tentamos buscar dados reais
    const isPoly = slug.startsWith('poly-')
    
    if (error || !row) {
      if (isPoly) {
         // Tentar extrair conditionId se não resolveu via DB
         // (Isso ajuda se o mercado for novo e o graph estiver lento)
         return NextResponse.json({
            success: true,
            data: {
               id: slug,
               titulo: "Sincronizando...",
               total_sim: 0.5,
               total_nao: 0.5
            }
         })
      }
      return NextResponse.json({ error: 'Mercado não encontrado' }, { status: 404 })
    }

    let totalSim = Number(row.total_sim) || 0
    let totalNao = Number(row.total_nao) || 0
    let polyVolume = 0

    // Sincronização Híbrida: Se o pool local for quase zero, pegamos da Poly
    if (isPoly && (totalSim + totalNao) < 1.1) { // 1.1 cobre o seed de 1.0
       // Se não pegamos o conditionId via Join do Supabase, buscamos direto se for um poly-
       if (!conditionId) {
          // Fallback: buscar o mercado no DB de novo pra garantir o condition_id
          const { data: marketData } = await supabase
            .from('markets')
            .select('condition_id')
            .eq('event_id', targetId)
            .single()
          if (marketData) conditionId = marketData.condition_id
       }

       if (conditionId) {
          const polyData = await fetchPolymarketOdds(conditionId)
          if (polyData.success) {
             totalSim = polyData.yes
             totalNao = 1 - polyData.yes
             polyVolume = polyData.volume
          }
       }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        titulo: row.titulo,
        status: row.status,
        total_sim: totalSim,
        total_nao: totalNao,
        volume_original: polyVolume || 0,
        opcoes: row.opcoes,
        descricao: row.descricao,
        camera_url: row.camera_url,
        data_resolucao: row.created_at,
      }
    })
  } catch (error: any) {
    console.error('API Error /api/mercado/[slug]:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
