import type { Event, Market } from '@/types'
import { resolveMarketTypeFromSlug } from '@/lib/market-type'
import { fetchPolymarketMarketByConditionId } from '@/lib/polymarket'
import { supabase } from '@/lib/supabase-client'

function sanitizeMarketTitle(value: string) {
  return String(value || '')
    .replace(/^\s*\[BR\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildLiveDedupKey(row: any) {
  const conditionId = String(row?.polymarket_condition_id || '').trim()
  if (conditionId) { return `condition:${conditionId}` }

  const normalizedTitle = sanitizeMarketTitle(row?.titulo || '').toLowerCase()
  if (normalizedTitle && row?.market_origin === 'polymarket') {
    return `poly-title:${normalizedTitle}`
  }

  return `id:${row?.id || ''}`
}

async function enrichPolymarketOptions(row: any) {
  if (row?.market_origin !== 'polymarket' || !row?.polymarket_condition_id) {
    return row
  }

  const opcoesRaw = row.opcoes
  const opcoes = (opcoesRaw && typeof opcoesRaw === 'object' && opcoesRaw !== null)
    ? { ...opcoesRaw }
    : null

  if (!opcoes) {
    return row
  }

  const hasEmbeddedPrices = Object.values(opcoes).some((value: any) => {
    const numeric = Number(value?.price)
    return Number.isFinite(numeric)
  })

  if (hasEmbeddedPrices) {
    return row
  }

  const polyMarket = await fetchPolymarketMarketByConditionId(String(row.polymarket_condition_id))
  const outcomePrices = Array.isArray(polyMarket?.outcomePrices)
    ? polyMarket.outcomePrices
    : typeof polyMarket?.outcomePrices === 'string'
      ? JSON.parse(polyMarket.outcomePrices)
      : []

  if (outcomePrices.length === 0) {
    return row
  }

  return {
    ...row,
    opcoes: Object.fromEntries(
      Object.entries(opcoes).map(([key, value], index) => {
        const currentValue = value && typeof value === 'object'
          ? { ...(value as any) }
          : { text: String(value || '') }
        const numericPrice = Number(outcomePrices[index])

        return [key, {
          ...currentValue,
          price: Number.isFinite(numericPrice) ? numericPrice : currentValue.price ?? null,
        }]
      }),
    ),
  }
}

export const MercadoFacilRepository = {
  async listLiveEvents(): Promise<Event[]> {
    try {
      const { data: rows, error } = await supabase
        .from('mercados_live')
        .select('*')
        .eq('status', 'AO_VIVO')
        .order('created_at', { ascending: false })

      if (error) { return [] }

      const dedupedRows = Array.from(
        new Map((rows || []).map((row: any) => [buildLiveDedupKey(row), row])).values(),
      )

      const enrichedRows = await Promise.all(dedupedRows.map((row: any) => enrichPolymarketOptions(row)))

      return enrichedRows.map((row: any) => this.mapToEvent(row))
    }
    catch (error) {
      console.error('Failed to fetch Mercado Fácil live events:', error)
      return []
    }
  },

  async getEventById(id: string): Promise<Event | null> {
    try {
      // Tenta buscar pelo ID exato
      let { data: row, error } = await supabase
        .from('mercados_live')
        .select('*')
        .eq('id', id)
        .single()

      // Se não encontrou, tenta sem o prefixo poly-
      if ((error || !row) && id.startsWith('poly-')) {
        const fallbackId = id.replace(/^poly-/, '')
        const result = await supabase
          .from('mercados_live')
          .select('*')
          .eq('id', fallbackId)
          .single()
        if (!result.error && result.data) {
          row = result.data
          error = null
        }
      }

      if (error || !row) {
        console.error('[MercadoFacilRepository] Não encontrado:', id, error?.message)
        return null
      }

      const enrichedRow = await enrichPolymarketOptions(row)

      return this.mapToEvent(enrichedRow)
    }
    catch (error) {
      console.error('Failed to fetch Mercado Fácil live event:', error)
      return null
    }
  },

  mapToEvent(row: any): Event {
    const id = row.id
    // O slug é sempre live_ + id para roteamento correto
    const slug = `live_${id}`

    // Extrair outcomes do campo opcoes (JSONB)
    // Formato salvo pelo import-market: { op_0: { text: "...", tokenId: "..." }, op_1: ... }
    const opcoesRaw = row.opcoes
    const opcoes = (opcoesRaw && typeof opcoesRaw === 'object' && opcoesRaw !== null)
      ? opcoesRaw
      : { op_0: { text: 'Sim', tokenId: null }, op_1: { text: 'Não', tokenId: null } }

    const outcomes: any[] = Object.entries(opcoes).map(([key, value], index) => {
      const extractedIdx = key.startsWith('op_')
        ? Number.parseInt(key.replace('op_', ''), 10)
        : (key === 'nao' ? 1 : 0)

      const isObj = value && typeof value === 'object'
      const outcomeText = isObj ? (value as any).text : String(value)
      const realTokenId = isObj ? (value as any).tokenId : null
      const rawProbability = isObj ? Number((value as any).price) : null
      const normalizedProbability = Number.isFinite(rawProbability)
        ? Math.max(0, Math.min(100, rawProbability <= 1 ? rawProbability * 100 : rawProbability))
        : null

      return {
        condition_id: id,
        outcome_text: outcomeText || `Opção ${extractedIdx}`,
        outcome_index: extractedIdx,
        // USA O CLOB TOKEN ID REAL — é o que o gráfico usa para buscar histórico!
        token_id: realTokenId || null,
        probability: normalizedProbability,
        is_winning_outcome: false,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      }
    }).sort((a, b) => a.outcome_index - b.outcome_index)

    const totalSim = Number(row.total_sim) || 50000
    const totalNao = Number(row.total_nao) || 50000
    const totalPool = totalSim + totalNao
    const chance = totalPool > 0 ? totalSim / totalPool : 0.5

    const markets: Market[] = [{
      condition_id: id,
      question_id: id,
      event_id: id,
      title: sanitizeMarketTitle(row.titulo || ''),
      slug,
      icon_url: row.camera_url || row.imagem_url || '',
      is_active: row.status === 'AO_VIVO',
      is_resolved: row.status === 'RESOLVIDO',
      block_number: 0,
      block_timestamp: row.created_at || new Date().toISOString(),
      volume: Number(row.volume || 0),
      volume_24h: Number(row.volume_24h || 0),
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      price: chance,
      probability: chance * 100,
      outcomes,
      condition: {
        id,
        oracle: 'Polymarket',
        question_id: id,
        outcome_slot_count: outcomes.length,
        resolved: row.status === 'RESOLVIDO',
        volume: Number(row.volume || 0),
        volume_24h: Number(row.volume_24h || 0),
        open_interest: 0,
        active_positions_count: 0,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      },
    }]

    return {
      id,
      slug,
      title: sanitizeMarketTitle(row.titulo || ''),
      creator: 'Mercado Fácil',
      icon_url: row.imagem_url || row.camera_url || '',
      livestream_url: null,
      show_market_icons: false,
      status: row.status === 'AO_VIVO' ? 'active' : row.status === 'RESOLVIDO' ? 'resolved' : 'draft',
      active_markets_count: 1,
      total_markets_count: 1,
      volume: Number(row.volume || 0),
      volume_24h: Number(row.volume_24h || 0),
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      markets,
      tags: [
        { id: 1, name: 'Polymarket', slug: 'polymarket', isMainCategory: false, is_main_category: false },
      ],
      main_tag: 'polymarket',
      // livePool = este repositório gerencia; o gráfico vai buscar dados reais via token_id
      market_type: resolveMarketTypeFromSlug(slug),
      is_bookmarked: false,
      is_trending: true,
      end_date: row.end_date || null,
      rules: row.rules || row.descricao || '',
    } as any
  },
}
