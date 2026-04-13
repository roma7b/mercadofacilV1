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

const markets = [
  {
    id: 'live-cam-sp008-km095',
    titulo: 'Rodovia SP-008 KM 095 - Veículos',
    descricao: 'Contagem de veículos em tempo real na Rodovia SP-008 KM 095. Aposte se o fluxo será alto ou baixo!',
    camera_url: 'https://34.104.32.249.nip.io/SP008-KM095/stream.m3u8',
    imagem_url: 'https://images.unsplash.com/photo-1545147986-a9d6f210df77?auto=format&fit=crop&q=80&w=800',
    tipo_contagem: 'VEICULOS',
    status: 'AO_VIVO',
    opcoes: { sim: 'Mais de 10 Veículos', nao: 'Menos de 10 Veículos' },
    total_sim: 1540.50,
    total_nao: 1200.75,
    volume: 2741.25,
  },
  {
    id: 'live-btc-price-v2',
    titulo: 'Preço do Bitcoin (BTC) - Próximos 5m',
    descricao: 'O preço do Bitcoin vai subir ou descer nos próximos 5 minutos? Acompanhe o gráfico ao vivo!',
    camera_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    imagem_url: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&q=80&w=800',
    tipo_contagem: 'OUTRO',
    status: 'AO_VIVO',
    opcoes: { sim: 'Subir (Bull)', nao: 'Descer (Bear)' },
    total_sim: 45200.00,
    total_nao: 41800.00,
    volume: 87000.00,
  },
]

async function seed() {
  console.log('🚀 Atualizando Mercados 24h com Imagens e IDs Corretos...')

  for (const m of markets) {
    const { error } = await supabase
      .from('mercados_live')
      .upsert({
        ...m,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error(`❌ Erro ao ativar ${m.id}:`, error.message)
    }
    else {
      console.log(`✅ ${m.titulo} ativado com sucesso!`)
    }
  }

  console.log('\n--- Mercados Atualizados ---')
}

seed()
