'use client'

import type { ProxyWalletStatus } from '@/types'
import { CheckCircle2, Copy, ExternalLink, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface WalletFlowProps {
  depositOpen: boolean
  onDepositOpenChange: (open: boolean) => void
  withdrawOpen: boolean
  onWithdrawOpenChange: (open: boolean) => void
  user: {
    id: string
    address: string
    name?: string | null
    proxy_wallet_address?: string | null
    proxy_wallet_status?: ProxyWalletStatus | null
  } | null
  meldUrl: string | null
}

export function WalletFlow({
  depositOpen,
  onDepositOpenChange,
  withdrawOpen,
  onWithdrawOpenChange,
}: WalletFlowProps) {
  const [step, setStep] = useState<'IDLE' | 'LOADING' | 'PIX' | 'CONFIRMED'>('IDLE')
  const [amount, setAmount] = useState('10')
  const [pixData, setPixData] = useState<{ qr_code: string, copy_past: string, order_id: string } | null>(null)

  // Reset state when opening/closing
  useEffect(() => {
    if (!depositOpen) {
      setStep('IDLE')
      setPixData(null)
    }
  }, [depositOpen])

  // Polling for confirmation
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (step === 'PIX' && pixData?.order_id) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/mercado/deposit/status/${pixData.order_id}`)
          if (res.ok) {
            const data = await res.json()
            if (data.status === 'CONFIRMADO') {
              setStep('CONFIRMED')
              clearInterval(interval)
              toast.success('Depósito confirmado!')
            }
          }
        }
        catch (err) {
          console.error('Erro no polling:', err)
        }
      }, 5000)
    }
    return () => clearInterval(interval)
  }, [step, pixData])

  const handleCreatePix = async () => {
    if (!amount || Number(amount) < 5) {
      toast.error('Valor mínimo de R$ 5,00')
      return
    }

    setStep('LOADING')
    try {
      const res = await fetch('/api/mercado/deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) }),
      })

      if (!res.ok) { throw new Error('Falha ao gerar PIX') }

      const data = await res.json()
      setPixData(data)
      setStep('PIX')
    }
    catch (err) {
      console.error(err)
      toast.error('Erro ao gerar código PIX. Tente novamente.')
      setStep('IDLE')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado para a área de transferência!')
  }

  const [withdrawAmount, setWithdrawAmount] = useState('10')
  const [pixKey, setPixKey] = useState('')
  const [pixType, setPixType] = useState('CPF')
  const [withdrawing, setWithdrawing] = useState(false)

  const handleWithdraw = async () => {
    if (!withdrawAmount || Number(withdrawAmount) < 10) {
      toast.error('Valor mínimo de R$ 10,00')
      return
    }
    if (!pixKey) {
      toast.error('Informe a chave PIX')
      return
    }

    setWithdrawing(true)
    try {
      const res = await fetch('/api/mercado/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(withdrawAmount),
          pix_key: pixKey,
          pix_type: pixType,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success('Saque solicitado com sucesso!')
        onWithdrawOpenChange(false)
      }
      else {
        toast.error(data.error || 'Erro ao processar saque')
      }
    }
    catch (err) {
      toast.error('Erro de conexão. Tente novamente.')
    }
    finally {
      setWithdrawing(false)
    }
  }

  return (
    <>
      <Dialog open={depositOpen} onOpenChange={onDepositOpenChange}>
        <DialogContent className="max-w-[400px] gap-0 border-zinc-800 bg-zinc-950 p-0 shadow-2xl" showCloseButton={false}>
          <div className="relative max-h-[85vh] overflow-y-auto p-8">
            <button
              onClick={() => onDepositOpenChange(false)}
              className="absolute top-4 right-4 z-10 rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
            >
              <X className="size-5" />
            </button>
            {step === 'IDLE' && (
              <div className="space-y-6 pt-4">
                <div className="text-center">
                  <h2 className="mb-2 text-2xl font-bold text-white">Depositar Saldo</h2>
                  <p className="text-sm text-zinc-400">Escolha o valor para recarregar sua carteira via PIX.</p>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <span className="absolute top-1/2 left-4 -translate-y-1/2 font-medium text-white">R$</span>
                    <Input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="
                        h-14 border-zinc-800 bg-zinc-900 pl-12 text-xl font-bold text-white
                        focus:border-primary focus:ring-primary
                      "
                      placeholder="0,00"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {['10', '50', '100'].map(val => (
                      <button
                        key={val}
                        onClick={() => setAmount(val)}
                        className="
                          rounded-lg border border-zinc-800 bg-zinc-900 py-2 text-sm font-semibold text-white
                          transition-colors
                          hover:bg-zinc-800
                        "
                      >
                        R$
                        {' '}
                        {val}
                      </button>
                    ))}
                  </div>

                  <Button
                    className="h-12 w-full text-lg font-bold"
                    onClick={handleCreatePix}
                  >
                    Gerar PIX
                  </Button>
                </div>
              </div>
            )}

            {step === 'LOADING' && (
              <div className="flex flex-col items-center justify-center space-y-4 py-12">
                <Loader2 className="size-12 animate-spin text-primary" />
                <p className="animate-pulse text-zinc-400">Gerando código PIX...</p>
              </div>
            )}

            {step === 'PIX' && pixData && (
              <div className="space-y-6 pt-4">
                <div className="text-center">
                  <h2 className="mb-1 text-xl font-bold text-white">Aguardando Pagamento</h2>
                  <p className="text-sm text-zinc-400">Escaneie o QR Code ou use o Copia e Cola.</p>
                </div>

                <div className="mx-auto flex w-fit justify-center rounded-xl bg-white p-4">
                  <QRCode value={pixData.copy_past} size={180} />
                </div>

                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="h-12 w-full justify-between border-zinc-800 px-4 hover:bg-zinc-900"
                    onClick={() => copyToClipboard(pixData.copy_past)}
                  >
                    <span className="mr-2 truncate font-mono text-xs text-zinc-400">{pixData.copy_past}</span>
                    <Copy className="size-4 shrink-0" />
                  </Button>

                  <div className="flex items-center justify-center space-x-2 py-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span className="text-xs font-medium tracking-widest text-primary uppercase">Sincronizando banco...</span>
                  </div>
                </div>

                <p className="text-center text-2xs tracking-tighter text-zinc-500 uppercase">
                  O saldo será creditado instantaneamente após a confirmação.
                </p>
              </div>
            )}

            {step === 'CONFIRMED' && (
              <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="size-12 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-bold text-white">Sucesso!</h2>
                <p className="text-zinc-400">
                  Seu depósito de
                  {' '}
                  <span className="font-bold text-white">
                    R$
                    {amount}
                  </span>
                  {' '}
                  foi confirmado e já está disponível.
                </p>
                <Button
                  className="mt-6 w-full"
                  onClick={() => onDepositOpenChange(false)}
                >
                  Concluído
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawOpen} onOpenChange={onWithdrawOpenChange}>
        <DialogContent className="max-w-[400px] gap-0 border-zinc-800 bg-zinc-950 p-0 shadow-2xl" showCloseButton={false}>
          <div className="relative max-h-[85vh] overflow-y-auto p-8">
            <button
              onClick={() => onWithdrawOpenChange(false)}
              className="absolute top-4 right-4 z-10 rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
            >
              <X className="size-5" />
            </button>
            <div className="space-y-6 pt-4">
              <div className="text-center">
                <h2 className="mb-2 text-2xl font-bold text-white">Solicitar Saque</h2>
                <p className="text-sm text-zinc-400">Receba seus ganhos via PIX com segurança.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-500 uppercase">Valor do Saque</label>
                  <div className="relative">
                    <span className="absolute top-1/2 left-4 -translate-y-1/2 font-medium text-white">R$</span>
                    <Input
                      type="number"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      className="h-12 border-zinc-800 bg-zinc-900 pl-12 text-white"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-500 uppercase">Tipo de Chave PIX</label>
                  <select
                    value={pixType}
                    onChange={e => setPixType(e.target.value)}
                    className="
                      h-12 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-white
                      focus:ring-1 focus:ring-primary focus:outline-none
                    "
                  >
                    <option value="CPF">CPF</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="PHONE">Telefone</option>
                    <option value="RANDOM">Chave Aleatória / EVP</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-500 uppercase">Sua Chave PIX</label>
                  <Input
                    type="text"
                    value={pixKey}
                    onInput={e => setPixKey(e.currentTarget.value)}
                    className="h-12 border-zinc-800 bg-zinc-900 text-white"
                    placeholder="Digite sua chave aqui"
                  />
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    * Saques via PIX costumam ser processados em até 24 horas. Certifique-se de que a chave está correta para evitar atrasos.
                  </p>
                </div>

                <Button
                  className="h-12 w-full text-lg font-bold"
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                >
                  {withdrawing
                    ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin" />
                          {' '}
                          Processando...
                        </span>
                      )
                    : 'Confirmar Saque PIX'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
