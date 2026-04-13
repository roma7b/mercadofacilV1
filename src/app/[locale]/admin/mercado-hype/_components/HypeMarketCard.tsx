'use client'

import type { PolyHypeItem } from '../_actions/fetch-hype'
import {
  BarChart3,
  Check,
  ChevronRight,
  Globe,
  History,
  Loader2,
  Plus,
  PlusCircle,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { importExternalMarket } from '../_actions/import-market'
import { translateMarketAI } from '../_actions/translate-market'

interface HypeMarketCardProps {
  market: PolyHypeItem
}

// Pequeno dicionário para tradução sem IA (mock)
function mockTranslate(text: string) {
  let t = text
  const dict: Record<string, string> = {
    'sells any Bitcoin': 'venderá seus Bitcoins',
    'out by': 'sairá do cargo até',
    'recession by end of': 'recessão até o fim de',
    'election called by': 'eleições convocadas por',
    'clash by': 'conflito até',
    'NATO/EU troops fighting in': 'tropas da OTAN/UE lutando em',
    'Kraken IPO': 'IPO da Kraken',
    'MicroStrategy': 'MicroStrategy',
    'Macron': 'Macron',
    'election': 'eleição',
    'by': 'até',
    'will resolve to "Yes"': 'será resolvido como "Sim"',
    'if': 'se',
  }

  Object.keys(dict).forEach((key) => {
    const regex = new RegExp(key, 'gi')
    t = t.replace(regex, dict[key])
  })

  // Se não traduziu nada substancial, apenas remove o '?' e coloca um prefixo
  if (t === text) { return `[BR] ${text}` }
  return t
}

export default function HypeMarketCard({ market }: HypeMarketCardProps) {
  const [translated, setTranslated] = useState<{ question: string, description: string, outcomes: string[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [alreadyPublished, setAlreadyPublished] = useState(false)

  const volumeValue = Number(market.volume?.toString().replace(/[^0-9.]/g, '') || 0)
  const volumeStr = volumeValue > 1_000_000
    ? `$${(volumeValue / 1_000_000).toFixed(1)}M`
    : volumeValue > 1_000
      ? `$${(volumeValue / 1_000).toFixed(0)}K`
      : `$${volumeValue.toFixed(0)}`

  useEffect(() => {
    const translate = async () => {
      setLoading(true)
      try {
        // Tenta IA primeiro
        const res = await translateMarketAI(market.question, market.description, market.outcomes)
        if (res.success && res.data) {
          setTranslated(res.data)
        }
        else {
          // Fallback para o mock manual se a IA falhar (sem chave)
          setTranslated({
            question: mockTranslate(market.question),
            description: mockTranslate(market.description),
            outcomes: market.outcomes || ['Sim', 'Não'],
          })
        }
      }
      catch {
        setTranslated({
          question: mockTranslate(market.question),
          description: mockTranslate(market.description),
          outcomes: market.outcomes || ['Sim', 'Não'],
        })
      }
      finally {
        setLoading(false)
      }
    }
    translate()
  }, [market.id])

  const outcomesToUse = Array.isArray(translated?.outcomes)
    ? translated.outcomes
    : (Array.isArray(market.outcomes) ? market.outcomes : ['Sim', 'Não'])

  const handleImport = async () => {
    setImporting(true)
    try {
      const outcomesMapped = outcomesToUse.map((label: string, idx: number) => ({
        text: label,
        price: market.outcomePrices?.[idx] || '0.5',
        tokenId: market.outcomesTokens?.[idx] || `${market.id}-${idx}`,
      }))

      const res = await importExternalMarket({
        polyId: market.id,
        title: translated?.question || market.question || 'Sem título',
        description: translated?.description || market.description || '',
        image: market.image || '',
        volume: String(market.volume || '0'),
        volume_24h: String(market.volume_24h || '0'),
        outcomes: outcomesMapped,
        endDate: market.endDate || null,
      })
      if (res.success) {
        if ((res as any).alreadyExists) {
          setAlreadyPublished(true)
          toast.info('Este mercado já está ativo no Kuest.')
        }
        else {
          toast.success(`🚀 Sucesso! ID: ${res.id}`)
        }
      }
      else {
        toast.error(res.error || 'Erro desconhecido')
      }
    }
    catch (err: any) {
      toast.error(`Erro de conexão: ${err.message}`)
    }
    finally {
      setImporting(false)
    }
  }

  return (
    <Card className="
      group relative z-10 flex h-[400px] flex-col overflow-hidden border-zinc-800 bg-zinc-900/60 backdrop-blur-xl
      transition-all duration-500
      hover:border-emerald-500/50
    "
    >
      {/* Background Gradient Effect */}
      <div className="
        absolute inset-0 bg-linear-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 transition-opacity
        duration-500
        group-hover:opacity-100
      "
      />

      {/* Volume Badge */}
      <div className="absolute top-4 right-4 z-20">
        <div className="
          flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-black/80 px-2.5 py-1 backdrop-blur-md
        "
        >
          <TrendingUp className="size-3 text-emerald-400" />
          <span className="font-mono text-2xs font-black tracking-tighter text-emerald-400">{volumeStr}</span>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col gap-5 p-6">
        {/* Header with Image */}
        <div className="flex items-start gap-4">
          <div className="relative">
            {market.image
              ? (
                  <img src={market.image} alt="" className="size-14 rounded-2xl object-cover ring-2 ring-white/5" />
                )
              : (
                  <div className="
                    flex size-14 items-center justify-center rounded-2xl bg-zinc-800 ring-2 ring-emerald-500/20
                  "
                  >
                    <PlusCircle className="size-7 text-zinc-600" />
                  </div>
                )}
            <div className="
              absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-4 border-zinc-950
              bg-emerald-500
            "
            >
              <div className="size-2 animate-pulse rounded-full bg-white" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="
              line-clamp-2 text-base/tight font-black tracking-tighter text-white uppercase transition-colors
              group-hover:text-emerald-300
            "
            >
              {loading
                ? (
                    <span className="inline-flex items-center gap-2 italic opacity-50">
                      <Loader2 className="size-4 animate-spin" />
                      {' '}
                      traduzindo...
                    </span>
                  )
                : translated?.question}
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <span className="
                rounded-sm bg-white/5 px-2 py-0.5 text-[9px] font-black tracking-[0.2em] text-zinc-500 uppercase
              "
              >
                Polymarket Live
              </span>
              {market.endDate && (
                <span className="
                  border-l border-zinc-700 pl-2 text-[9px] font-bold tracking-widest text-zinc-400 uppercase
                "
                >
                  Até
                  {' '}
                  {new Date(market.endDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
          <p className="line-clamp-3 text-[11px] leading-relaxed text-zinc-400 italic opacity-80">
            "
            {translated?.description || 'Aguardando dados oficiais do oráculo...'}
            "
          </p>
        </div>

        {/* Odds Section */}
        <div className="mt-auto space-y-3">
          {outcomesToUse.length === 2
            ? (
                <>
                  <div className="flex items-end justify-between">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black tracking-widest text-emerald-500/60 uppercase">
                        Liquid
                        {outcomesToUse[0]}
                      </span>
                      <span className="font-mono text-2xl font-black tracking-tighter text-emerald-400">
                        {Math.round((Number(market.outcomePrices?.[0]) || 0.5) * 100)}
                        %
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black tracking-widest text-white/20 uppercase">
                        Market
                        {outcomesToUse[1]}
                      </span>
                      <span className="font-mono text-base font-black text-zinc-500 italic">
                        {Math.round((Number(market.outcomePrices?.[1]) || 0.5) * 100)}
                        %
                      </span>
                    </div>
                  </div>

                  <div className="
                    flex h-2 w-full overflow-hidden rounded-full border border-white/5 bg-zinc-800/50 p-0.5 shadow-inner
                  "
                  >
                    <div
                      className="
                        h-full rounded-full bg-linear-to-r from-emerald-600 to-emerald-400
                        shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all duration-1000 ease-out
                      "
                      style={{ width: `${(Number(market.outcomePrices?.[0]) || 0.5) * 100}%` }}
                    />
                  </div>
                </>
              )
            : (
                <div className="custom-scrollbar grid max-h-[80px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {outcomesToUse.map((label: string, idx: number) => {
                    const pct = Math.round((Number(market.outcomePrices?.[idx]) || 0) * 100)
                    return (
                      <div key={idx} className="flex flex-col gap-0.5 rounded-lg border border-white/5 bg-white/5 p-2">
                        <span className="truncate text-[9px] font-bold text-zinc-500 uppercase">{label}</span>
                        <span className="font-mono text-xs font-black text-emerald-400">
                          {pct}
                          %
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
        </div>
      </div>

      {/* Action Area */}
      <div className="relative z-20 border-t border-zinc-800/50 bg-zinc-950/80 p-4">
        <button
          onClick={handleImport}
          disabled={importing || alreadyPublished}
          className={`
            flex w-full items-center justify-center gap-3 rounded-xl border-2 py-4 font-black tracking-widest uppercase
            transition-all duration-300
            ${
    alreadyPublished
      ? 'border-emerald-500/20 bg-zinc-900 text-emerald-500/50'
      : 'group border-white bg-white text-black hover:bg-black hover:text-white'
    }`}
        >
          {importing
            ? (
                <Loader2 className="size-5 animate-spin" />
              )
            : alreadyPublished
              ? (
                  <>
                    <Check className="size-5" />
                    <span>Já Publicado</span>
                  </>
                )
              : (
                  <>
                    <Plus className="size-5 transition-transform group-hover:rotate-90" />
                    <span>Publicar no Kuest</span>
                  </>
                )}
        </button>
      </div>
    </Card>
  )
}
