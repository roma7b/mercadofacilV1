export const PENDING_USDC_QUERY_KEY = 'safe-native-usdc-balance'

export function usePendingUsdcDeposit() {
  return {
    pendingBalance: {
      raw: 0.0,
      rawBase: '0',
      text: '0.00',
      symbol: 'USDC',
    },
    hasPendingDeposit: false,
    isLoadingPendingDeposit: false,
    refetchPendingDeposit: () => {},
  }
}

