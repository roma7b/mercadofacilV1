import { eq } from 'drizzle-orm'
import { events } from './src/lib/db/schema/events/tables'
import { db } from './src/lib/drizzle'

async function checkEvent() {
  const slug = 'live_live_cam-sp008-km095'
  console.log('Buscando evento:', slug)

  const result = await db.select().from(events).where(eq(events.slug, slug)).limit(1)

  if (result.length === 0) {
    console.log('ERRO: Evento não encontrado no banco de dados!')
  }
  else {
    console.log('EVENTO ENCONTRADO:')
    console.log('ID:', result[0].id)
    console.log('Título:', result[0].title)
    console.log('Link da Câmera (livestream_url):', result[0].livestream_url || 'ESTÁ VAZIO (NULL)')
  }
  process.exit(0)
}

checkEvent().catch((err) => {
  console.error(err)
  process.exit(1)
})
