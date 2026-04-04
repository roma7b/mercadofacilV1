import postgres from 'postgres'
import * as dotenv from 'dotenv'
dotenv.config()

async function checkTables() {
  const sql = postgres(process.env.POSTGRES_URL!)
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `
    console.log('Tabelas no banco:', tables.map(t => t.table_name).join(', '))
  } catch (err) {
    console.error('Erro ao conectar ou consultar:', err)
  } finally {
    await sql.end()
  }
}

checkTables()
