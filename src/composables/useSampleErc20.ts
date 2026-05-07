import { computed, inject, ref, watch } from 'vue'
import { Contract, formatUnits, parseUnits } from 'ethers'
import { SAMPLE_ERC20_ABI } from '../abis/sampleErc20'
import { WalletInjectionKey } from '../injectionKeys'
import { formatEthersSendError } from '../utils/ethersTxError'

export type TransferRecordRow = {
  direction: 'out' | 'in'
  peer: string
  amount: string
  txHash: string
  blockNumber: number
}

function tokenAddress(): string | undefined {
  const raw = import.meta.env.VITE_SAMPLE_ERC20_ADDRESS?.trim()
  return raw && /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw : undefined
}

/** 与面板说明一致：查询最近若干区块内的 Transfer */
export const SAMPLE_ERC20_HISTORY_BLOCKS = 30_000
const HISTORY_MAX = 25

export function useSampleErc20() {
  const injected = inject(WalletInjectionKey)
  if (!injected) {
    throw new Error('useSampleErc20 需在 App 中 provide 钱包后使用')
  }
  const wallet = injected

  const tokenName = ref<string | null>(null)
  const tokenSymbol = ref<string | null>(null)
  const decimals = ref<number>(18)
  const tokenBalance = ref<string | null>(null)
  const infoError = ref<string | null>(null)
  const loadingInfo = ref(false)

  const transferTo = ref('')
  const transferAmount = ref('')
  const transferError = ref<string | null>(null)
  const transferSubmitting = ref(false)
  const lastTxHash = ref<string | null>(null)
  const lastTxBlock = ref<number | null>(null)

  const historyError = ref<string | null>(null)
  const loadingHistory = ref(false)
  const transferRecords = ref<TransferRecordRow[]>([])

  const configuredAddress = computed(() => tokenAddress())

  const canTransfer = computed(
    () =>
      Boolean(
        configuredAddress.value &&
          wallet.provider.value &&
          wallet.address.value &&
          wallet.chainId.value === wallet.sepoliaChainId &&
          !transferSubmitting.value
      )
  )

  async function loadTokenInfo() {
    infoError.value = null
    tokenBalance.value = null

    const ca = configuredAddress.value
    if (!ca) {
      infoError.value = '未配置 VITE_SAMPLE_ERC20_ADDRESS'
      return
    }
    if (!wallet.provider.value) {
      infoError.value = '请先连接 MetaMask'
      return
    }
    if (wallet.chainId.value !== wallet.sepoliaChainId) {
      infoError.value = '请切换到 Sepolia'
      return
    }
    if (!wallet.address.value) {
      infoError.value = '请先连接钱包以查看代币余额'
      return
    }

    loadingInfo.value = true
    try {
      const c = new Contract(ca, SAMPLE_ERC20_ABI, wallet.provider.value)
      const [n, s, d, bal] = await Promise.all([
        c.name(),
        c.symbol(),
        c.decimals(),
        c.balanceOf(wallet.address.value)
      ])
      tokenName.value = String(n)
      tokenSymbol.value = String(s)
      decimals.value = Number(d)
      tokenBalance.value = formatUnits(bal, decimals.value)
    } catch (e: unknown) {
      infoError.value = e instanceof Error ? e.message : '读取代币信息失败'
      tokenName.value = null
      tokenSymbol.value = null
    } finally {
      loadingInfo.value = false
    }
  }

  async function loadTransferHistory() {
    historyError.value = null
    transferRecords.value = []

    const ca = configuredAddress.value
    const p = wallet.provider.value
    const me = wallet.address.value
    if (!ca || !p || !me || wallet.chainId.value !== wallet.sepoliaChainId) {
      return
    }
    if (tokenSymbol.value === null) {
      return
    }

    loadingHistory.value = true
    try {
      const c = new Contract(ca, SAMPLE_ERC20_ABI, p)
      const head = await p.getBlockNumber()
      const fromBlock = Math.max(0, head - SAMPLE_ERC20_HISTORY_BLOCKS)
      const meLower = me.toLowerCase()

      const outFilter = c.filters.Transfer(me, null)
      const inFilter = c.filters.Transfer(null, me)
      const [logsOut, logsIn] = await Promise.all([
        c.queryFilter(outFilter, fromBlock, head),
        c.queryFilter(inFilter, fromBlock, head)
      ])

      const dec = decimals.value
      const unique = new Map<string, (typeof logsOut)[0]>()
      for (const log of [...logsOut, ...logsIn]) {
        unique.set(`${log.blockNumber}-${log.index}`, log)
      }

      const rows: TransferRecordRow[] = []
      for (const log of unique.values()) {
        if (!('args' in log) || log.args == null) continue
        const from = String(log.args[0]).toLowerCase()
        const value = log.args[2] as bigint
        const direction: 'out' | 'in' = from === meLower ? 'out' : 'in'
        const peer = direction === 'out' ? String(log.args[1]) : String(log.args[0])
        rows.push({
          direction,
          peer,
          amount: formatUnits(value, dec),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber
        })
      }

      rows.sort((a, b) => {
        if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber
        return b.txHash.localeCompare(a.txHash)
      })

      transferRecords.value = rows.slice(0, HISTORY_MAX)
    } catch (e: unknown) {
      historyError.value =
        e instanceof Error ? e.message : '加载转账记录失败（可缩小区块范围或换 RPC）'
    } finally {
      loadingHistory.value = false
    }
  }

  watch(
    [configuredAddress, () => wallet.provider.value, () => wallet.chainId.value, () => wallet.address.value],
    async () => {
      if (!configuredAddress.value || !wallet.provider.value) return
      if (wallet.chainId.value !== wallet.sepoliaChainId || !wallet.address.value) return
      await loadTokenInfo()
      await loadTransferHistory()
    },
    { immediate: true }
  )

  async function submitTransfer() {
    transferError.value = null
    lastTxHash.value = null
    lastTxBlock.value = null

    const ca = configuredAddress.value
    if (!ca) {
      transferError.value = '未配置代币合约地址。'
      return
    }
    if (!wallet.provider.value || !wallet.address.value) {
      transferError.value = '请先连接 MetaMask。'
      return
    }
    if (wallet.chainId.value !== wallet.sepoliaChainId) {
      transferError.value = '请切换到 Sepolia。'
      return
    }

    const to = transferTo.value.trim()
    if (!/^0x[a-fA-F0-9]{40}$/i.test(to)) {
      transferError.value = '接收地址格式无效（需 0x + 40 位十六进制）。'
      return
    }

    let amountWei: bigint
    try {
      amountWei = parseUnits(transferAmount.value.trim() || '0', decimals.value)
    } catch {
      transferError.value = '转账数量格式无效（请使用小数，如 1.5）。'
      return
    }
    if (amountWei <= 0n) {
      transferError.value = '转账数量必须大于 0。'
      return
    }

    transferSubmitting.value = true
    try {
      const p = wallet.provider.value
      const signer = await p.getSigner()
      const cWrite = new Contract(ca, SAMPLE_ERC20_ABI, signer)
      const tx = await cWrite.transfer(to, amountWei)
      lastTxHash.value = tx.hash
      const receipt = await tx.wait()
      if (!receipt) {
        transferError.value = '未拿到交易回执。'
        return
      }
      if (receipt.status === 0) {
        transferError.value = '交易已打包但执行失败。'
        return
      }
      lastTxBlock.value = receipt.blockNumber
      transferAmount.value = ''
      await loadTokenInfo()
      await loadTransferHistory()
    } catch (e: unknown) {
      transferError.value = formatEthersSendError(e)
      lastTxHash.value = null
      lastTxBlock.value = null
    } finally {
      transferSubmitting.value = false
    }
  }

  return {
    tokenName,
    tokenSymbol,
    decimals,
    tokenBalance,
    infoError,
    loadingInfo,
    configuredAddress,
    loadTokenInfo,
    transferTo,
    transferAmount,
    transferError,
    transferSubmitting,
    lastTxHash,
    lastTxBlock,
    canTransfer,
    submitTransfer,
    transferRecords,
    historyError,
    loadingHistory,
    loadTransferHistory,
    historyBlockSpan: SAMPLE_ERC20_HISTORY_BLOCKS
  }
}
