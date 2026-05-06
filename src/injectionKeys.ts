import type { InjectionKey } from 'vue'
import { useWallet } from './composables/useWallet'

export const WalletInjectionKey: InjectionKey<ReturnType<typeof useWallet>> =
  Symbol('wallet')
