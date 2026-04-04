'use client'

import { useCallback, useEffect, useState } from 'react'
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
  const [opcaoSelecionada, setOpcaoSelecionada] = useState<'SIM' | 'NAO' | null>(null)
  const [valor, setValor] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null)
  const { data: session } = useSession()
  const { refetchBalance } = useBalance()

  const fetchMarket = useCallback(async () => {
    try {
      const res = await fetch(`/api/mercado/${marketId}`)
      const json = await res.json()
      if (json.data) {
        setMarket(json.data)
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

  // Cálculo de odds AMM simplificado para preview
  const valorNum = Number.parseFloat(valor.replace(',', '.')) || 0
  let multiplicadorPreview = 2.0
  if (valorNum > 0 && market && opcaoSelecionada) {
    if (opcaoSelecionada === 'SIM') {
      multiplicadorPreview = (totalPool + valorNum) / Math.max(totalSim + valorNum, 0.01)
    }
    else {
      multiplicadorPreview = (totalPool + valorNum) / Math.max(totalNao + valorNum, 0.01)
    }
    multiplicadorPreview = Math.min(Math.max(multiplicadorPreview, 1.01), 100)
  }
  const ganhoEstimado = valorNum > 0 ? valorNum * multiplicadorPreview : 0

  async function handleApostar() {
    if (!opcaoSelecionada || valorNum <= 0) {
      setFeedback({ tipo: 'erro', mensagem: 'Selecione SIM ou NÃO e informe um valor.' })
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
        setFeedback({
          tipo: 'sucesso',
          mensagem: `✅ Aposta confirmada! Você apostou R$${valorNum.toFixed(2)} em ${opcaoSelecionada}. Ganho potencial: R$${ganhoEstimado.toFixed(2)}`,
        })
        setValor('')
        setOpcaoSelecionada(null)
        // Atualiza o mercado com os novos pools
        fetchMarket()
        // Atualiza o saldo global na barra de navegação
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

  const dataResolucao = market?.data_resolucao
    ? new Date(market.data_resolucao).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—'

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#111827] p-4 text-white">
      {/* Título */}
      <div className="text-xs font-semibold uppercase tracking-wider text-white/40">
        Painel de Apostas
      </div>

      {loading
        ? (
            <div className="flex items-center justify-center py-6">
              <div className="size-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          )
        : !market
          ? (
              <p className="text-sm text-white/50">Mercado não encontrado.</p>
            )
          : (
              <>
                {/* Pool atual */}
                <div className="rounded-lg bg-white/5 p-3">
                  <div className="mb-2 flex justify-between text-xs text-white/50">
                    <span>Pool total</span>
                    <span>
                      R$
                      {totalPool.toFixed(2)}
                    </span>
                  </div>

                  {/* Barra de probabilidade */}
                  <div className="relative h-3 overflow-hidden rounded-full bg-rose-900/50">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${chanceSim}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs font-semibold">
                    <span className="text-emerald-400">
                      SIM
                      {' '}
                      {chanceSim}
                      %
                    </span>
                    <span className="text-rose-400">
                      NÃO
                      {' '}
                      {chanceNao}
                      %
                    </span>
                  </div>
                </div>

                {/* Botões de escolha */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="btn-apostar-sim"
                    type="button"
                    onClick={() => setOpcaoSelecionada('SIM')}
                    className={`
                      flex flex-col items-center rounded-lg border p-3 transition-all duration-150
                      ${opcaoSelecionada === 'SIM'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-emerald-500/50 hover:bg-emerald-500/10'}
                    `}
                  >
                    <span className="text-lg font-bold">SIM</span>
                    <span className="mt-0.5 text-xs opacity-70">
                      {chanceSim}
                      % de chance
                    </span>
                  </button>

                  <button
                    id="btn-apostar-nao"
                    type="button"
                    onClick={() => setOpcaoSelecionada('NAO')}
                    className={`
                      flex flex-col items-center rounded-lg border p-3 transition-all duration-150
                      ${opcaoSelecionada === 'NAO'
                    ? 'border-rose-500 bg-rose-500/20 text-rose-400'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-rose-500/50 hover:bg-rose-500/10'}
                    `}
                  >
                    <span className="text-lg font-bold">NÃO</span>
                    <span className="mt-0.5 text-xs opacity-70">
                      {chanceNao}
                      % de chance
                    </span>
                  </button>
                </div>

                {/* Input de valor */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="valor-aposta" className="text-xs text-white/50">
                    Valor da aposta (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">R$</span>
                    <input
                      id="valor-aposta"
                      type="number"
                      min="1"
                      step="1"
                      value={valor}
                      onChange={e => setValor(e.target.value)}
                      placeholder="0,00"
                      className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  {/* Atalhos de valor */}
                  <div className="flex gap-1.5">
                    {[5, 10, 25, 50].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setValor(String(v))}
                        className="flex-1 rounded-md border border-white/10 bg-white/5 py-1 text-xs text-white/60 transition-colors hover:bg-white/10"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview de ganho */}
                {valorNum > 0 && opcaoSelecionada && (
                  <div className="rounded-lg bg-white/5 px-3 py-2.5">
                    <div className="flex justify-between text-xs text-white/50">
                      <span>Odds estimadas</span>
                      <span className="font-semibold text-white/80">
                        {multiplicadorPreview.toFixed(2)}
                        x
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-sm font-bold">
                      <span className="text-white/70">Ganho potencial</span>
                      <span className="text-emerald-400">
                        R$
                        {ganhoEstimado.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {feedback && (
                  <div className={`rounded-lg px-3 py-2.5 text-sm ${
                    feedback.tipo === 'sucesso'
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : 'bg-rose-900/50 text-rose-400'
                  }`}
                  >
                    {feedback.mensagem}
                  </div>
                )}

                {/* Botão apostar */}
                <button
                  id="btn-confirmar-aposta"
                  type="button"
                  disabled={!opcaoSelecionada || valorNum <= 0 || enviando}
                  onClick={handleApostar}
                  className={`
                    w-full rounded-lg py-3 text-sm font-bold transition-all duration-150
                    ${!opcaoSelecionada || valorNum <= 0
                  ? 'cursor-not-allowed bg-white/10 text-white/30'
                  : opcaoSelecionada === 'SIM'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95'
                    : 'bg-rose-600 text-white hover:bg-rose-500 active:scale-95'}
                  `}
                >
                  {enviando
                    ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Processando...
                        </span>
                      )
                    : opcaoSelecionada
                      ? `Apostar R$${valorNum > 0 ? valorNum.toFixed(2) : '0,00'} em ${opcaoSelecionada}`
                      : 'Selecione SIM ou NÃO'}
                </button>

                {/* Data de resolução */}
                <div className="flex items-center justify-between border-t border-white/5 pt-2 text-xs text-white/30">
                  <span>Resolução</span>
                  <span>{dataResolucao}</span>
                </div>
              </>
            )}
    </div>
  )
}
