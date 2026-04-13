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

async function fix() {
  try {
    console.log('Renaming table markets to markets_mercadofacil...')
    await sql`ALTER TABLE IF EXISTS markets RENAME TO markets_mercadofacil`
    console.log('SUCCESS: Table renamed.')
  }
  catch (e) {
    console.error('ERROR RENAME:', e.message)
  }
  finally {
    await sql.end()
  }
}

fix()
