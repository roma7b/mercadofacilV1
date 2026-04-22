'use client'

import type { PolyHypeItem } from '../_actions/fetch-hype'
import { CheckCircle2, ExternalLink, Info, Loader2, RefreshCw, RotateCcw, ScrollText, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  deleteMercadoAction,
  getBrazillianHypeAction,
  getPolymarketHypeAction,
} from '../_actions/fetch-hype'
import {
  reimportPublishedMercadoAction,
  resolvePublishedMercadoAction,
  syncPublishedMercadoAction,
} from '../_actions/market-ops'
import { syncAllHypeMarketsAction } from '../_actions/sync-odds'
import HypeMarketCard from './HypeMarketCard'

interface PublishedMercadoItem {
  id: string
  titulo: string
  descricao?: string | null
  status: string
  market_origin?: string | null
  total_sim?: string | number | null
  total_nao?: string | number | null
  payout_reserve?: string | number | null
  volume?: string | number | null
  volume_24h?: string | number | null
  polymarket_last_sync?: string | Date | null
  totalApostado: number
  totalGarantido: number
  betCount: number
  recentBets: Array<{
    id: string
    userId: string
    opcao: string
    valor: number
    payoutGarantido: number
    status: string
    createdAt?: string | Date | null
  }>
  recentAudit: Array<{
    id: string
    userId: string
    tipo: string
    valor: number
    status: string
    createdAt?: string | Date | null
  }>
}

interface MercadoHypeClientProps {
  initialBrazilHype: PolyHypeItem[]
  initialGlobalHype: PolyHypeItem[]
  initialPublished: PublishedMercadoItem[]
}

