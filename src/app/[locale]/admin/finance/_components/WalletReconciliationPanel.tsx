'use client'

import { useState } from 'react'

function formatCurrency(value: number | string | null | undefined) {
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

interface WalletIssue {
  userId: string
  username: string | null
  email: string | null
  address: string | null
  expectedSaldo: number
  currentSaldo: number
  delta: number
  walletUpdatedAt: string | null
}

export default function WalletReconciliationPanel() {
  const [issues, setIssues] = useState<WalletIssue[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadIssues() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/finance/reconciliation', {
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Falha ao carregar inconsistências')
      }
      setIssues(payload.data || [])
    }
    catch (err: any) {
      setError(err?.message || 'Falha ao carregar inconsistências')
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Reconciliacao de carteiras</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifique sob demanda usuarios com saldo divergente entre transactions confirmadas e wallets.
          </p>
        </div>
        <button
          type="button"
          onClick={loadIssues}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Verificando...' : 'Verificar inconsistências'}
        </button>
      </div>

      <div className="mt-4 rounded-lg bg-muted/40 p-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {issues === null
            ? 'Nenhuma consulta executada ainda.'
            : issues.length === 0
              ? 'Nenhuma inconsistência encontrada.'
              : `${issues.length} inconsistência(s) encontrada(s).`}
        </div>
        {error && <div className="mt-2 text-sm text-rose-400">{error}</div>}
      </div>

      {issues !== null && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Usuario</th>
                <th className="px-3 py-2 font-medium">Saldo atual</th>
                <th className="px-3 py-2 font-medium">Saldo esperado</th>
                <th className="px-3 py-2 font-medium">Delta</th>
                <th className="px-3 py-2 font-medium">Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0
                ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Nenhuma inconsistência encontrada.
                      </td>
                    </tr>
                  )
                : issues.map(issue => (
                    <tr key={issue.userId} className="border-b last:border-b-0">
                      <td className="px-3 py-3">
                        <div className="font-medium">{formatUserLabel(issue)}</div>
                        <div className="text-xs text-muted-foreground">{issue.email || issue.address || issue.userId}</div>
                      </td>
                      <td className="px-3 py-3">{formatCurrency(issue.currentSaldo)}</td>
                      <td className="px-3 py-3">{formatCurrency(issue.expectedSaldo)}</td>
                      <td className={`px-3 py-3 font-medium ${issue.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(issue.delta)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDateTime(issue.walletUpdatedAt)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
