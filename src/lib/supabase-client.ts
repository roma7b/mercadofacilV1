import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Proxy seguro para evitar crash quando Supabase não está configurado
function createSafeSupabaseMock() {
  const handler: any = {
    get: (_: any, prop: string) => {
      if (prop === 'then') return undefined
      return () => new Proxy({}, handler)
    },
    apply: () => new Proxy({}, handler),
  }
  // Retorna uma promise que resolve com erro ao invés de crashar
  return new Proxy(
    Object.assign(() => {}, {
      from: () => ({
        select: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        upsert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        eq: function() { return this },
        single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        order: function() { return this },
        limit: function() { return this },
      }),
    }),
    handler
  ) as any
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não configurados. Usando mock seguro.')
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createSafeSupabaseMock()

// Para operações administrativas (Server Side Only)
export const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null
