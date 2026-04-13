import { eq } from 'drizzle-orm'
import { mercadosLive } from './src/lib/db/schema/mercado_facil_tables'
import { db } from './src/lib/drizzle'

async function restoreDefaultMarkets() {
  console.log('Restornando mercados padrão...')

  const markets = [
    {
      id: 'LIVE-BTC-PRICE-V2',
      titulo: 'PREÇO DO BITCOIN (BTC) - PRÓXIMOS 5M',
      descricao: 'O preço do Bitcoin estará acima do valor atual nos próximos 5 minutos?',
      camera_url: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&q=80&w=400',
      status: 'AO_VIVO',
      tipo_contagem: 'OUTRO',
      opcoes: { op_0: 'ALTA', op_1: 'BAIXA' },
      total_sim: '48244.00',
      total_nao: '45130.00',
      volume: '150420.00',
    },
    {
      id: 'LIVE-CAM-SP008-KM095',
      titulo: 'RODOVIA SP-008 KM 095 - VEÍCULOS',
      descricao: 'Monitoramento em tempo real do fluxo de veículos na Rodovia SP-008.',
      camera_url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&q=80&w=400',
      status: 'AO_VIVO',
      tipo_contagem: 'VEICULOS',
      opcoes: { op_0: 'FLUXO ALTO', op_1: 'FLUXO BAIXO' },
      total_sim: '4335.50',
      total_nao: '4862.75',
      volume: '89240.00',
    },
  ]

  for (const m of markets) {
    try {
      await db.insert(mercadosLive).values(m).onConflictDoUpdate({
        target: mercadosLive.id,
        set: m,
      })
      console.log(`Sucesso: ${m.titulo}`)
    }
    catch (e) {
      console.error(`Erro ao restaurar ${m.titulo}:`, e)
    }
  }
}

restoreDefaultMarkets().then(() => process.exit(0))
