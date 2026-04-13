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

async function inspectAll() {
  const tables = ['tags', 'events', 'event_tags']
  for (const table of tables) {
    try {
      console.log(`Inspecting table: ${table}`)
      const columns = await sql`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = ${table}
                ORDER BY ordinal_position;
            `
      console.log(JSON.stringify(columns, null, 2))
    }
    catch (e) {
      console.error(e.message)
    }
  }
  await sql.end()
}

inspectAll()
