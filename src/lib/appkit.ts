export const projectId = ''
export const defaultNetwork = {
  id: 0,
  name: 'Mock',
  network: 'mock',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [''] },
    public: { http: [''] },
  }
}
export const networks = [defaultNetwork]
export const wagmiAdapter = {
  wagmiConfig: {
    connectors: []
  }
}
export const wagmiConfig = wagmiAdapter.wagmiConfig

