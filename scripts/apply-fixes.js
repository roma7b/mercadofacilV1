const postgres = require('postgres')
require('dotenv').config()

async function run() {
  const sql = postgres(process.env.POSTGRES_URL)
  
  console.log('Aplicando correções de RLS manualmente...')
  
  await sql`ALTER TABLE public.mercados_live DISABLE ROW LEVEL SECURITY;`
  await sql`GRANT ALL ON TABLE public.mercados_live TO anon, authenticated, service_role;`
  
  await sql`ALTER TABLE public.bets DISABLE ROW LEVEL SECURITY;`
  await sql`GRANT ALL ON TABLE public.bets TO anon, authenticated, service_role;`
  
  await sql`ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;`
  await sql`GRANT ALL ON TABLE public.transactions TO anon, authenticated, service_role;`
  
  await sql`ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;`
  await sql`GRANT ALL ON TABLE public.chat_messages TO anon, authenticated, service_role;`
  
  console.log('✅ Correções aplicadas!')
  await sql.end()
}

run()
