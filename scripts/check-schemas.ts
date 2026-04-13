import * as dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config()

async function checkSchemas() {
  const sql = postgres(process.env.POSTGRES_URL!)
  try {
    const schemas = await sql`
      SELECT schema_name 
      FROM information_schema.schemata
    `
    console.log('Schemas no banco:', schemas.map(s => s.schema_name).join(', '))
  }
  catch (err) {
    console.error('Erro:', err)
  }
  finally {
    await sql.end()
  }
}

checkSchemas()
