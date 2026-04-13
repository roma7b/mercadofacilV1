const fs = require('node:fs')
const postgres = require('postgres')

const envContent = fs.readFileSync('.env', 'utf8')
const env = {}
envContent.split('\n').forEach((line) => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim()
  }
})

const sql = postgres(env.POSTGRES_URL)

async function listTables() {
  try {
    const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        `
    console.log(JSON.stringify(tables.map(t => t.table_name), null, 2))
  }
  catch (e) {
    console.error(e.message)
  }
  finally {
    await sql.end()
  }
}

listTables()
