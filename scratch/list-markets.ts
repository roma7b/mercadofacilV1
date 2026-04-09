import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { pgTable, text, jsonb, numeric, timestamp, integer } from 'drizzle-orm/pg-core'

// Redefinir a tabela aqui para evitar problemas de importação de módulos complexos
const mercadosLive = pgTable('mercados_live', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  status: text('status').notNull().default('AGUARDANDO'),
})

const connectionString = "postgresql://postgres.nrnapsrmedllpctrbhvu:7BILLIIOn7%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres"

async function listMarkets() {
  const client = postgres(connectionString)
  const db = drizzle(client)
  
  try {
    const markets = await db.select().from(mercadosLive)
    console.log('--- Mercados na tabela mercados_live ---')
    console.log(JSON.stringify(markets, null, 2))
    console.log('-----------------------------------------')
  } catch (error) {
    console.error('Erro ao buscar mercados:', error)
  } finally {
    await client.end()
    process.exit(0)
  }
}

listMarkets()
