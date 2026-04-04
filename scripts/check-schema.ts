import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(url, key)

async function checkSchema() {
  const { data, error } = await supabase
    .from('mercados_live')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ Erro ao ler tabela:', error.message)
    return
  }

  if (data && data.length > 0) {
    console.log('✅ Colunas encontradas:', Object.keys(data[0]).join(', '))
  } else {
    console.log('⚠️ Tabela vazia, não foi possível determinar as colunas via SELECT.')
  }
}

checkSchema()