function normalizePublishedMarkets(markets: any[]): PublishedMercadoItem[] {
  return (Array.isArray(markets) ? markets : []).map((market: any) => ({
    ...market,
    totalApostado: Number(market.totalApostado || 0),
    totalGarantido: Number(market.totalGarantido || 0),
    betCount: Number(market.betCount || 0),
    recentBets: Array.isArray(market.recentBets) ? market.recentBets : [],
    recentAudit: Array.isArray(market.recentAudit) ? market.recentAudit : [],
  }))
}

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatSyncDate(value: string | Date | null | undefined) {
  if (!value) {
    return 'Nunca sincronizado'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Nunca sincronizado'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}

export default function MercadoHypeClient({
  initialBrazilHype,
  initialGlobalHype,
  initialPublished,
}: MercadoHypeClientProps) {
  const [activeTab, setActiveTab] = useState<'global' | 'brazil' | 'published'>('global')
  const [globalHype, setGlobalHype] = useState<PolyHypeItem[]>(initialGlobalHype)
  const [brazilHype, setBrazilHype] = useState<PolyHypeItem[]>(initialBrazilHype)
  const [published, setPublished] = useState<PublishedMercadoItem[]>(() => normalizePublishedMarkets(initialPublished))
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [marketActionId, setMarketActionId] = useState<string | null>(null)

  const hasInitialData = initialGlobalHype.length > 0 || initialBrazilHype.length > 0 || initialPublished.length > 0

  async function loadPublishedData() {
    const response = await fetch('/api/admin/mercado-hype/published', {
      credentials: 'include',
      method: 'GET',
    })

    const publishedRes = await response.json()

    if (response.ok && publishedRes.success) {
      setPublished(normalizePublishedMarkets(publishedRes.data || []))
      return true
    }

    toast.error(`Erro ao carregar publicados: ${publishedRes.error || 'desconhecido'}`)
    return false
  }

  async function loadData() {
    setLoading(true)
    try {
      const [gRes, bRes, pRes] = await Promise.allSettled([
        getPolymarketHypeAction(),
        getBrazillianHypeAction(),
        fetch('/api/admin/mercado-hype/published', {
          credentials: 'include',
          method: 'GET',
        }).then(async response => ({
          ok: response.ok,
          body: await response.json(),
        })),
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
        if (pRes.value.ok && pRes.value.body.success) {
          setPublished(normalizePublishedMarkets(pRes.value.body.data || []))
        }
        else {
          toast.error(`Erro ao carregar publicados: ${pRes.value.body?.error || 'desconhecido'}`)
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
      void loadData()
    }
  }, [hasInitialData])

  useEffect(() => {
    if (activeTab === 'published' && published.length === 0) {
      void loadPublishedData()
    }
  }, [activeTab, published.length])

  async function handleDelete(id: string) {
    const res = await deleteMercadoAction(id)
    if (res.success) {
      toast.success('Mercado excluido.')
      await loadData()
    }
    else {
      toast.error(`Erro ao excluir: ${res.error}`)
    }
  }

  async function handleSyncOdds() {
    setSyncing(true)
    const res = await syncAllHypeMarketsAction()
    if (res.success) {
      toast.success(`Sincronizados ${res.count} mercados ativos.`)
      await loadData()
    }
    else {
      toast.error(`Erro ao sincronizar: ${res.error}`)
    }
    setSyncing(false)
  }

  async function handlePublishedAction(
    marketId: string,
    action: 'sync' | 'reimport' | 'resolve-sim' | 'resolve-nao',
  ) {
    setMarketActionId(`${marketId}:${action}`)

    const actionMap = {
      'sync': () => syncPublishedMercadoAction(marketId),
      'reimport': () => reimportPublishedMercadoAction(marketId),
      'resolve-sim': () => resolvePublishedMercadoAction(marketId, 'SIM'),
      'resolve-nao': () => resolvePublishedMercadoAction(marketId, 'NAO'),
    } as const

    const res = await actionMap[action]()
    if (res.success) {
      if (action === 'sync') {
        toast.success('Odds sincronizadas com a Polymarket.')
      }
      else if (action === 'reimport') {
        toast.success('Mercado reimportado e backfill aplicado.')
      }
      else {
        toast.success(`Mercado resolvido como ${action === 'resolve-sim' ? 'SIM' : 'NAO'}.`)
      }
      await loadData()
    }
    else {
      toast.error(res.error || 'Falha ao executar a operacao.')
    }

    setMarketActionId(null)
  }

  const currentMarkets = useMemo(() => {
    if (activeTab === 'global') {
      return Array.isArray(globalHype) ? globalHype : []
    }
    if (activeTab === 'brazil') {
      return Array.isArray(brazilHype) ? brazilHype : []
    }
    if (activeTab === 'published') {
      return Array.isArray(published) ? published : []
    }
    return []
  }, [activeTab, brazilHype, globalHype, published])

  return (
    <div className="min-h-screen overflow-x-hidden bg-black p-4 text-white md:p-10">
      <div className="pointer-events-none fixed top-0 left-1/4 size-[500px] bg-emerald-500/5 blur-[120px]" />

      <div className="relative space-y-10">
        <div className="flex flex-col items-end justify-between gap-6 md:flex-row">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="
                rounded-sm bg-emerald-500 px-2 py-1 text-2xs font-black tracking-widest text-black uppercase
              "
              >
                Factory
              </div>
              <h1 className="translate-y-1 text-4xl font-black tracking-tighter uppercase italic">Hype Terminal</h1>
            </div>
            <p className="max-w-xl leading-relaxed font-medium text-zinc-500 italic">
              Monitore, publique e gerencie seus mercados de alta conversao.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-1.5 backdrop-blur-md">
            <button
              onClick={handleSyncOdds}
              disabled={syncing || loading}
              className="
                flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-3 text-xs
                font-black tracking-widest text-emerald-500 uppercase transition-all duration-300
                hover:bg-emerald-500 hover:text-black
                disabled:opacity-60
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
              <div className={`size-1.5 rounded-full ${activeTab === 'global'
                ? 'animate-pulse bg-emerald-500'
                : `bg-zinc-700`}`}
              />
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
              <div className={`size-1.5 rounded-full ${activeTab === 'published'
                ? `bg-emerald-400 shadow-[0_0_8px_#10b981]`
                : `bg-zinc-900`}`}
              />
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
              <div className="grid grid-cols-1 gap-8 pb-32 md:grid-cols-2 xl:grid-cols-3">
                {activeTab === 'published'
                  ? published.map(market => (
                      <div
                        key={market.id}
                        className="
                          group relative flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6
                          transition-all duration-500
                          hover:border-emerald-500/40
                        "
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="size-4 text-emerald-500" />
                            <span className="text-[9px] font-black tracking-widest text-emerald-500/60 uppercase">Mercado publicado</span>
                          </div>
                          <button
                            onClick={() => handleDelete(market.id)}
                            className="
                              rounded-lg bg-rose-500/10 p-2 text-rose-500 opacity-0 transition-all
                              group-hover:opacity-100
                              hover:bg-rose-500 hover:text-white
                            "
                            title="Excluir do Mercado Facil"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>

                        <div className="space-y-1">
                          <span className="font-mono text-2xs tracking-tighter text-zinc-600 uppercase">
                            ID:
                            {market.id}
                          </span>
                          <h4 className="line-clamp-3 text-base/tight font-black tracking-tighter uppercase italic">{market.titulo}</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                            <div className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Status</div>
                            <div className="mt-1 font-black text-white">{market.status}</div>
                          </div>
                          <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                            <div className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Origem</div>
                            <div className="mt-1 font-black text-white">{market.market_origin || 'manual'}</div>
                          </div>
                          <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                            <div className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Apostas</div>
                            <div className="mt-1 font-black text-emerald-400">{market.betCount}</div>
                          </div>
                          <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                            <div className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Ultima sync</div>
                            <div className="mt-1 font-medium text-zinc-300">{formatSyncDate(market.polymarket_last_sync)}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1 rounded-xl border border-white/5 bg-black/40 p-3">
                            <div className="text-center text-[8px] font-black tracking-widest text-zinc-500 uppercase">Pool SIM</div>
                            <div className="text-center font-mono text-sm font-black text-emerald-400 italic">{formatCurrency(market.total_sim)}</div>
                          </div>
                          <div className="space-y-1 rounded-xl border border-white/5 bg-black/40 p-3">
                            <div className="text-center text-[8px] font-black tracking-widest text-zinc-500 uppercase">Pool NAO</div>
                            <div className="text-center font-mono text-sm font-black text-white italic">{formatCurrency(market.total_nao)}</div>
                          </div>
                          <div className="space-y-1 rounded-xl border border-white/5 bg-black/40 p-3">
                            <div className="text-center text-[8px] font-black tracking-widest text-zinc-500 uppercase">Total apostado</div>
                            <div className="text-center font-mono text-sm font-black text-cyan-300 italic">{formatCurrency(market.totalApostado)}</div>
                          </div>
                          <div className="space-y-1 rounded-xl border border-white/5 bg-black/40 p-3">
                            <div className="text-center text-[8px] font-black tracking-widest text-zinc-500 uppercase">Reserva</div>
                            <div className="text-center font-mono text-sm font-black text-amber-300 italic">{formatCurrency(market.payout_reserve)}</div>
                          </div>
                        </div>

                        <div className="space-y-2 rounded-xl border border-white/5 bg-black/30 p-3">
                          <div className="
                            flex items-center gap-2 text-2xs font-black tracking-widest text-zinc-500 uppercase
                          "
                          >
                            <ShieldCheck className="size-3.5 text-emerald-400" />
                            Operacoes
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handlePublishedAction(market.id, 'sync')}
                              disabled={marketActionId === `${market.id}:sync`}
                              className="
                                rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px]
                                font-black tracking-wide text-emerald-400 transition
                                hover:bg-emerald-500 hover:text-black
                                disabled:opacity-60
                              "
                            >
                              {marketActionId === `${market.id}:sync` ? 'Sincronizando...' : 'Sync Polymarket'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePublishedAction(market.id, 'reimport')}
                              disabled={marketActionId === `${market.id}:reimport`}
                              className="
                                rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[11px] font-black
                                tracking-wide text-cyan-300 transition
                                hover:bg-cyan-300 hover:text-black
                                disabled:opacity-60
                              "
                            >
                              {marketActionId === `${market.id}:reimport` ? 'Atualizando...' : 'Reimportar / Backfill'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePublishedAction(market.id, 'resolve-sim')}
                              disabled={marketActionId === `${market.id}:resolve-sim`}
                              className="
                                rounded-xl border border-emerald-500/20 bg-black/40 px-3 py-2 text-[11px] font-black
                                tracking-wide text-emerald-400 transition
                                hover:bg-emerald-500 hover:text-black
                                disabled:opacity-60
                              "
                            >
                              Resolver SIM
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePublishedAction(market.id, 'resolve-nao')}
                              disabled={marketActionId === `${market.id}:resolve-nao`}
                              className="
                                rounded-xl border border-rose-500/20 bg-black/40 px-3 py-2 text-[11px] font-black
                                tracking-wide text-rose-400 transition
                                hover:bg-rose-500 hover:text-white
                                disabled:opacity-60
                              "
                            >
                              Resolver NAO
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 rounded-xl border border-white/5 bg-black/30 p-3">
                          <div className="
                            flex items-center gap-2 text-2xs font-black tracking-widest text-zinc-500 uppercase
                          "
                          >
                            <ScrollText className="size-3.5 text-cyan-300" />
                            Apostas recentes
                          </div>
                          <div className="space-y-2">
                            {market.recentBets.length === 0
                              ? <p className="text-xs text-zinc-500">Sem apostas registradas ainda.</p>
                              : market.recentBets.map(bet => (
                                  <div key={bet.id} className="rounded-xl border border-white/5 bg-black/40 p-3 text-xs">
                                    <div className="flex items-center justify-between gap-2 font-semibold text-white">
                                      <span>{bet.opcao}</span>
                                      <span>{formatCurrency(bet.valor)}</span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between gap-2 text-zinc-400">
                                      <span className="truncate">
                                        User:
                                        {bet.userId}
                                      </span>
                                      <span>{bet.status}</span>
                                    </div>
                                  </div>
                                ))}
                          </div>
                        </div>

                        <div className="space-y-2 rounded-xl border border-white/5 bg-black/30 p-3">
                          <div className="
                            flex items-center gap-2 text-2xs font-black tracking-widest text-zinc-500 uppercase
                          "
                          >
                            <RotateCcw className="size-3.5 text-amber-300" />
                            Auditoria
                          </div>
                          <div className="space-y-2">
                            {market.recentAudit.length === 0
                              ? <p className="text-xs text-zinc-500">Sem movimentacoes auditaveis ainda.</p>
                              : market.recentAudit.map(entry => (
                                  <div
                                    key={entry.id}
                                    className="rounded-xl border border-white/5 bg-black/40 p-3 text-xs"
                                  >
                                    <div className="flex items-center justify-between gap-2 font-semibold text-white">
                                      <span>{entry.tipo}</span>
                                      <span>{formatCurrency(entry.valor)}</span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between gap-2 text-zinc-400">
                                      <span className="truncate">
                                        User:
                                        {entry.userId}
                                      </span>
                                      <span>{entry.status}</span>
                                    </div>
                                  </div>
                                ))}
                          </div>
                        </div>

                        <div className="mt-auto space-y-3">
                          <div className="rounded-xl border border-white/5 bg-black/40 p-3 text-xs text-zinc-400">
                            <div className="flex items-center justify-between gap-2">
                              <span>Volume</span>
                              <strong className="text-white">{formatCurrency(market.volume)}</strong>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span>Payout garantido</span>
                              <strong className="text-white">{formatCurrency(market.totalGarantido)}</strong>
                            </div>
                          </div>

                          <a
                            href={`/event/live_${market.id}`}
                            target="_blank"
                            className="
                              flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800/50 py-3 text-2xs
                              font-black tracking-[0.2em] uppercase transition-all
                              hover:bg-emerald-500 hover:text-black
                            "
                          >
                            Ver no site
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                      </div>
                    ))
                  : currentMarkets.map(market => (
                      <HypeMarketCard key={market.id} market={market} />
                    ))}

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
