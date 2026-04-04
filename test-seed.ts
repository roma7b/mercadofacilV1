import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const db = createClient(url, key)

async function main() {
  console.log('--- Diagnóstico Mercado Fácil ---')

  // 1. Listar mercados e status
  const { data: mercados } = await db.from('mercados_live').select('id, titulo, status, total_sim, total_nao')
  console.log('\n[mercados_live]:', JSON.stringify(mercados, null, 2))

  // 2. Listar usuários
  const { data: users } = await db.from('users').select('id, email').limit(5)
  console.log('\n[users]:', JSON.stringify(users, null, 2))

  // 3. Listar wallets
  const { data: wallets } = await db.from('wallets').select('user_id, saldo').limit(5)
  console.log('\n[wallets]:', JSON.stringify(wallets, null, 2))

  // 4. Se houver mercado RESOLVIDO, atualizar o primeiro para AO_VIVO
  const resolvido = mercados?.find((m: any) => m.status !== 'AO_VIVO')
  if (resolvido) {
    const { error } = await db.from('mercados_live').update({ status: 'AO_VIVO' }).eq('id', resolvido.id)
    if (error) console.error('[ERRO] ao atualizar status:', error)
    else console.log(`\n✅ Mercado "${resolvido.titulo}" (${resolvido.id}) atualizado para AO_VIVO`)
  }
}

main().catch(console.error)
