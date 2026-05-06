import { computed, onUnmounted, ref, shallowRef } from 'vue'
import { BrowserProvider, formatEther } from 'ethers'

/** Sepolia testnet — https://chainlist.org */
const SEPOLIA_CHAIN_ID = 11155111n
const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7'

const SEPOLIA_ADD_CHAIN_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID_HEX,
  chainName: 'Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://rpc.sepolia.org'],
  blockExplorerUrls: ['https://sepolia.etherscan.io']
} as const

function rpcErrorCode(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined
  const c = (err as { code?: unknown }).code
  return typeof c === 'number' ? c : undefined
}

export function useWallet() {
  const address = ref<string | null>(null)
  const balanceWei = ref<string | null>(null)
  const chainId = ref<bigint | null>(null)
  const error = ref<string | null>(null)
  const isConnecting = ref(false)
  const provider = shallowRef<BrowserProvider | null>(null)

  const hasMetaMask = typeof window !== 'undefined' && !!window.ethereum

  const isSepolia = computed(() => chainId.value === SEPOLIA_CHAIN_ID)

  async function refreshNetwork() {
    if (!provider.value) {
      chainId.value = null
      return
    }
    const net = await provider.value.getNetwork()
    chainId.value = net.chainId
  }

  async function refreshBalance() {
    if (!provider.value || !address.value) {
      balanceWei.value = null
      return
    }
    const bal = await provider.value.getBalance(address.value)
    balanceWei.value = formatEther(bal)
  }

  async function syncFromProvider(bp: BrowserProvider) {
    provider.value = bp
    const accounts = (await bp.send('eth_accounts', [])) as string[]
    address.value = accounts[0] ?? null
    await refreshNetwork()
    await refreshBalance()
  }

  /** 页面加载时若 MetaMask 已授权过，则静默恢复连接（不会弹窗） */
  async function trySilentReconnect() {
    error.value = null
    if (!window.ethereum) return
    try {
      const bp = new BrowserProvider(window.ethereum)
      const accounts = (await bp.send('eth_accounts', [])) as string[]
      if (accounts.length === 0) return
      await syncFromProvider(bp)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  /** 请求用户授权并连接钱包 */
  async function connect() {
    error.value = null
    if (!window.ethereum) {
      error.value = '未检测到 MetaMask，请先安装扩展。'
      return
    }
    isConnecting.value = true
    try {
      const bp = new BrowserProvider(window.ethereum)
      await bp.send('eth_requestAccounts', [])
      await syncFromProvider(bp)
    } catch (e: unknown) {
      if (rpcErrorCode(e) === 4001) {
        error.value = '用户拒绝了连接请求。'
      } else {
        error.value = e instanceof Error ? e.message : String(e)
      }
      address.value = null
      balanceWei.value = null
      chainId.value = null
      provider.value = null
    } finally {
      isConnecting.value = false
    }
  }

  /** 切换到 Sepolia；若钱包未添加该网络则先 wallet_addEthereumChain */
  async function switchToSepolia() {
    error.value = null
    if (!window.ethereum) {
      error.value = '未检测到 MetaMask。'
      return
    }
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }]
      })
    } catch (e: unknown) {
      if (rpcErrorCode(e) === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [SEPOLIA_ADD_CHAIN_PARAMS]
        })
      } else if (rpcErrorCode(e) === 4001) {
        error.value = '用户取消了切换网络。'
        return
      } else {
        error.value = e instanceof Error ? e.message : String(e)
        return
      }
    }

    if (provider.value) {
      provider.value = new BrowserProvider(window.ethereum)
      await refreshNetwork()
      await refreshBalance()
    }
  }

  function registerListeners() {
    const eth = window.ethereum
    if (!eth?.on) return

    const onAccountsChanged = (accounts: string[]) => {
      address.value = accounts[0] ?? null
      if (address.value) void refreshBalance()
      else balanceWei.value = null
    }

    const onChainChanged = (_hex: string) => {
      if (!window.ethereum) return
      provider.value = new BrowserProvider(window.ethereum)
      void refreshNetwork()
      void refreshBalance()
    }

    eth.on('accountsChanged', onAccountsChanged)
    eth.on('chainChanged', onChainChanged)

    onUnmounted(() => {
      eth.removeListener?.('accountsChanged', onAccountsChanged)
      eth.removeListener?.('chainChanged', onChainChanged)
    })
  }

  return {
    address,
    balanceWei,
    chainId,
    error,
    isConnecting,
    hasMetaMask,
    isSepolia,
    provider,
    connect,
    refreshBalance,
    switchToSepolia,
    trySilentReconnect,
    registerListeners,
    sepoliaChainId: SEPOLIA_CHAIN_ID
  }
}
