import { NextResponse } from 'next/server'
import { db } from '@/lib/drizzle'
import { events, markets, conditions, outcomes, event_tags, tags } from '@/lib/db/schema'
import { UserRepository } from '@/lib/db/queries/user'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    // 1. Validar Admin
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { event: eventData, markets: marketsData } = body

    if (!eventData || !marketsData || !Array.isArray(marketsData)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // 2. Inserir Evento
    // Sanitizar o slug do evento para suportar apenas caracteres alfanuméricos e evitar IDs gigantes
    const safeEventSlug = (eventData.slug || eventData.title || 'event')
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs se coladas
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()
      .slice(0, 100)

    const [insertedEvent] = await db.insert(events).values({
      title: eventData.title,
      slug: safeEventSlug,
      status: eventData.publishStatus === 'published' ? 'active' : 'draft',
      rules: eventData.resolutionRules,
      end_date: new Date(eventData.endDate),
      is_hidden: eventData.publishStatus === 'draft',
      creator: currentUser.wallet_address || null,
      icon_url: eventData.image_url || null,
    }).returning()

    if (!insertedEvent) {
      throw new Error('Failed to create event')
    }

    // 3. Vincular Categoria (Tag)
    if (eventData.mainCategory) {
      const tag = await db.query.tags.findFirst({
        where: eq(tags.slug, eventData.mainCategory)
      })
      if (tag) {
        await db.insert(event_tags).values({
          event_id: insertedEvent.id,
          tag_id: tag.id
        })
      }
    }

    // 4. Inserir Mercados e Condições
    for (const m of marketsData) {
      // Sanitizar slug para evitar IDs gigantes ou com caracteres inválidos (como URLs)
      const safeSlug = (m.slug || insertedEvent.slug || 'market')
        .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs se coladas por engano
        .replace(/[^a-z0-9]/gi, '-')
        .toLowerCase()
        .slice(0, 50)

      const conditionId = `pix_${safeSlug}_${Date.now()}`

      // Criar Condição
      await db.insert(conditions).values({
        id: conditionId,
        oracle: 'pix_native',
        question_id: conditionId,
        resolution_status: 'pending',
      })

      // Criar Mercado
      // Inserimos tanto nas colunas padrão (title, slug) quanto nas colunas legadas (titulo, categoria, status)
      // para garantir que a home (que usa listEvents com supabase puro) encontre os dados.
      const resolutionDate = new Date(eventData.endDate)

      // @ts-ignore - Usando 'as any' para aceitar colunas que podem não estar no schema Drizzle mas existem no banco
      await db.insert(markets).values({
        condition_id: conditionId,
        event_id: insertedEvent.id,
        title: m.title,
        slug: m.slug || insertedEvent.slug,
        question: m.question,
        is_active: true,
        // Colunas legadas Mercado Fácil (PT-BR)
        titulo: m.title,
        categoria: (eventData.mainCategory || 'Outros').toUpperCase(),
        status: 'ABERTO',
        data_resolucao: resolutionDate,
        label_sim: m.outcomes[0] || 'Sim',
        label_nao: m.outcomes[1] || 'Não',
        total_sim: "0",
        total_nao: "0"
      } as any)

      // Criar Outcomes
      if (Array.isArray(m.outcomes)) {
        for (let i = 0; i < m.outcomes.length; i++) {
          await db.insert(outcomes).values({
            condition_id: conditionId,
            outcome_text: m.outcomes[i],
            outcome_index: i,
            token_id: `${conditionId}_${i}`,
          })
        }
      }
    }

    return NextResponse.json({ success: true, eventId: insertedEvent.id })

  } catch (error: any) {
    console.error('Publish Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
