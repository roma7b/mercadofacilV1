import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

async function run() {
  const { data, error } = await supabase.from('mercados_live').select('id, titulo').limit(5)
  if (error) {
    console.error(error)
  }
  else { console.log(JSON.stringify(data, null, 2)) }
}
run()
