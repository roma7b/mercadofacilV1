import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useUser } from '@/stores/useUser'

export const SAFE_BALANCE_QUERY_KEY = 'mercado-facil-balance'

interface Balance {
  raw: number
  text: string
  symbol: string
}

const INITIAL_STATE: Balance = {
  raw: 0.0,
  text: '0.00',
  symbol: 'R$',
}

interface UseBalanceOptions {
  enabled?: boolean
}

export function useBalance(options: UseBalanceOptions = {}) {
  const user = useUser()
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const userId = user?.id
  const isOptionsEnabled = options.enabled ?? true
  const isQueryEnabled = Boolean(hasMounted && userId && isOptionsEnabled)

  const {
    data,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [SAFE_BALANCE_QUERY_KEY, userId],
    enabled: isQueryEnabled,
    staleTime: 500,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<Balance> => {
      if (!userId) {
        return INITIAL_STATE
      }

      try {
        const res = await fetch(`/api/mercado/balance?userId=${userId}`)
        if (!res.ok) {
          return INITIAL_STATE
        }
        return await res.json()
      }
      catch {
        return INITIAL_STATE
      }
    },
  })

  const balance = isQueryEnabled && data ? data : INITIAL_STATE
  const isLoadingBalance = !hasMounted || (isQueryEnabled ? (isLoading || (!data && isFetching)) : false)
  
  return {
    balance,
    isLoadingBalance,
    refetchBalance: refetch,
  }
}

