/// <reference types="vite/client" />

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
