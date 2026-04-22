'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangleIcon, ArrowDownLeftIcon, ArrowUpRightIcon, Clock3Icon, CreditCardIcon, WalletIcon } from 'lucide-react'
import { reconcileWalletsAction } from '@/app/[locale]/admin/finance/_actions/reconcile-wallets'
import { approveWithdrawAction, rejectWithdrawAction } from '@/app/[locale]/admin/finance/_actions/withdraw-review'
import WalletReconciliationPanel from '@/app/[locale]/admin/finance/_components/WalletReconciliationPanel'

function formatCurrency(value: string | number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}

function formatUserLabel(row: { username: string | null, email: string | null, address: string | null }) {
  return row.username || row.email || row.address || 'Usuário sem identificação'
}

function statusClassName(status: string | null | undefined) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'CONFIRMADO') return 'bg-emerald-500/10 text-emerald-400'
  if (normalized === 'EM_ANALISE') return 'bg-sky-500/10 text-sky-300'
  if (normalized === 'PENDENTE') return 'bg-amber-500/10 text-amber-300'
  if (normalized === 'FALHOU') return 'bg-rose-500/10 text-rose-400'
  return 'bg-zinc-500/10 text-zinc-300'
}

export default function FinanceDashboardClient({ initialData = null, initialError = null }: { initialData?: any | null, initialError?: string | null }) {
  const [data, setData] = useState<any | null>(initialData)
  const [loading, setLoading] = useState(!initialData && !initialError)
  const [error, setError] = useState<string | null>(initialError)
  const hasStartedRef = useRef(false)

  useEffect(() => {
    if (initialData || initialError) {
      return
    }

    if (hasStartedRef.current) {
      return
    }
    hasStartedRef.current = true

    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/admin/finance/overview', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'Falha ao carregar financeiro')
        }
        if (!cancelled) {
          setData(payload.data)
        }
      }
      catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Falha ao carregar financeiro')
        }
      }
      finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [initialData, initialError])

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Carregando dados financeiros...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-rose-400">
        {error || 'Falha ao carregar financeiro.'}
      </div>
    )
  }

  const {
    walletSummary,
    pendingDepositsSummary,
    pendingWithdrawsSummary,
    failedSummary,
    confirmedDepositsSummary,
    confirmedWithdrawsSummary,
    activeBetsSummary,
    topWallets,
    recentTransactions,
    pendingWithdrawals,
    pendingDeposits,
  } = data

  return (
    <div className="grid min-w-0 gap-6">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <div className="min-w-0 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">Saldo em carteiras</span>
            <WalletIcon className="size-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{formatCurrency(walletSummary?.totalSaldo)}</div>
          <p className="mt-1 text-xs text-muted-foreground">{walletSummary?.totalWallets || 0} carteiras com saldo operacional.</p>
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">Depósitos pendentes</span>
            <ArrowDownLeftIcon className="size-4 text-cyan-400" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{formatCurrency(pendingDepositsSummary?.total)}</div>
          <p className="mt-1 text-xs text-muted-foreground">{pendingDepositsSummary?.count || 0} cobranças aguardando confirmação.</p>
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">Saques pendentes</span>
            <ArrowUpRightIcon className="size-4 text-amber-300" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{formatCurrency(pendingWithdrawsSummary?.total)}</div>
          <p className="mt-1 text-xs text-muted-foreground">{pendingWithdrawsSummary?.count || 0} saques em análise ou aguardando HorsePay.</p>
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">Falhas financeiras</span>
            <AlertTriangleIcon className="size-4 text-rose-400" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{formatCurrency(failedSummary?.total)}</div>
          <p className="mt-1 text-xs text-muted-foreground">{failedSummary?.count || 0} transações com erro.</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        <div className="min-w-0 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">HorsePay nas últimas 24h</h2>
            <CreditCardIcon className="size-4 text-cyan-400" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Depósitos confirmados</div>
              <div className="mt-2 text-lg font-semibold">{formatCurrency(confirmedDepositsSummary?.total)}</div>
              <div className="text-xs text-muted-foreground">{confirmedDepositsSummary?.count || 0} ordens</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Saques confirmados</div>
              <div className="mt-2 text-lg font-semibold">{formatCurrency(confirmedWithdrawsSummary?.total)}</div>
              <div className="text-xs text-muted-foreground">{confirmedWithdrawsSummary?.count || 0} ordens</div>
            </div>
          </div>
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Capital em apostas abertas</h2>
            <Clock3Icon className="size-4 text-amber-300" />
          </div>
          <div className="mt-4 rounded-lg bg-muted/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Apostas pendentes</div>
            <div className="mt-2 text-lg font-semibold">{formatCurrency(activeBetsSummary?.total)}</div>
            <div className="text-xs text-muted-foreground">{activeBetsSummary?.count || 0} apostas ainda em aberto</div>
          </div>
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Fila operacional</h2>
            <Clock3Icon className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">PIX aguardando</div>
              <div className="mt-2 text-lg font-semibold">{pendingDepositsSummary?.count || 0}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Saques aguardando</div>
              <div className="mt-2 text-lg font-semibold">{pendingWithdrawsSummary?.count || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Reconciliação de carteiras</h2>
            <p className="mt-1 text-xs text-muted-foreground">Repare o histórico quando necessário e carregue a auditoria apenas sob demanda.</p>
          </div>
          <form action={reconcileWalletsAction}>
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
              Reconciliar carteiras
            </button>
          </form>
        </div>
        <div className="mt-4">
          <WalletReconciliationPanel />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,1fr)]">
        <div className="min-w-0 rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Transações recentes</h2>
            <p className="text-xs text-muted-foreground">Últimas movimentações financeiras registradas no sistema.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Referência</th>
                  <th className="px-4 py-3 font-medium">HorsePay</th>
                  <th className="px-4 py-3 font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma transação encontrada.</td></tr>
                ) : recentTransactions.map((transaction: any) => (
                  <tr key={transaction.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3"><div className="font-medium">{formatUserLabel(transaction)}</div><div className="text-xs text-muted-foreground">{transaction.email || transaction.address || transaction.userId}</div></td>
                    <td className="px-4 py-3 font-medium">{transaction.tipo}</td>
                    <td className="px-4 py-3">{formatCurrency(transaction.valor)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClassName(transaction.status)}`}>{transaction.status}</span></td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{transaction.referenciaExterna || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{transaction.horsepayId ? String(transaction.horsepayId) : '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(transaction.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Maiores saldos</h2>
            <p className="text-xs text-muted-foreground">Carteiras com mais saldo disponível agora.</p>
          </div>
          <div className="divide-y">
            {topWallets.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma carteira encontrada.</div>
            ) : topWallets.map((wallet: any) => (
              <div key={wallet.walletId} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0"><div className="truncate font-medium">{formatUserLabel(wallet)}</div><div className="truncate text-xs text-muted-foreground">{wallet.email || wallet.address || wallet.userId}</div></div>
                <div className="text-right"><div className="font-semibold">{formatCurrency(wallet.saldo)}</div><div className="text-xs text-muted-foreground">{formatDateTime(wallet.updatedAt)}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="min-w-0 rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Saques pendentes</h2>
            <p className="text-xs text-muted-foreground">Aprove, rejeite ou acompanhe saques ainda não concluídos.</p>
          </div>
          <div className="divide-y">
            {pendingWithdrawals.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted-foreground">Nenhum saque pendente no momento.</div>
            ) : pendingWithdrawals.map((withdrawal: any) => (
              <div key={withdrawal.id} className="flex flex-col gap-3 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{formatUserLabel(withdrawal)}</div>
                    <div className="truncate text-xs text-muted-foreground">Ref: {withdrawal.referenciaExterna || '—'}</div>
                    <div className="truncate text-xs text-muted-foreground">{formatDateTime(withdrawal.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(withdrawal.valor)}</div>
                    <div className="font-mono text-xs text-muted-foreground">{withdrawal.horsepayId ? String(withdrawal.horsepayId) : 'sem id HorsePay'}</div>
                    <div className="mt-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClassName(withdrawal.status)}`}>{withdrawal.status}</span>
                    </div>
                  </div>
                </div>
                {String(withdrawal.status || '').toUpperCase() === 'EM_ANALISE' && (
                  <div className="flex flex-wrap gap-2">
                    <form action={approveWithdrawAction}>
                      <input type="hidden" name="transactionId" value={withdrawal.id} />
                      <button type="submit" className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-500 px-3 text-xs font-medium text-white transition hover:bg-emerald-600">
                        Aprovar e enviar à HorsePay
                      </button>
                    </form>
                    <form action={rejectWithdrawAction}>
                      <input type="hidden" name="transactionId" value={withdrawal.id} />
                      <button type="submit" className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-500 px-3 text-xs font-medium text-white transition hover:bg-rose-600">
                        Rejeitar e estornar
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Depósitos pendentes</h2>
            <p className="text-xs text-muted-foreground">PIX criados que ainda não confirmaram crédito.</p>
          </div>
          <div className="divide-y">
            {pendingDeposits.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted-foreground">Nenhum depósito pendente no momento.</div>
            ) : pendingDeposits.map((deposit: any) => (
              <div key={deposit.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0"><div className="truncate font-medium">{formatUserLabel(deposit)}</div><div className="truncate text-xs text-muted-foreground">Ref: {deposit.referenciaExterna || '—'}</div><div className="truncate text-xs text-muted-foreground">{formatDateTime(deposit.createdAt)}</div></div>
                <div className="text-right"><div className="font-semibold">{formatCurrency(deposit.valor)}</div><div className="font-mono text-xs text-muted-foreground">{deposit.horsepayId ? String(deposit.horsepayId) : 'sem id HorsePay'}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
