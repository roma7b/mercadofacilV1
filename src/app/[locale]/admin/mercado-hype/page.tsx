'use client'

import { useState, useEffect } from 'react'
import { getPolymarketHypeAction, getBrazillianHypeAction, type PolyHypeItem, getPublishedMercadosAction, deleteMercadoAction } from './_actions/fetch-hype'
import HypeMarketCard from './_components/HypeMarketCard'
import { Loader2, Info, CheckCircle2, RefreshCw, Trash2, ExternalLink } from 'lucide-react'
import { syncAllHypeMarketsAction } from './_actions/sync-odds'
import { toast } from 'sonner'

export default function MercadoHypePage() {
  const [activeTab, setActiveTab] = useState<'global' | 'brazil' | 'published'>('global')
  const [globalHype, setGlobalHype] = useState<PolyHypeItem[]>([])
  const [brazilHype, setBrazilHype] = useState<PolyHypeItem[]>([])
  const [published, setPublished] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      const gRes = await getPolymarketHypeAction()
      const bRes = await getBrazillianHypeAction()
      const pRes = await getPublishedMercadosAction()
      
      if (gRes.success) setGlobalHype(gRes.data || [])
      if (bRes.success) setBrazilHype(bRes.data || [])
      if (pRes.success) setPublished(pRes.data || [])
    } catch (err) {
      console.error('Failed to fetch hype', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este mercado?')) return
    const res = await deleteMercadoAction(id)
    if (res.success) {
      toast.success('Mercado excluído!')
      loadData()
    } else {
      toast.error('Erro ao excluir: ' + res.error)
    }
  }

  useEffect(() => { loadData() }, [])

  const [syncing, setSyncing] = useState(false)

  const handleSyncOdds = async () => {
    setSyncing(true)
    const res = await syncAllHypeMarketsAction()
    if (res.success) {
      toast.success(`Sincronizados ${res.count} mercados ativos!`)
      loadData()
    } else {
      toast.error('Erro ao sincronizar: ' + res.error)
    }
    setSyncing(false)
  }

  const handleTabChange = async (tab: 'global' | 'brazil' | 'published') => {
    setActiveTab(tab)
  }

  const getMarkets = () => {
    if (activeTab === 'global') return Array.isArray(globalHype) ? globalHype : []
    if (activeTab === 'brazil') return Array.isArray(brazilHype) ? brazilHype : []
    if (activeTab === 'published') return Array.isArray(published) ? published : []
    return []
  }

  const currentMarkets = getMarkets()

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-10 overflow-x-hidden">
      {/* Background Glow */}
      <div className="fixed top-0 left-1/4 size-[500px] bg-emerald-500/5 blur-[120px] pointer-events-none" />
      
      <div className="relative space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="px-2 py-1 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest rounded">Factory</div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic translate-y-1">Hype Terminal</h1>
            </div>
            <p className="text-zinc-500 max-w-xl font-medium leading-relaxed italic">
              Monitore, publique e gerencie seus mercados de alta conversão.
            </p>
          </div>

          <div className="flex flex-wrap bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800 backdrop-blur-md gap-1">
            <button
              onClick={handleSyncOdds}
              disabled={syncing}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black border border-emerald-500/20"
            >
              <RefreshCw className={`size-3 ${syncing ? 'animate-spin' : ''}`} /> Sync Odds
            </button>
            <div className="w-[1px] h-8 bg-zinc-800 mx-1 self-center hidden md:block" />
            <button
              onClick={() => handleTabChange('global')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                activeTab === 'global' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'text-zinc-500 hover:text-white'
              }`}
            >
              Hype Global <div className={`size-1.5 rounded-full ${activeTab === 'global' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
            </button>
            <button
              onClick={() => handleTabChange('brazil')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                activeTab === 'brazil' ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'text-zinc-500 hover:text-white'
              }`}
            >
              Brasil <div className={`size-1.5 rounded-full ${activeTab === 'brazil' ? 'bg-white animate-pulse' : 'bg-zinc-700'}`} />
            </button>
            <button
              onClick={() => handleTabChange('published')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                activeTab === 'published' ? 'bg-white/10 text-white' : 'text-zinc-700 hover:text-zinc-300 hover:bg-white/5'
              }`}
            >
              Publicados <div className={`size-1.5 rounded-full ${activeTab === 'published' ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-zinc-900'}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="size-16 text-emerald-500/20 animate-spin" />
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-500 font-bold animate-pulse">Sintonizando Rede...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8 pb-32">
            {activeTab === 'published' ? (
              published.map((m) => (
                <div key={m.id} className="group relative p-6 bg-zinc-900/40 border border-zinc-800 rounded-2xl flex flex-col gap-6 hover:border-emerald-500/40 transition-all duration-500">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                       <CheckCircle2 className="size-4 text-emerald-500" />
                       <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/60">Ao Vivo</span>
                    </div>
                    <button 
                      onClick={() => handleDelete(m.id)}
                      className="p-2 bg-rose-500/10 text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white"
                      title="Excluir do Kuest"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter">ID: {m.id}</span>
                    <h4 className="font-black uppercase text-base leading-tight italic tracking-tighter line-clamp-3">{m.titulo}</h4>
                  </div>

                  <div className="mt-auto space-y-4">
                    <div className="flex gap-2">
                      <div className="flex-1 bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                        <div className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Sim</div>
                        <div className="text-emerald-400 font-mono text-sm font-black text-center italic">R$ {m.total_sim}</div>
                      </div>
                      <div className="flex-1 bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                        <div className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-center">Não</div>
                        <div className="text-white/20 font-mono text-sm font-black text-center italic">R$ {m.total_nao}</div>
                      </div>
                    </div>
                    
                    <a 
                      href={`/event/live-${m.id}`} 
                      target="_blank" 
                      className="flex items-center justify-center gap-2 w-full py-3 bg-zinc-800/50 hover:bg-emerald-500 hover:text-black rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                    >
                      Ver no Site <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              ))
            ) : (
              currentMarkets.map((market) => (
                <HypeMarketCard key={market.id} market={market} />
              ))
            )}

            {currentMarkets.length === 0 && (
              <div className="col-span-full py-40 flex flex-col items-center justify-center text-zinc-500 gap-4">
                <Info className="size-8 opacity-20" />
                <p className="text-sm font-medium italic opacity-50">Nenhum dado encontrado nesta frequência.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
