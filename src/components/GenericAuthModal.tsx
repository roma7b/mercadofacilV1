'use client'

import React, { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { formatCpf, isValidCpf, normalizeCpf } from '@/lib/cpf'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface GenericAuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultIsSignUp?: boolean
}

export function GenericAuthModal({ isOpen, onClose, defaultIsSignUp = false }: GenericAuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(defaultIsSignUp)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setIsSignUp(defaultIsSignUp)
      setError('')
    }
  }, [isOpen, defaultIsSignUp])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        const normalizedCpf = normalizeCpf(cpf)

        if (!isValidCpf(normalizedCpf)) {
          setError('CPF inválido')
          setLoading(false)
          return
        }

        if (!username.trim()) {
          setError('Nome de usuário obrigatório')
          setLoading(false)
          return
        }

        const { error: signUpError } = await authClient.signUp.email({
          email,
          password,
          name: username,
          username,
          settings: {
            identity: {
              cpf: normalizedCpf,
            },
          },
        } as any)

        if (signUpError) {
          setError(signUpError.message || 'Erro ao criar conta')
        }
        else {
          window.location.reload()
        }
      }
      else {
        const { error: signInError } = await authClient.signIn.email({
          email,
          password,
        })
        if (signInError) {
          setError(signInError.message || 'Erro ao entrar')
        }
        else {
          window.location.reload()
        }
      }
    }
    catch (err: any) {
      setError(err.message || 'Erro inesperado')
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isSignUp ? 'Criar Conta' : 'Entrar'}</DialogTitle>
          <DialogDescription>
            {isSignUp ? 'Preencha seus dados para apostar' : 'Acesse com seu e-mail e senha'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
          {error && <div className="rounded-sm bg-red-100 p-2 text-sm text-red-500">{error}</div>}

          <input
            type="email"
            placeholder="E-mail"
            required
            className="w-full rounded-sm border p-2 font-medium text-black"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          {isSignUp && (
            <>
              <input
                type="text"
                placeholder="Nome de Usuário"
                required
                className="w-full rounded-sm border p-2 font-medium text-black"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
              <input
                type="text"
                placeholder="CPF"
                required
                className="w-full rounded-sm border p-2 font-medium text-black"
                value={cpf}
                onChange={e => setCpf(formatCpf(e.target.value))}
              />
            </>
          )}

          <input
            type="password"
            placeholder="Senha"
            required
            className="w-full rounded-sm border p-2 font-medium text-black"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <Button type="submit" disabled={loading}>
            {loading ? 'Carregando...' : (isSignUp ? 'Cadastrar' : 'Acessar Conta')}
          </Button>

          <Button
            type="button"
            variant="link"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
          >
            {isSignUp ? 'Já tem uma conta? Entrar' : 'Não tem conta? Criar conta'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
