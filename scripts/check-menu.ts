import * as dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config()

async function countRows() {
  const sql = postgres(process.env.POSTGRES_URL!)
  try {
    const result = await sql`SELECT count(*) FROM sports_menu_items`
    console.log('Count segments:', result[0].count)

    const items = await sql`SELECT id, label, h1_title FROM sports_menu_items LIMIT 5`
    console.log('Exemplos:', items)
  }
  catch (err) {
    console.error('Erro:', err)
  }
  finally {
    await sql.end()
  }
}

countRows()
