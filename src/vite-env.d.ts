/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PERMISSION_STORAGE_ADDRESS?: string
  readonly VITE_SIMPLE_STORAGE_ADDRESS?: string
  readonly VITE_MEMO_STORAGE_ADDRESS?: string
  readonly VITE_SAMPLE_ERC20_ADDRESS?: string
  readonly VITE_GAME_ITEM_NFT_ADDRESS?: string
}

import type { Eip1193Provider } from 'ethers'

type EthereumProvider = Eip1193Provider & {
  on?(event: 'accountsChanged', handler: (accounts: string[]) => void): void
  on?(event: 'chainChanged', handler: (chainIdHex: string) => void): void
  removeListener?(
    event: 'accountsChanged',
    handler: (accounts: string[]) => void
  ): void
  removeListener?(
    event: 'chainChanged',
    handler: (chainIdHex: string) => void
  ): void
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

export {}
