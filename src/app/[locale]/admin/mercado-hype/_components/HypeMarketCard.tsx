'use client'

import type { PolyHypeItem } from '../_actions/fetch-hype'
import { Check, Languages, Plus, PlusCircle, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { importExternalMarket } from '../_actions/import-market'

interface HypeMarketCardProps {
  market: PolyHypeItem
}

function previewTranslate(text: string) {
  let translated = text
  const dict: Record<string, string> = {
    'sells any Bitcoin': 'venderá seus Bitcoins',
    'out by': 'sairá do cargo até',
    'recession by end of': 'recessão até o fim de',
    'election called by': 'eleições convocadas por',
    'clash by': 'conflito até',
    'Presidential Election': 'Eleição Presidencial',
    'will resolve according to': 'será resolvido de acordo com',
    'will resolve to "Yes"': 'será resolvido como "Sim"',
    'if': 'se',
    'by': 'até',
  }

  Object.keys(dict).forEach((key) => {
    const regex = new RegExp(key, 'gi')
    translated = translated.replace(regex, dict[key])
  })

  return translated
}

function normalizeOutcomeLabel(value: string) {
  const normalized = value.toLowerCase()
  if (normalized === 'yes') { return 'SIM' }
  if (normalized === 'no') { return 'NÃO' }
  return value
}

function formatVolume(value: string | number | undefined) {
  const volumeValue = Number(String(value || 0).replace(/[^0-9.]/g, '') || 0)
  if (volumeValue > 1_000_000) { return `$${(volumeValue / 1_000_000).toFixed(1)}M` }
  if (volumeValue > 1_000) { return `$${(volumeValue / 1_000).toFixed(0)}K` }
  return `$${volumeValue.toFixed(0)}`
}

export default function HypeMarketCard({ market }: HypeMarketCardProps) {
  const [importing, setImporting] = useState(false)
  const [alreadyPublished, setAlreadyPublished] = useState(false)

  const preview = useMemo(() => ({
    question: previewTranslate(market.question),
    description: previewTranslate(market.description || ''),
    outcomes: (market.outcomes || ['Sim', 'Não']).map(normalizeOutcomeLabel),
  }), [market.description, market.outcomes, market.question])

  const volumeStr = formatVolume(market.volume)
  const outcomesToUse = preview.outcomes

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
        conditionId: market.conditionId,
        title: market.question || 'Sem título',
        description: market.description || '',
        image: market.image || '',
        volume: String(market.volume || '0'),
        volume_24h: String(market.volume_24h || '0'),
        outcomes: outcomesMapped,
        endDate: market.endDate || null,
        rules: market.rules || market.description || '',
      })

      if (res.success) {
        if ((res as any).alreadyExists) {
          setAlreadyPublished(true)
          toast.info('Este mercado já está ativo no Mercado Fácil.')
        }
        else {
          toast.success('Mercado publicado e traduzido para português.')
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
    <Card
      className="
        group relative z-10 flex min-h-[430px] flex-col overflow-hidden border-zinc-800 bg-zinc-900/60 backdrop-blur-xl
        transition-all duration-500 hover:border-emerald-500/50
      "
    >
      <div
        className="
          absolute inset-0 bg-linear-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 transition-opacity
          duration-500 group-hover:opacity-100
        "
      />

      <div className="absolute top-4 right-4 z-20">
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-black/80 px-2.5 py-1 backdrop-blur-md">
          <TrendingUp className="size-3 text-emerald-400" />
          <span className="font-mono text-2xs font-black tracking-tighter text-emerald-400">{volumeStr}</span>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            {market.image
              ? <img src={market.image} alt="" className="size-14 rounded-2xl object-cover ring-2 ring-white/5" />
              : (
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-zinc-800 ring-2 ring-emerald-500/20">
                    <PlusCircle className="size-7 text-zinc-600" />
                  </div>
                )}
            <div className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-4 border-zinc-950 bg-emerald-500">
              <div className="size-2 animate-pulse rounded-full bg-white" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base/tight font-black tracking-tighter text-white uppercase transition-colors group-hover:text-emerald-300 sm:text-[1.7rem] sm:leading-[1.05]">
              {preview.question}
            </h3>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-black tracking-[0.18em] uppercase">
              <span className="rounded-xl bg-white/5 px-3 py-1 text-zinc-400">
                Fonte Polymarket
              </span>
              {market.endDate && (
                <span className="rounded-xl border border-zinc-800 px-3 py-1 text-zinc-400">
                  Até {new Date(market.endDate).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black tracking-[0.16em] text-zinc-500 uppercase">
            <Languages className="size-3.5" />
            Prévia em português
          </div>
          <p className="line-clamp-4 text-sm leading-relaxed text-zinc-400 italic opacity-90">
            "{preview.description || 'Aguardando dados oficiais do oráculo...'}"
          </p>
        </div>

        <div className="mt-auto space-y-3">
          {outcomesToUse.length === 2
            ? (
                <>
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-black tracking-widest text-emerald-500/60 uppercase">
                        {outcomesToUse[0]}
                      </div>
                      <div className="font-mono text-2xl font-black tracking-tighter text-emerald-400">
                        {Math.round((Number(market.outcomePrices?.[0]) || 0.5) * 100)}%
                      </div>
                    </div>
                    <div className="min-w-0 text-right">
                      <div className="truncate text-[10px] font-black tracking-widest text-white/20 uppercase">
                        {outcomesToUse[1]}
                      </div>
                      <div className="font-mono text-base font-black text-zinc-500 italic">
                        {Math.round((Number(market.outcomePrices?.[1]) || 0.5) * 100)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex h-2 w-full overflow-hidden rounded-full border border-white/5 bg-zinc-800/50 p-0.5 shadow-inner">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all duration-1000 ease-out"
                      style={{ width: `${(Number(market.outcomePrices?.[0]) || 0.5) * 100}%` }}
                    />
                  </div>
                </>
              )
            : (
                <div className="grid max-h-[128px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {outcomesToUse.map((label: string, idx: number) => {
                    const pct = Math.round((Number(market.outcomePrices?.[idx]) || 0) * 100)
                    return (
                      <div key={idx} className="flex min-h-14 flex-col justify-between gap-1 rounded-xl border border-white/5 bg-white/5 p-3">
                        <span className="truncate text-[10px] font-bold text-zinc-500 uppercase">{label}</span>
                        <span className="font-mono text-sm font-black text-emerald-400">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              )}
        </div>
      </div>

      <div className="relative z-20 mt-auto border-t border-zinc-800/50 bg-zinc-950/80 p-4">
        <button
          onClick={handleImport}
          disabled={importing || alreadyPublished}
          className={`
            flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 px-4 py-4 text-center text-sm
            leading-tight font-black tracking-[0.14em] uppercase transition-all duration-300 whitespace-normal
            sm:text-base
            ${
              alreadyPublished
                ? 'border-emerald-500/20 bg-zinc-900 text-emerald-500/50'
                : 'group border-white bg-white text-black hover:bg-black hover:text-white'
            }`}
        >
          {importing
            ? <span>Publicando e traduzindo...</span>
            : alreadyPublished
              ? (
                  <>
                    <Check className="size-5 shrink-0" />
                    <span>Já Publicado</span>
                  </>
                )
              : (
                  <>
                    <Plus className="size-5 shrink-0 transition-transform group-hover:rotate-90" />
                    <span>Publicar no Mercado Fácil</span>
                  </>
                )}
        </button>
      </div>
    </Card>
  )
}
