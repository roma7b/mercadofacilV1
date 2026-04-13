import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(url, key)

async function runTest() {
  console.log('🔍 Iniciando Teste Técnico de Integração...')

  console.log('--- Passo 1: Usuário de Teste ---')
  const { data: user, error: uError } = await supabase
    .from('users')
    .select('id, email')
    .limit(1)
    .single()

  let testUser: any

  if (uError || !user) {
    const { data: newUser, error: nuError } = await supabase
      .from('users')
      .insert({ email: 'test@mercadofacil.com', name: 'Test User' })
      .select()
      .single()
    if (nuError) { throw nuError }
    testUser = newUser
  }
  else {
    testUser = user
  }

  console.log('\n--- Passo 2: Carteira e Saldo ---')
  const { data: wallet, error: wError } = await supabase
    .from('wallets')
    .select('id, saldo')
    .eq('user_id', testUser.id)
    .single()

  if (wError || !wallet) {
    await supabase.from('wallets').insert({ user_id: testUser.id, saldo: 1000 })
  }
  else {
    if (Number(wallet.saldo) < 100) {
      await supabase.from('wallets').update({ saldo: 1000 }).eq('user_id', testUser.id)
    }
  }

  console.log('\n--- Passo 3: Criar Mercado Aberto ---')
  const { data: market, error: mError } = await supabase
    .from('mercados_live')
    .insert({
      titulo: 'Mercado de Teste Automação',
      descricao: 'Teste Técnico',
      camera_id: `test-cam-${Date.now()}`,
      camera_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      opcoes: ['SIM', 'NAO'],
      status: 'AO_VIVO',
      total_sim: 0,
      total_nao: 0,
      termina_em: new Date(Date.now() + 3600000).toISOString(),
    })
    .select()
    .single()

  if (mError) {
    console.error('❌ Erro ao criar mercado:', mError)
    process.exit(1)
  }

  console.log(`✅ Mercado Criado: ${market.titulo} (ID: ${market.id})`)

  console.log('\n--- Passo 4: Realizar Aposta via API ---')
  const betPayload = {
    market_id: market.id,
    opcao: 'SIM',
    valor: 10,
    user_id: testUser.id,
  }

  try {
    const response = await fetch('http://localhost:3002/api/mercado/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(betPayload),
    })

    const result = await response.json()
    if (result.success) {
      console.log('🚀 SUCESSO na Aposta!')
      console.log('Detalhes:', JSON.stringify(result.data, null, 2))
    }
    else {
      console.error('❌ ERRO na Aposta:', result.error)
    }
  }
  catch (err: any) {
    console.error('❌ Erro ao chamar API:', err.message)
  }

  console.log('\n--- Passo 5: Verificação Final no Banco ---')
  const { data: updatedMarket } = await supabase.from('mercados_live').select('*').eq('id', market.id).single()
  const { data: updatedWallet } = await supabase.from('wallets').select('saldo').eq('user_id', testUser.id).single()
  const { data: betRecord } = await supabase.from('bets').select('*').eq('live_id', market.id).single()

  console.log(`Market Pool SIM: R$ ${updatedMarket?.total_sim}`)
  console.log(`Novo Saldo: R$ ${updatedWallet?.saldo}`)
  console.log(`Registro de Aposta Encontrado: ${betRecord ? 'SIM' : 'NÃO'}`)
}

runTest().catch((e) => {
  console.error('Uncaught error', e)
})
