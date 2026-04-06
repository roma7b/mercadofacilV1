'use client'

import { useState, useEffect } from 'react'
import type { ProxyWalletStatus } from '@/types'
import QRCode from 'react-qr-code'
import { CheckCircle2, Loader2, Copy, ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
        } catch (err) {
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
        body: JSON.stringify({ amount: Number(amount) })
      })

      if (!res.ok) throw new Error('Falha ao gerar PIX')

      const data = await res.json()
      setPixData(data)
      setStep('PIX')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao gerar código PIX. Tente novamente.')
      setStep('IDLE')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado para a área de transferência!')
  }

  if (depositOpen) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
        onClick={() => onDepositOpenChange(false)}
      >
        <div
          className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 max-w-md w-full shadow-2xl relative"
          onClick={e => e.stopPropagation()}
        >
          <button 
            onClick={() => onDepositOpenChange(false)}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white"
          >
            <X className="size-5" />
          </button>

          {step === 'IDLE' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Depositar Saldo</h2>
                <p className="text-sm text-zinc-400">Escolha o valor para recarregar sua carteira via PIX.</p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-medium">R$</span>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-12 h-14 text-xl font-bold bg-zinc-900 border-zinc-800 text-white focus:border-primary focus:ring-primary"
                    placeholder="0,00"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {['10', '50', '100'].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmount(val)}
                      className="py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
                    >
                      R$ {val}
                    </button>
                  ))}
                </div>


                <Button 
                  className="w-full h-12 text-lg font-bold" 
                  onClick={handleCreatePix}
                >
                  Gerar PIX
                </Button>
              </div>
            </div>
          )}

          {step === 'LOADING' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="size-12 text-primary animate-spin" />
              <p className="text-zinc-400 animate-pulse">Gerando código PIX...</p>
            </div>
          )}

          {step === 'PIX' && pixData && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-1">Aguardando Pagamento</h2>
                <p className="text-sm text-zinc-400">Escaneie o QR Code ou use o Copia e Cola.</p>
              </div>

              <div className="flex justify-center p-4 bg-white rounded-xl mx-auto w-fit">
                <QRCode value={pixData.copy_past} size={180} />
              </div>

              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full h-12 border-zinc-800 hover:bg-zinc-900 justify-between px-4"
                  onClick={() => copyToClipboard(pixData.copy_past)}
                >
                  <span className="truncate mr-2 text-xs font-mono text-zinc-400">{pixData.copy_past}</span>
                  <Copy className="size-4 shrink-0" />
                </Button>

                <div className="flex items-center justify-center space-x-2 py-2">
                  <Loader2 className="size-4 text-primary animate-spin" />
                  <span className="text-xs text-primary font-medium uppercase tracking-widest">Sincronizando banco...</span>
                </div>
              </div>
              
              <p className="text-[10px] text-center text-zinc-500 uppercase tracking-tighter">
                O saldo serÃ¡ creditado instantaneamente apÃ³s a confirmaÃ§Ã£o.
              </p>
            </div>
          )}

          {step === 'CONFIRMED' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="size-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="size-12 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-white">Sucesso!</h2>
              <p className="text-zinc-400">
                Seu depÃ³sito de <span className="text-white font-bold">R$ {amount}</span> foi confirmado e jÃ¡ estÃ¡ disponÃvel.
              </p>
              <Button 
                className="w-full mt-6" 
                onClick={() => onDepositOpenChange(false)}
              >
                ConcluÃ­do
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (withdrawOpen) {
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
            pix_type: pixType
          })
        })

        const data = await res.json()
        if (res.ok) {
          toast.success('Saque solicitado com sucesso!')
          onWithdrawOpenChange(false)
        } else {
          toast.error(data.error || 'Erro ao processar saque')
        }
      } catch (err) {
        toast.error('Erro de conexão. Tente novamente.')
      } finally {
        setWithdrawing(false)
      }
    }

    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
        onClick={() => onWithdrawOpenChange(false)}
      >
        <div
          className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 max-w-md w-full shadow-2xl relative"
          onClick={e => e.stopPropagation()}
        >
          <button 
            onClick={() => onWithdrawOpenChange(false)}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white"
          >
            <X className="size-5" />
          </button>

          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Solicitar Saque</h2>
              <p className="text-sm text-zinc-400">Receba seus ganhos via PIX com seguranÃ§a.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase mb-1.5 block">Valor do Saque</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-medium">R$</span>
                  <Input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="pl-12 h-12 bg-zinc-900 border-zinc-800 text-white"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase mb-1.5 block">Tipo de Chave PIX</label>
                <select 
                  value={pixType}
                  onChange={(e) => setPixType(e.target.value)}
                  className="w-full h-12 rounded-md bg-zinc-900 border border-zinc-800 text-white px-3 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="CPF">CPF</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="PHONE">Telefone</option>
                  <option value="RANDOM">Chave AleatÃ³ria / EVP</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase mb-1.5 block">Sua Chave PIX</label>
                <Input
                  type="text"
                  value={pixKey}
                  onInput={(e) => setPixKey(e.currentTarget.value)}
                  className="h-12 bg-zinc-900 border-zinc-800 text-white"
                  placeholder="Digite sua chave aqui"
                />
              </div>

              <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  * Saques via PIX costumam ser processados em atÃ© 24 horas. Certifique-se de que a chave estÃ¡ correta para evitar atrasos.
                </p>
              </div>

              <Button 
                className="w-full h-12 text-lg font-bold" 
                onClick={handleWithdraw}
                disabled={withdrawing}
              >
                {withdrawing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Processando...
                  </span>
                ) : 'Confirmar Saque PIX'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

