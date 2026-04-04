import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const db = createClient(url, key)

async function run() {
  const market_id = '8a51c4d3-92a5-4f3e-8688-3c3767993261'
  const user_id = 'ddfb845f-fc88-4d09-9145-830abe9c1c17'
  const opcao = 'SIM'
  const valor = 10

  console.log('--- Testando Aposta via Script ---')
  
  // 1. Get Market
  const { data: market } = await db.from('mercados_live').select('*').eq('id', market_id).single()
  console.log('Mercado:', market.titulo, 'Status:', market.status)

  // 2. Get Wallet
  const { data: wallet } = await db.from('wallets').select('*').eq('user_id', user_id).single()
  console.log('Saldo Anterior:', wallet.saldo)

  const custoTotal = valor + (valor * 0.03)
  
  // 3. Update Wallet
  await db.from('wallets').update({ saldo: Number(wallet.saldo) - custoTotal }).eq('user_id', user_id)
  
  // 4. Update Pool
  const poolUpdate = opcao === 'SIM' 
    ? { total_sim: Number(market.total_sim || 0) + valor }
    : { total_nao: Number(market.total_nao || 0) + valor }
  await db.from('mercados_live').update(poolUpdate).eq('id', market_id)

  // 5. Insert Bet
  const { data: bet, error: bError } = await db.from('bets').insert({
    user_id,
    live_id: market_id,
    opcao,
    valor,
    cotas: valor / 0.5, // dummy for test
    multiplicador_no_momento: 2,
    status: 'PENDENTE'
  }).select().single()

  if (bError) {
    console.error('Erro ao inserir aposta:', bError)
  } else {
    console.log('Aposta inserida com ID:', bet.id)
  }

  // 6. Check New Balance
  const { data: newWallet } = await db.from('wallets').select('saldo').eq('user_id', user_id).single()
  console.log('Saldo Atual:', newWallet.saldo)
}

run().catch(console.error)
