import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Carrega as variáveis do .env
dotenv.config()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!url || !key) {
  console.error('❌ ERRO: Verifique se SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão no seu arquivo .env')
  process.exit(1)
}

const supabase = createClient(url, key)

/**
 * CONFIGURAÇÕES DO NOVO MERCADO:
 * Edite os campos abaixo para criar o mercado que desejar!
 */
const NOVO_MERCADO = {
  titulo: 'Rodovia SP-055 KM 92 - Contagem de Veículos', // Título que aparece no Kuest
  descricao: 'Contagem de veículos em tempo real na Rodovia SP-055', // Descrição
  camera_id: 'cam-sp055-123', // ID da Câmera (Obrigatório)
  status: 'AO_VIVO', // AO_VIVO para permitir apostas
  total_sim: 0, // Pool inicial SIM
  total_nao: 0, // Pool inicial NÃO
  termina_em: new Date(Date.now() + 86400000).toISOString(), // Finaliza em 24h
}

async function criarMercado() {
  console.log('🚀 Criando novo mercado de câmera ao vivo...')

  const { data, error } = await supabase
    .from('mercados_live')
    .insert(NOVO_MERCADO)
    .select()
    .single()

  if (error) {
    console.error('❌ Erro ao criar mercado:', error.message, error)
    return
  }

  console.log('\n✅ Mercado Criado com Sucesso!')
  console.log('-----------------------------------')
  console.log(`Título: ${data.titulo}`)
  console.log(`ID (UUID): ${data.id}`)
  console.log(`URL do Kuest: http://localhost:3002/pt-BR/event/live-${data.id}`)
  console.log('-----------------------------------')
  console.log('\nAgora você pode abrir a URL acima para ver o player e apostar!')
}

criarMercado()
