const postgres = require('postgres')
require('dotenv').config()

const markets = [
  {
    id: 'live-cam-sp008-km095',
    titulo: 'Rodovia SP-008 KM 095 - Veículos',
    descricao: 'Contagem de veículos em tempo real na Rodovia SP-008 KM 095. Aposte se o fluxo será alto ou baixo!',
    camera_url: 'https://34.104.32.249.nip.io/SP008-KM095/stream.m3u8',
    imagem_url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&q=80&w=800',
    tipo_contagem: 'VEICULOS',
    status: 'AO_VIVO',
    opcoes: { sim: 'Mais de 10 Veículos', nao: 'Menos de 10 Veículos' },
    total_sim: 1540.50,
    total_nao: 1200.75,
    volume: 2741.25,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

async function run() {
  const sql = postgres(process.env.POSTGRES_URL)
  console.log('🚀 Inserindo dados de mercado via conexão direta Postgres...')

  for (const m of markets) {
    await sql`
      INSERT INTO public.mercados_live 
        (id, titulo, descricao, camera_url, imagem_url, tipo_contagem, status, opcoes, total_sim, total_nao, volume, created_at, updated_at)
      VALUES 
        (${m.id}, ${m.titulo}, ${m.descricao}, ${m.camera_url}, ${m.imagem_url}, ${m.tipo_contagem}, ${m.status}, ${sql.json(m.opcoes)}, ${m.total_sim}, ${m.total_nao}, ${m.volume}, ${m.created_at}, ${m.updated_at})
      ON CONFLICT (id) DO UPDATE SET
        titulo = EXCLUDED.titulo,
        descricao = EXCLUDED.descricao,
        camera_url = EXCLUDED.camera_url,
        imagem_url = EXCLUDED.imagem_url,
        tipo_contagem = EXCLUDED.tipo_contagem,
        status = EXCLUDED.status,
        opcoes = EXCLUDED.opcoes,
        total_sim = EXCLUDED.total_sim,
        total_nao = EXCLUDED.total_nao,
        volume = EXCLUDED.volume,
        updated_at = EXCLUDED.updated_at
    `
    console.log(`✅ ${m.titulo} atualizado!`)
  }

  await sql.end()
  console.log('--- Sucesso ---')
}

run()
