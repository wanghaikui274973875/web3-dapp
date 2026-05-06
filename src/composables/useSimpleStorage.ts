import { computed, inject, onScopeDispose, ref, watch } from 'vue'
import { Contract, ContractEventPayload } from 'ethers'
import { SIMPLE_STORAGE_ABI } from '../abis/simpleStorage'
import { WalletInjectionKey } from '../injectionKeys'
import { formatEthersSendError } from '../utils/ethersTxError'

function contractAddress(): string | undefined {
  const raw = import.meta.env.VITE_SIMPLE_STORAGE_ADDRESS?.trim()
  return raw && /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw : undefined
}

export type SimpleStorageEventRow = {
  value: string
  blockNumber: number
  txHash: string
  removed: boolean
}

/** 非负十进制整数字符串，需在 uint256 范围内（按 JS BigInt 可表示范围校验） */
function parseUint256Decimal(s: string): bigint {
  const t = s.trim()
  if (!/^[0-9]+$/.test(t)) {
    throw new Error('请输入非负十进制整数（仅数字，勿含空格或小数）。')
  }
  const v = BigInt(t)
  if (v < 0n) {
    throw new Error('数值不能为负。')
  }
  const max = (1n << 256n) - 1n
  if (v > max) {
    throw new Error('数值超出 uint256 范围。')
  }
  return v
}

const RECENT_CAP = 10

