'use client'

import { useState, useEffect } from 'react'
import type { PolyHypeItem } from '../_actions/fetch-hype'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { importExternalMarket } from '../_actions/import-market'
import { translateMarketAI } from '../_actions/translate-market'
import { 
  PlusCircle, 
  ChevronRight, 
  History, 
  Globe, 
  BarChart3, 
  Loader2, 
  Plus, 
  Check,
  TrendingUp 
} from 'lucide-react'

interface HypeMarketCardProps {
  market: PolyHypeItem
}

// Pequeno dicionário para tradução sem IA (mock)
const mockTranslate = (text: string) => {
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
  
  Object.keys(dict).forEach(key => {
    const regex = new RegExp(key, 'gi')
    t = t.replace(regex, dict[key])
  })
  
  // Se não traduziu nada substancial, apenas remove o '?' e coloca um prefixo
  if (t === text) return `[BR] ${text}`
  return t
}

export default function HypeMarketCard({ market }: HypeMarketCardProps) {
  const [translated, setTranslated] = useState<{ question: string; description: string; outcomes: string[] } | null>(null)
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
        } else {
          // Fallback para o mock manual se a IA falhar (sem chave)
          setTranslated({
            question: mockTranslate(market.question),
            description: mockTranslate(market.description),
            outcomes: market.outcomes || ['Sim', 'Não']
          })
        }
      } catch {
        setTranslated({
          question: mockTranslate(market.question),
          description: mockTranslate(market.description),
          outcomes: market.outcomes || ['Sim', 'Não']
        })
      } finally {
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
      const outcomesMapped = outcomesToUse.map((text: string, idx: number) => ({
        text: String(text || ''),
        price: Number(market.outcomePrices?.[idx]) || 0
      }))

      const res = await importExternalMarket({
        polyId: market.id,
        titulo: translated?.question || market.question || 'Sem título',
        descricao: translated?.description || market.description || '',
        volumeUSD: volumeValue,
        outcomes: outcomesMapped,
        imageUrl: market.image || ''
      })
      if (res.success) {
        if (res.alreadyExists) {
          setAlreadyPublished(true)
          toast.info('Este mercado já está ativo no Kuest.')
        } else {
          toast.success(`🚀 Sucesso! ID: ${res.id}`)
        }
      } else {
        toast.error(res.error || 'Erro desconhecido')
      }
    } catch (err: any) {
      toast.error('Erro de conexão: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card className="group relative overflow-hidden bg-zinc-900/60 border-zinc-800 backdrop-blur-xl hover:border-emerald-500/50 transition-all duration-500 flex flex-col h-[400px] z-10">
      {/* Background Gradient Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Volume Badge */}
      <div className="absolute top-4 right-4 z-20">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 border border-emerald-500/30 backdrop-blur-md">
          <TrendingUp className="size-3 text-emerald-400" />
          <span className="text-[10px] font-black text-emerald-400 font-mono tracking-tighter">{volumeStr}</span>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col gap-5 relative z-10">
        {/* Header with Image */}
        <div className="flex gap-4 items-start">
          <div className="relative">
            {market.image ? (
              <img src={market.image} alt="" className="size-14 rounded-2xl object-cover ring-2 ring-white/5" />
            ) : (
              <div className="size-14 bg-zinc-800 rounded-2xl flex items-center justify-center ring-2 ring-emerald-500/20">
                <PlusCircle className="size-7 text-zinc-600" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 size-5 bg-emerald-500 rounded-full border-4 border-zinc-950 flex items-center justify-center">
              <div className="size-2 bg-white rounded-full animate-pulse" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-white leading-tight group-hover:text-emerald-300 transition-colors line-clamp-2 uppercase tracking-tighter">
              {loading ? (
                <span className="inline-flex gap-2 items-center opacity-50 italic">
                  <Loader2 className="size-4 animate-spin" /> traduzindo...
                </span>
              ) : translated?.question}
            </h3>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] bg-white/5 px-2 py-0.5 rounded">Polymarket Live</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-black/20 p-3 rounded-xl border border-white/5">
          <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3 italic opacity-80">
            "{translated?.description || 'Aguardando dados oficiais do oráculo...'}"
          </p>
        </div>

        {/* Odds Section */}
        <div className="mt-auto space-y-3">
          {outcomesToUse.length === 2 ? (
            <>
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[9px] text-emerald-500/60 font-black uppercase tracking-widest">Liquid {outcomesToUse[0]}</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono tracking-tighter">
                    {Math.round((Number(market.outcomePrices?.[0]) || 0.5) * 100)}%
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">Market {outcomesToUse[1]}</span>
                  <span className="text-base font-black text-zinc-500 font-mono italic">
                    {Math.round((Number(market.outcomePrices?.[1]) || 0.5) * 100)}%
                  </span>
                </div>
              </div>
              
              <div className="h-2 w-full bg-zinc-800/50 rounded-full overflow-hidden flex p-0.5 border border-white/5 shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)] rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${(Number(market.outcomePrices?.[0]) || 0.5) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[80px] overflow-y-auto pr-1 custom-scrollbar">
              {outcomesToUse.map((label: string, idx: number) => {
                const pct = Math.round((Number(market.outcomePrices?.[idx]) || 0) * 100)
                return (
                  <div key={idx} className="bg-white/5 p-2 rounded-lg border border-white/5 flex flex-col gap-0.5">
                    <span className="text-[9px] text-zinc-500 font-bold truncate uppercase">{label}</span>
                    <span className="text-xs font-mono font-black text-emerald-400">{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Action Area */}
      <div className="p-4 bg-zinc-950/80 border-t border-zinc-800/50 relative z-20">
        <button
          onClick={handleImport}
          disabled={importing || alreadyPublished}
          className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-black uppercase tracking-widest transition-all duration-300 border-2 ${
            alreadyPublished 
              ? 'bg-zinc-900 border-emerald-500/20 text-emerald-500/50' 
              : 'bg-white border-white text-black hover:bg-black hover:text-white group'
          }`}
        >
          {importing ? (
            <Loader2 className="size-5 animate-spin" />
          ) : alreadyPublished ? (
            <>
              <Check className="size-5" />
              <span>Já Publicado</span>
            </>
          ) : (
            <>
              <Plus className="size-5 group-hover:rotate-90 transition-transform" />
              <span>Publicar no Kuest</span>
            </>
          )}
        </button>
      </div>
    </Card>
  )
}
