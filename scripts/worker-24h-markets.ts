import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!url || !key) {
  console.error('❌ ERRO: Verifique se SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão no seu arquivo .env')
  process.exit(1)
}

const supabase = createClient(url, key)

const MARKET_IDS = ['live-cam-sp008-km095', 'live-btc-price-v2']

async function updateMarkets() {
  console.log(`[${new Date().toLocaleTimeString()}] 🔄 Renovando volumes e atividade dos mercados...`)

  for (const id of MARKET_IDS) {
    // 1. Buscar dados atuais
    const { data: market, error: fetchError } = await supabase
      .from('mercados_live')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !market) {
      console.error(`❌ Erio ao buscar mercado ${id}:`, fetchError?.message)
      continue
    }

    // 2. Simular nova aposta aleatória (R$ 5 a R$ 50)
    const side = Math.random() > 0.5 ? 'total_sim' : 'total_nao'
    const amount = Math.floor(Math.random() * 45) + 5
    
    const newTotal = Number(market[side]) + amount
    const newVolume = Number(market.volume || 0) + amount

    // 3. Atualizar no banco
    const { error: updateError } = await supabase
      .from('mercados_live')
      .update({
        [side]: newTotal,
        volume: newVolume,
        updated_at: new Date().toISOString(),
        // Atualiza o created_at a cada 2 minutos para manter no topo
        // (Simulamos que é um "novo" mercado se renovando)
        created_at: new Date().toISOString() 
      })
      .eq('id', id)

    if (updateError) {
      console.error(`❌ Erro ao atualizar mercado ${id}:`, updateError.message)
    } else {
      console.log(`✅ Mercado ${id} renovado! Lado: ${side}, Valor: R$ ${amount}`)
    }
  }
}

// Inicia o loop
console.log('🚀 Worker de Mercados 24h iniciado!')
updateMarkets() // Executa uma vez de imediato

// Roda a cada 45 segundos
setInterval(updateMarkets, 45000)
