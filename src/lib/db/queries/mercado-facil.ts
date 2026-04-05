import { supabase } from '@/lib/supabase-client'
import type { Event, Market } from '@/types'

export const MercadoFacilRepository = {
  async listLiveEvents(): Promise<Event[]> {
    try {
      const { data: rows, error } = await supabase
        .from('mercados_live')
        .select('*')
        .eq('status', 'AO_VIVO')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })

      if (error) {
        // Silencia erro de cache do Supabase para não travar a Home
        return []
      }

      return rows.map((row: any) => this.mapToEvent(row))
    }
    catch (error) {
      console.error('Failed to fetch Mercado Fácil live events:', error)
      return []
    }
  },

  async getEventById(id: string): Promise<Event | null> {
    try {
      const { data: row, error } = await supabase
        .from('mercados_live')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !row) {
        console.error('Supabase Error fetching live event:', error)
        return null
      }

      return this.mapToEvent(row)
    }
    catch (error) {
      console.error('Failed to fetch Mercado Fácil live event:', error)
      return null
    }
  },

  mapToEvent(row: any): Event {
    const id = row.id
    const slug = `live-${id}`

    const getIconUrl = (tipo: string) => {
      switch (tipo) {
        case 'VEICULOS':
          return 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&q=80&w=400'
        case 'PESSOAS':
          return 'https://images.unsplash.com/photo-1517732306149-e8f829eb588a?auto=format&fit=crop&q=80&w=400'
        default:
          return 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=400'
      }
    }

    const markets: Market[] = [{
      condition_id: id,
      question_id: id,
      event_id: id,
      title: row.titulo,
      slug,
      icon_url: getIconUrl(row.tipo_contagem),
      is_active: row.status === 'AO_VIVO',
      is_resolved: row.status === 'RESOLVIDO',
      block_number: 0,
      block_timestamp: row.created_at || new Date().toISOString(),
      volume: Number(row.volume || 0),
      volume_24h: 0,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      price: 0.5,
      probability: 0.5,
      outcomes: [
        {
          condition_id: id,
          outcome_text: 'Sim',
          outcome_index: 0,
          token_id: `${id}-0`,
          is_winning_outcome: false,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        },
        {
          condition_id: id,
          outcome_text: 'Não',
          outcome_index: 1,
          token_id: `${id}-1`,
          is_winning_outcome: false,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        },
      ],
      condition: {
        id,
        oracle: 'Mercado Fácil AI',
        question_id: id,
        outcome_slot_count: 2,
        resolved: row.status === 'RESOLVIDO',
        volume: Number(row.volume || 0),
        open_interest: 0,
        active_positions_count: 0,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      },
    }]

    return {
      id,
      slug,
      title: row.titulo || 'Câmera Ao Vivo',
      creator: 'Mercado Fácil',
      icon_url: getIconUrl(row.tipo_contagem),
      livestream_url: row.camera_url,
      show_market_icons: true,
      status: row.status === 'AO_VIVO' ? 'active' : row.status === 'RESOLVIDO' ? 'resolved' : 'draft',
      active_markets_count: 1,
      total_markets_count: 1,
      volume: Number(row.volume || 0),
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      markets,
      tags: [
        { id: 999, name: 'Live Cam', slug: 'live-cam', isMainCategory: true, is_main_category: true },
      ],
      main_tag: 'live-cam',
      is_bookmarked: false,
      is_trending: true,
      end_date: null,
    } as any
  },
}
