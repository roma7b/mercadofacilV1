import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Chamada de API de sessao com Headers (exigencia do Better Auth no SSR)
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  // LOGS CRÍTICOS PARA A CLAUDE ANALISAR NO TERMINAL
  console.log('--- [PROTREÇÃO ADMIN LAYOUT] ---')
  console.log('EMAIL DA SESSÃO:', session?.user?.email)
  console.log('SESSÃO COMPLETA:', JSON.stringify(session, null, 2))

  if (!session?.user?.email) {
    console.log('SESSÃO NULL OU SEM EMAIL - REDIRECIONANDO PARA HOME')
    redirect('/' as any)
  }

  // Bypass direto para o seu e-mail
  if (session.user.email !== 'business.roma7b@gmail.com') {
    console.log('USUARIO LOGADO MAS NAO AUTORIZADO - REDIRECIONANDO PARA HOME')
    redirect('/' as any)
  }

  return (
    <div className="flex min-h-screen flex-col">
      {children}
    </div>
  )
}
