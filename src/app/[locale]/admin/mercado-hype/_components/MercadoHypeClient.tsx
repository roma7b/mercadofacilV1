'use client'

import type { PolyHypeItem } from '../_actions/fetch-hype'
import { CheckCircle2, ExternalLink, Info, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  deleteMercadoAction,
  getBrazillianHypeAction,
  getPolymarketHypeAction,
  getPublishedMercadosAction,
} from '../_actions/fetch-hype'
import { syncAllHypeMarketsAction } from '../_actions/sync-odds'
import HypeMarketCard from './HypeMarketCard'

interface MercadoHypeClientProps {
  initialBrazilHype: PolyHypeItem[]
  initialGlobalHype: PolyHypeItem[]
  initialPublished: any[]
}

export default function MercadoHypeClient({
  initialBrazilHype,
  initialGlobalHype,
  initialPublished,
}: MercadoHypeClientProps) {
  const [activeTab, setActiveTab] = useState<'global' | 'brazil' | 'published'>('global')
  const [globalHype, setGlobalHype] = useState<PolyHypeItem[]>(initialGlobalHype)
  const [brazilHype, setBrazilHype] = useState<PolyHypeItem[]>(initialBrazilHype)
  const [published, setPublished] = useState<any[]>(initialPublished)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const hasInitialData = initialGlobalHype.length > 0 || initialBrazilHype.length > 0 || initialPublished.length > 0

  async function loadData() {
    setLoading(true)
    try {
      const [gRes, bRes, pRes] = await Promise.allSettled([
        getPolymarketHypeAction(),
        getBrazillianHypeAction(),
        getPublishedMercadosAction(),
      ])

      if (gRes.status === 'fulfilled') {
        if (gRes.value.success) {
          setGlobalHype(gRes.value.data || [])
        }
        else {
          toast.error(`Erro ao carregar Hype Global: ${gRes.value.error || 'desconhecido'}`)
        }
      }

      if (bRes.status === 'fulfilled') {
        if (bRes.value.success) {
          setBrazilHype(bRes.value.data || [])
        }
        else {
          toast.error(`Erro ao carregar Brasil: ${bRes.value.error || 'desconhecido'}`)
        }
      }

      if (pRes.status === 'fulfilled') {
        if (pRes.value.success) {
          setPublished(pRes.value.data || [])
        }
        else {
          toast.error(`Erro ao carregar publicados: ${pRes.value.error || 'desconhecido'}`)
        }
      }

      if (
        gRes.status === 'rejected'
        && bRes.status === 'rejected'
        && pRes.status === 'rejected'
      ) {
        toast.error('Falha ao carregar dados do Hype Factory.')
      }
    }
    catch (err) {
      console.error('Failed to fetch hype', err)
      toast.error('Falha inesperada ao carregar mercados.')
    }
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!hasInitialData) {
      loadData()
    }
  }, [hasInitialData])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este mercado?')) { return }
    const res = await deleteMercadoAction(id)
    if (res.success) {
      toast.success('Mercado excluído!')
      loadData()
    }
    else {
      toast.error(`Erro ao excluir: ${res.error}`)
    }
  }

  const handleSyncOdds = async () => {
    setSyncing(true)
    const res = await syncAllHypeMarketsAction()
    if (res.success) {
      toast.success(`Sincronizados ${res.count} mercados ativos!`)
      loadData()
    }
    else {
      toast.error(`Erro ao sincronizar: ${res.error}`)
    }
    setSyncing(false)
  }

  const currentMarkets = useMemo(() => {
    if (activeTab === 'global') { return Array.isArray(globalHype) ? globalHype : [] }
    if (activeTab === 'brazil') { return Array.isArray(brazilHype) ? brazilHype : [] }
    if (activeTab === 'published') { return Array.isArray(published) ? published : [] }
    return []
  }, [activeTab, brazilHype, globalHype, published])

  return (
    <div className="min-h-screen overflow-x-hidden bg-black p-4 text-white md:p-10">
      <div className="pointer-events-none fixed top-0 left-1/4 size-[500px] bg-emerald-500/5 blur-[120px]" />

      <div className="relative space-y-10">
        <div className="flex flex-col items-end justify-between gap-6 md:flex-row">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-sm bg-emerald-500 px-2 py-1 text-2xs font-black tracking-widest text-black uppercase">
                Factory
              </div>
              <h1 className="translate-y-1 text-4xl font-black tracking-tighter uppercase italic">Hype Terminal</h1>
            </div>
            <p className="max-w-xl leading-relaxed font-medium text-zinc-500 italic">
              Monitore, publique e gerencie seus mercados de alta conversão.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-1.5 backdrop-blur-md">
            <button
              onClick={handleSyncOdds}
              disabled={syncing || loading}
              className="
                flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-3 text-xs
                font-black tracking-widest text-emerald-500 uppercase transition-all duration-300
                hover:bg-emerald-500 hover:text-black disabled:opacity-60
              "
            >
              <RefreshCw className={`size-3 ${syncing ? 'animate-spin' : ''}`} />
              Sync Odds
            </button>
            <div className="mx-1 hidden h-8 w-px self-center bg-zinc-800 md:block" />
            <button
              onClick={() => setActiveTab('global')}
              className={`
                flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-black tracking-widest uppercase transition-all
                duration-300
                ${
                  activeTab === 'global'
                    ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                    : 'text-zinc-500 hover:text-white'
                }`}
            >
              Hype Global
              <div className={`size-1.5 rounded-full ${activeTab === 'global' ? 'animate-pulse bg-emerald-500' : 'bg-zinc-700'}`} />
            </button>
            <button
              onClick={() => setActiveTab('brazil')}
              className={`
                flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-black tracking-widest uppercase transition-all
                duration-300
                ${
                  activeTab === 'brazil'
                    ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                    : 'text-zinc-500 hover:text-white'
                }`}
            >
              Brasil
              <div className={`size-1.5 rounded-full ${activeTab === 'brazil' ? 'animate-pulse bg-white' : 'bg-zinc-700'}`} />
            </button>
            <button
              onClick={() => setActiveTab('published')}
              className={`
                flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-black tracking-widest uppercase transition-all
                duration-300
                ${
                  activeTab === 'published'
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-700 hover:bg-white/5 hover:text-zinc-300'
                }`}
            >
              Publicados
              <div className={`size-1.5 rounded-full ${activeTab === 'published' ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-zinc-900'}`} />
            </button>
          </div>
        </div>

        {loading
          ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-32">
                <Loader2 className="size-16 animate-spin text-emerald-500/20" />
                <p className="animate-pulse font-mono text-2xs font-bold tracking-[0.3em] text-emerald-500 uppercase">Sintonizando rede...</p>
              </div>
            )
          : (
              <div className="grid grid-cols-1 gap-8 pb-32 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {activeTab === 'published'
                  ? (
                      published.map(m => (
                        <div
                          key={m.id}
                          className="
                            group relative flex flex-col gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6
                            transition-all duration-500 hover:border-emerald-500/40
                          "
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="size-4 text-emerald-500" />
                              <span className="text-[9px] font-black tracking-widest text-emerald-500/60 uppercase">Ao Vivo</span>
                            </div>
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="
                                rounded-lg bg-rose-500/10 p-2 text-rose-500 opacity-0 transition-all group-hover:opacity-100
                                hover:bg-rose-500 hover:text-white
                              "
                              title="Excluir do Mercado Fácil"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>

                          <div className="space-y-1">
                            <span className="font-mono text-2xs tracking-tighter text-zinc-600 uppercase">ID:{m.id}</span>
                            <h4 className="line-clamp-3 text-base/tight font-black tracking-tighter uppercase italic">{m.titulo}</h4>
                          </div>

                          <div className="mt-auto space-y-4">
                            <div className="flex gap-2">
                              <div className="flex-1 space-y-1 rounded-xl border border-white/5 bg-black/40 p-3">
                                <div className="text-center text-[8px] font-black tracking-widest text-zinc-500 uppercase">Sim</div>
                                <div className="text-center font-mono text-sm font-black text-emerald-400 italic">R${m.total_sim}</div>
                              </div>
                              <div className="flex-1 space-y-1 rounded-xl border border-white/5 bg-black/40 p-3">
                                <div className="text-center text-[8px] font-black tracking-widest text-zinc-500 uppercase">Não</div>
                                <div className="text-center font-mono text-sm font-black text-white/20 italic">R${m.total_nao}</div>
                              </div>
                            </div>

                            <a
                              href={`/event/live_${m.id}`}
                              target="_blank"
                              className="
                                flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800/50 py-3 text-2xs
                                font-black tracking-[0.2em] uppercase transition-all hover:bg-emerald-500 hover:text-black
                              "
                            >
                              Ver no site
                              <ExternalLink className="size-3" />
                            </a>
                          </div>
                        </div>
                      ))
                    )
                  : (
                      currentMarkets.map(market => (
                        <HypeMarketCard key={market.id} market={market} />
                      ))
                    )}

                {currentMarkets.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center gap-4 py-40 text-zinc-500">
                    <Info className="size-8 opacity-20" />
                    <p className="text-sm font-medium italic opacity-50">Nenhum dado encontrado nesta aba.</p>
                  </div>
                )}
              </div>
            )}
      </div>
    </div>
  )
}
