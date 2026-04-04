import postgres from 'postgres'
import * as dotenv from 'dotenv'
dotenv.config()

async function checkWalletColumns() {
  const sql = postgres(process.env.POSTGRES_URL!)
  try {
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'wallets' AND table_schema = 'public'
    `
    console.log('Colunas de wallets:', columns.map(c => `${c.column_name} (${c.data_type})`).join(', '))
  } catch (err) {
    console.error('Erro:', err)
  } finally {
    await sql.end()
  }
}

checkWalletColumns()
