const { createClient } = require('@supabase/supabase-js')

// Load env manually from .env.local
const fs = require('fs')
const envContent = fs.readFileSync('.env.local', 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=')
  if (key && vals.length) env[key.trim()] = vals.join('=').trim()
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function run() {
  const { data, error } = await supabase.from('mercados_live').select('id,titulo,opcoes').limit(5)
  if (error) {
    console.error('Error:', error.message)
    return
  }
  data.forEach(row => {
    console.log('\n--- Mercado:', row.titulo)
    console.log('ID:', row.id)
    console.log('Opcoes:', JSON.stringify(row.opcoes, null, 2))
  })
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
