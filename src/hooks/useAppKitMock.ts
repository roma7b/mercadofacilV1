// Fake AppKit/Wagmi implementation to remove Web3 dependencies
export const useAppKitAccount = () => ({ address: undefined, isConnected: false, status: 'disconnected' })
export const useAppKitNetwork = () => ({ chainId: undefined, chain: undefined })
export const useAppKit = () => ({ open: () => {}, close: () => {}, isReady: true })
export const useDisconnect = () => ({ disconnect: async () => {} })
export const useWalletInfo = () => ({ walletInfo: undefined as { name?: string, icon?: string } | undefined })
export const useSignMessage = () => ({ signMessageAsync: async (...args: any[]) => '0xmock_sig' as const })
export const useSignTypedData = () => ({ signTypedDataAsync: async (...args: any[]) => '0xmock_sig' as const })
export const usePublicClient = () => ({} as any)
export const useWalletClient = () => ({ data: {} as any })

// Fake Networks
export const polygonAmoy = { id: 80002, name: 'Polygon Amoy' }