export function useSimpleStorage() {
  const injected = inject(WalletInjectionKey)
  if (!injected) {
    throw new Error('useSimpleStorage 需在 App 中 provide 钱包后使用')
  }
  const wallet = injected

  const numOnChain = ref<string | null>(null)
  const readError = ref<string | null>(null)
  const reading = ref(false)

  const writeNumStr = ref('0')
  const writeError = ref<string | null>(null)
  const writeSubmitting = ref(false)
  const lastTxHash = ref<string | null>(null)
  const lastTxBlock = ref<number | null>(null)

  const subscribed = ref(false)
  const subscribeError = ref<string | null>(null)
  const eventHistoryError = ref<string | null>(null)
  const recentEvents = ref<SimpleStorageEventRow[]>([])

  let eventContract: Contract | null = null
  let numUpdatedHandler: ((newValue: bigint, payload: ContractEventPayload) => void) | null = null
  /** 避免 watch 快速重入导致重复 on / 竞态 */
  let subscriptionWatchGeneration = 0

  const configuredAddress = computed(() => contractAddress())

  const canSubmitWrite = computed(
    () =>
      Boolean(
        configuredAddress.value &&
          wallet.provider.value &&
          wallet.address.value &&
          wallet.chainId.value === wallet.sepoliaChainId &&
          !writeSubmitting.value
      )
  )

  function stopSubscription() {
    if (eventContract && numUpdatedHandler) {
      try {
        eventContract.off('NumUpdated', numUpdatedHandler)
      } catch {
        /* ignore */
      }
    }
    eventContract = null
    numUpdatedHandler = null
    subscribed.value = false
  }

  async function startSubscription() {
    subscribeError.value = null
    stopSubscription()

    const ca = configuredAddress.value
    const p = wallet.provider.value
    if (!ca || !p || wallet.chainId.value !== wallet.sepoliaChainId) {
      return
    }

    try {
      const c = new Contract(ca, SIMPLE_STORAGE_ABI, p)
      numUpdatedHandler = (newValue: bigint, payload: ContractEventPayload) => {
        const log = payload.log
        const removed = Boolean(log.removed)
        const row: SimpleStorageEventRow = {
          value: newValue.toString(),
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          removed
        }
        recentEvents.value = [row, ...recentEvents.value].slice(0, RECENT_CAP)
        if (!removed) {
          numOnChain.value = newValue.toString()
        }
      }
      await c.on('NumUpdated', numUpdatedHandler)
      eventContract = c
      subscribed.value = true
    } catch (e: unknown) {
      subscribed.value = false
      subscribeError.value =
        e instanceof Error ? e.message : 'NumUpdated 订阅失败（部分 RPC 不支持 filter）。'
    }
  }

  /**
   * 拉取最近区块内的 NumUpdated（链上事件不会随页面刷新自动重放）。
   * HTTP Provider 下轮询有约数秒延迟；范围过大可能被公共 RPC 拒绝。
   */
  async function loadRecentEvents(blocksBack = 5000) {
    eventHistoryError.value = null

    const ca = configuredAddress.value
    const p = wallet.provider.value
    if (!ca || !p || wallet.chainId.value !== wallet.sepoliaChainId) {
      return
    }

    try {
      const c = new Contract(ca, SIMPLE_STORAGE_ABI, p)
      const head = await p.getBlockNumber()
      const fromBlock = Math.max(0, head - blocksBack)
      const filter = c.filters.NumUpdated()
      const logs = await c.queryFilter(filter, fromBlock, head)
      const rows: SimpleStorageEventRow[] = []
      for (let i = logs.length - 1; i >= 0 && rows.length < RECENT_CAP; i--) {
        const log = logs[i]
        if (!('args' in log) || log.args == null) continue
        const v = log.args[0]
        rows.push({
          value: (v as bigint).toString(),
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          removed: Boolean(log.removed)
        })
      }
      recentEvents.value = rows
    } catch (e: unknown) {
      eventHistoryError.value =
        e instanceof Error ? e.message : '加载最近事件失败（可稍后点「读取 getNum()」）。'
    }
  }

  watch(
    [configuredAddress, () => wallet.provider.value, () => wallet.chainId.value],
    async () => {
      const gen = ++subscriptionWatchGeneration
      stopSubscription()
      subscribeError.value = null
      eventHistoryError.value = null

      const ca = configuredAddress.value
      const p = wallet.provider.value
      const ok =
        Boolean(ca) && Boolean(p) && wallet.chainId.value === wallet.sepoliaChainId

      if (!ok) {
        return
      }

      await loadRecentEvents()
      if (gen !== subscriptionWatchGeneration) return

      await startSubscription()
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    stopSubscription()
  })

  async function readFromChain() {
    readError.value = null
    numOnChain.value = null

    const ca = configuredAddress.value
    if (!ca) {
      readError.value =
        '未配置合约地址：在 web3-dapp/.env 设置 VITE_SIMPLE_STORAGE_ADDRESS=0x... 后重启 dev 服务'
      return
    }
    if (!wallet.provider.value) {
      readError.value = '请先连接 MetaMask'
      return
    }
    if (wallet.chainId.value !== wallet.sepoliaChainId) {
      readError.value = '请切换到 Sepolia 再读合约（与部署网络一致）'
      return
    }

    reading.value = true
    try {
      const c = new Contract(ca, SIMPLE_STORAGE_ABI, wallet.provider.value)
      const n = await c.getNum()
      numOnChain.value = n.toString()
    } catch (e: unknown) {
      readError.value = e instanceof Error ? e.message : '读取失败（地址或网络是否正确？）'
    } finally {
      reading.value = false
    }
  }

  async function submitSetNum() {
    writeError.value = null
    lastTxHash.value = null
    lastTxBlock.value = null

    const ca = configuredAddress.value
    if (!ca) {
      writeError.value = '未配置合约地址。'
      return
    }
    if (!wallet.provider.value || !wallet.address.value) {
      writeError.value = '请先连接 MetaMask。'
      return
    }
    if (wallet.chainId.value !== wallet.sepoliaChainId) {
      writeError.value = '请切换到 Sepolia 再发送交易。'
      return
    }

    let value: bigint
    try {
      value = parseUint256Decimal(writeNumStr.value)
    } catch (e: unknown) {
      writeError.value = e instanceof Error ? e.message : '数值无效。'
      return
    }

    writeSubmitting.value = true
    try {
      const p = wallet.provider.value
      const signer = await p.getSigner()
      const cWrite = new Contract(ca, SIMPLE_STORAGE_ABI, signer)
      const tx = await cWrite.setNum(value)
      lastTxHash.value = tx.hash
      const receipt = await tx.wait()
      if (!receipt) {
        writeError.value = '未拿到交易回执，请稍后在浏览器查看交易状态。'
        return
      }
      if (receipt.status === 0) {
        writeError.value =
          '交易已打包但执行失败（链上 revert）。可在 Etherscan 查看回执详情。'
        return
      }
      lastTxBlock.value = receipt.blockNumber
    } catch (e: unknown) {
      writeError.value = formatEthersSendError(e)
      lastTxHash.value = null
      lastTxBlock.value = null
    } finally {
      writeSubmitting.value = false
    }
  }

  return {
    numOnChain,
    readError,
    reading,
    configuredAddress,
    readFromChain,
    writeNumStr,
    writeError,
    writeSubmitting,
    lastTxHash,
    lastTxBlock,
    canSubmitWrite,
    submitSetNum,
    subscribed,
    subscribeError,
    eventHistoryError,
    recentEvents,
    startSubscription,
    stopSubscription,
    loadRecentEvents
  }
}
