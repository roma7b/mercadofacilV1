'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { useBalance } from '@/hooks/useBalance'

const { useSession } = authClient

interface Market {
  id: string
  titulo: string
  categoria: string
  status: string
  total_sim: number
  total_nao: number
  data_resolucao: string
}

interface PainelApostasProps {
  marketId: string
}

export default function PainelApostas({ marketId }: PainelApostasProps) {
  const [market, setMarket] = useState<Market | null>(null)
  const [loading, setLoading] = useState(true)
  const [opcaoSelecionada, setOpcaoSelecionada] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null)
  const [isOptionPickerOpen, setIsOptionPickerOpen] = useState(false)
  const [optionSearch, setOptionSearch] = useState('')
  const { data: session } = useSession()
  const { refetchBalance } = useBalance()

  const fetchMarket = useCallback(async () => {
    try {
      const res = await fetch(`/api/mercado/${marketId}`)
      const json = await res.json()
      if (json.data) {
        setMarket({
           ...json.data,
           opcoes: json.data.opcoes || { sim: 'SIM', nao: 'NÃO' }
        })
      }
    }
    catch (err) {
      console.error('Falha ao buscar dados do pool no PainelApostas:', err)
    }
    finally {
      setLoading(false)
    }
  }, [marketId])

  useEffect(() => {
    fetchMarket()
    // Atualiza pool a cada 30s
    const interval = setInterval(fetchMarket, 30_000)
    return () => clearInterval(interval)
  }, [fetchMarket])

  const totalSim = Number(market?.total_sim) || 0
  const totalNao = Number(market?.total_nao) || 0
  const totalPool = totalSim + totalNao

  const chanceSim = totalPool > 0 ? Math.round((totalSim / totalPool) * 100) : 50
  const chanceNao = 100 - chanceSim

  // Mapeamento de opções
  const rawOpcoes = (market as any)?.opcoes || { sim: 'SIM', nao: 'NÃO' }
  const optionsEntries = Object.entries(rawOpcoes).map(([key, label]) => {
     let displayLabel = String(label)
     if (displayLabel.toLowerCase() === 'yes') displayLabel = 'SIM'
     if (displayLabel.toLowerCase() === 'no') displayLabel = 'NÃO'
     return { key, label: displayLabel }
  })

  // Cálculo de odds AMM simplificado para preview
  const valorNum = Number.parseFloat(valor.replace(',', '.')) || 0
  let multiplicadorPreview = 2.0
  if (valorNum > 0 && market && opcaoSelecionada) {
    if (opcaoSelecionada === 'sim' || opcaoSelecionada === 'SIM' || opcaoSelecionada === 'op_0') {
      multiplicadorPreview = (totalPool + valorNum) / Math.max(totalSim + valorNum, 0.01)
    }
    else {
      multiplicadorPreview = (totalPool + valorNum) / Math.max(totalNao + valorNum, 0.01)
    }
    multiplicadorPreview = Math.min(Math.max(multiplicadorPreview, 1.01), 100)
  }
  const ganhoEstimado = valorNum > 0 ? valorNum * multiplicadorPreview : 0
  const selectedOptionLabel = optionsEntries.find(option => option.key === opcaoSelecionada)?.label ?? '—'
  const filteredOptions = useMemo(() => {
    const normalizedQuery = optionSearch.trim().toLowerCase()
    if (!normalizedQuery) {
      return optionsEntries
    }
    return optionsEntries.filter(option => option.label.toLowerCase().includes(normalizedQuery))
  }, [optionSearch, optionsEntries])

  async function handleApostar() {
    if (!opcaoSelecionada || valorNum <= 0) {
      setFeedback({ tipo: 'erro', mensagem: 'Selecione uma opção e informe um valor.' })
      return
    }
    if (valorNum < 1) {
      setFeedback({ tipo: 'erro', mensagem: 'Valor mínimo de aposta: R$ 1,00.' })
      return
    }

    setEnviando(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/mercado/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_id: marketId,
          opcao: opcaoSelecionada,
          valor: valorNum,
          user_id: session?.user?.id,
        }),
      })
      const json = await res.json()

      if (json.success) {
        const optionLabel = optionsEntries.find(o => o.key === opcaoSelecionada)?.label || opcaoSelecionada
        setFeedback({
          tipo: 'sucesso',
          mensagem: `✅ Aposta confirmada! Você apostou R$${valorNum.toFixed(2)} em ${optionLabel}. Ganho potencial: R$${ganhoEstimado.toFixed(2)}`,
        })
        setValor('')
        setOpcaoSelecionada(null)
        fetchMarket()
        refetchBalance()
      }
      else {
        setFeedback({ tipo: 'erro', mensagem: json.error ?? 'Erro ao processar aposta.' })
      }
    }
    catch {
      setFeedback({ tipo: 'erro', mensagem: 'Erro de conexão. Tente novamente.' })
    }
    finally {
      setEnviando(false)
    }
  }

  const dataResolucao = (market as any)?.data_resolucao
    ? new Date((market as any).data_resolucao).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—'

  return (
    <>
      <div className="flex flex-col gap-5 rounded-2xl border border-white/5 bg-[#0b0f1a]/80 p-6 text-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-500">
      {/* Header do Terminal */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <div className="size-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/80">
            Live Trading Terminal
          </span>
        </div>
        <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
          {session?.user ? `ID: ${session.user.id.slice(0, 8)}...` : 'Offline'}
        </div>
      </div>

      {loading
        ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="size-10 animate-spin rounded-full border-2 border-white/5 border-t-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/30 animate-pulse">Iniciando protocolo...</span>
            </div>
          )
        : !market
          ? (
              <div className="text-center py-12 px-4 bg-white/5 rounded-xl border border-white/5">
                <p className="text-sm text-white/40 italic">O terminal não conseguiu conectar-se a este mercado.</p>
              </div>
            )
          : (
              <>
                <div className="rounded-xl border border-sky-400/20 bg-sky-500/5 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-sky-300/80">Como funciona</p>
                  <p className="mt-1 text-xs text-white/80">1) Escolha uma opção  2) Defina o valor  3) Confirme sua aposta</p>
                </div>

                {/* Mostrador de Chance e Liquidez Centralizado */}
                <div className="relative flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/5 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05),transparent)] pointer-events-none" />
                  
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Liquidez Total</div>
                  <div className="text-3xl font-black text-white font-mono tracking-tighter mb-4">
                    R$ {totalPool.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>

                  <div className="w-full space-y-4">
                    <div className="flex justify-between text-[11px] font-black uppercase tracking-widest px-1">
                      <span className="text-emerald-500">{optionsEntries[0]?.label || 'SIM'}</span>
                      <span className="text-rose-500">{optionsEntries[1]?.label || 'NÃO'}</span>
                    </div>
                    {/* Barra de Progresso High-Tech */}
                    <div className="relative h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                      <div 
                        className="absolute h-full left-0 bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all duration-1000 ease-out"
                        style={{ width: `${chanceSim}%` }}
                      />
                    </div>
                    <div className="flex justify-between font-mono text-2xl font-black px-1">
                      <span className="text-emerald-500/90">{chanceSim}%</span>
                      <span className="text-rose-500/90">{chanceNao}%</span>
                    </div>
                  </div>
                </div>

                {/* Seleção de Opções */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">Escolha sua Posição</label>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/35">Selecionado</p>
                        <p className="truncate text-sm font-bold text-white">{selectedOptionLabel}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOptionSearch('')
                          setIsOptionPickerOpen(true)
                        }}
                        className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/80 transition-colors hover:bg-white/15"
                      >
                        Escolher
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bloco de Aposta */}
                <div className="space-y-4 pt-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Passo atual</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {opcaoSelecionada ? `Comprar ${selectedOptionLabel}` : 'Selecione uma opção para continuar'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-end px-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Valor para Investir</label>
                      <button 
                        onClick={() => setValor('1000')}
                        className="text-[10px] font-bold text-emerald-500/60 hover:text-emerald-500 transition-colors"
                      >
                        MÁXIMO
                      </button>
                    </div>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-emerald-500 group-focus-within:scale-110 transition-transform">R$</div>
                      <input
                        id="valor-aposta"
                        type="number"
                        value={valor}
                        onChange={e => setValor(e.target.value)}
                        placeholder="0,00"
                        className={`
                          w-full rounded-xl border border-white/5 bg-white/5 py-5 pl-12 pr-4 text-xl font-black text-white 
                          placeholder:text-white/5 outline-none transition-all
                          focus:border-emerald-500/50 focus:bg-emerald-500/5 focus:shadow-[0_0_20px_rgba(16,185,129,0.1)]
                        `}
                      />
                    </div>
                    {/* Chips Rápidos */}
                    <div className="grid grid-cols-4 gap-2">
                      {[10, 50, 100, 500].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setValor(String(v))}
                          className="rounded-lg border border-white/5 bg-white/5 py-2.5 text-[10px] font-black text-white/30 transition-all hover:bg-white/10 hover:text-emerald-500 hover:border-emerald-500/30"
                        >
                          +{v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview com Design de Retorno */}
                  {valorNum > 0 && opcaoSelecionada && (
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60">Multiplicador</span>
                        <div className="px-2 py-1 rounded bg-emerald-500 text-black text-[11px] font-black font-mono">
                          {multiplicadorPreview.toFixed(2)}x
                        </div>
                      </div>
                      <div className="flex justify-between items-end border-t border-emerald-500/10 pt-4">
                        <span className="text-xs font-bold text-white/40 mb-1">RETORNO POTENCIAL</span>
                        <div className="flex flex-col items-end">
                          <span className="text-2xl font-black text-emerald-400 font-mono tracking-tighter">
                            R$ {ganhoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-400/50">+{((multiplicadorPreview - 1) * 100).toFixed(0)}% LUCRO</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alertas e Feedback */}
                  {feedback && (
                    <div className={`rounded-xl p-4 text-xs font-bold border animate-in zoom-in-95 duration-200 ${
                      feedback.tipo === 'sucesso'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                    }`}
                    >
                      {feedback.mensagem}
                    </div>
                  )}

                  {/* Botão de Execução de Order Flow */}
                  <button
                    id="btn-confirmar-aposta"
                    type="button"
                    disabled={!opcaoSelecionada || valorNum <= 0 || enviando}
                    onClick={handleApostar}
                    className={`
                      group relative w-full rounded-xl py-5 text-sm font-black uppercase tracking-[0.2em] transition-all duration-300 overflow-hidden
                      ${!opcaoSelecionada || valorNum <= 0
                    ? 'cursor-not-allowed bg-white/5 text-white/10'
                    : 'bg-emerald-500 text-white hover:bg-emerald-400 hover:scale-[1.02] active:scale-95 shadow-[0_10px_30px_rgba(16,185,129,0.3)]'}
                    `}
                  >
                    {/* Efeito de Reflexo no Botão Ativo */}
                    {opcaoSelecionada && valorNum > 0 && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />}
                    
                    {enviando
                      ? (
                          <span className="flex items-center justify-center gap-3">
                            <div className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                            PROCESSANDO...
                          </span>
                        )
                      : opcaoSelecionada
                        ? `Confirmar Aposta`
                        : 'Selecione uma Opção'}
                  </button>
                </div>

                {/* Oracle Validation */}
                <div className="flex items-center justify-between border-t border-white/5 pt-5 text-[9px] font-black uppercase tracking-[0.15em] text-white/10">
                  <div className="flex items-center gap-2">
                    <LockKeyholeIcon className="size-3" />
                    <span>ORACLE VALIDATION SECURED</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>RESOLUÇÃO:</span>
                    <span className="text-white/30 font-mono">{dataResolucao}</span>
                  </div>
                </div>
              </>
            )}
      </div>
      {isOptionPickerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0b0f1a] p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/85">Escolher opção</h3>
            <button
              type="button"
              onClick={() => setIsOptionPickerOpen(false)}
              className="rounded-md border border-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white"
            >
              Fechar
            </button>
          </div>
          <input
            type="text"
            value={optionSearch}
            onChange={event => setOptionSearch(event.target.value)}
            placeholder="Buscar nome..."
            className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-500/50"
          />
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {filteredOptions.map((opt) => {
              const isSelected = opcaoSelecionada === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setOpcaoSelecionada(opt.key)
                    setIsOptionPickerOpen(false)
                  }}
                  className={`
                    flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors
                    ${isSelected
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'}
                  `}
                >
                  <span className="truncate pr-3 text-sm font-semibold">{opt.label}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
                    {isSelected ? 'Selecionado' : 'Escolher'}
                  </span>
                </button>
              )
            })}
            {filteredOptions.length === 0 && (
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-4 text-center text-xs text-white/50">
                Nenhuma opção encontrada.
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </>
  )
}

function LockKeyholeIcon(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/>
    </svg>
  )
}
