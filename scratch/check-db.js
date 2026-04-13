const postgres = require('postgres')
require('dotenv').config()

async function checkColumns() {
  const sql = postgres(process.env.POSTGRES_URL)
  try {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'events'`
    console.log(JSON.stringify(cols.map(c => c.column_name)))
  }
  catch (e) {
    console.error(e)
  }
  finally {
    await sql.end()
  }
}

checkColumns()
