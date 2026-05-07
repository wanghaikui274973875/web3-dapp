import { computed, inject, ref } from 'vue'
import { Contract } from 'ethers'
import { MEMO_STORAGE_ABI } from '../abis/memoStorage'
import { WalletInjectionKey } from '../injectionKeys'
import { formatEthersSendError } from '../utils/ethersTxError'

const MAX_MEMO_CHARS = 4000

function contractAddress(): string | undefined {
  const raw = import.meta.env.VITE_MEMO_STORAGE_ADDRESS?.trim()
  return raw && /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw : undefined
}

export function useMemoStorage() {
  const injected = inject(WalletInjectionKey)
  if (!injected) {
    throw new Error('useMemoStorage 需在 App 中 provide 钱包后使用')
  }
  const wallet = injected

  const queryAddress = ref('')
  const memoContent = ref<string | null>(null)
  const readError = ref<string | null>(null)
  const reading = ref(false)

  const draft = ref('')
  const writeError = ref<string | null>(null)
  const writeSubmitting = ref(false)
  const lastTxHash = ref<string | null>(null)
  const lastTxBlock = ref<number | null>(null)

  const configuredAddress = computed(() => contractAddress())

  const canWrite = computed(
    () =>
      Boolean(
        configuredAddress.value &&
          wallet.provider.value &&
          wallet.address.value &&
          wallet.chainId.value === wallet.sepoliaChainId &&
          !writeSubmitting.value
      )
  )

  /** 正在读的是哪个地址（留空则用当前连接钱包） */
  const resolvedQueryAddress = computed(() => {
    const q = queryAddress.value.trim()
    if (q && /^0x[a-fA-F0-9]{40}$/i.test(q)) return q
    return wallet.address.value ?? ''
  })

  async function readFromChain() {
    readError.value = null
    memoContent.value = null

    const ca = configuredAddress.value
    if (!ca) {
      readError.value =
        '未配置合约地址：在 web3-dapp/.env 设置 VITE_MEMO_STORAGE_ADDRESS=0x... 后重启 dev 服务'
      return
    }
    if (!wallet.provider.value) {
      readError.value = '请先连接 MetaMask'
      return
    }
    if (wallet.chainId.value !== wallet.sepoliaChainId) {
      readError.value = '请切换到 Sepolia 再读合约'
      return
    }

    const target = resolvedQueryAddress.value
    if (!target) {
      readError.value = '请填写要查询的地址，或先连接钱包以读取当前地址的备忘录'
      return
    }

    reading.value = true
    try {
      const c = new Contract(ca, MEMO_STORAGE_ABI, wallet.provider.value)
      const s = await c.getMemo(target)
      memoContent.value = String(s)
    } catch (e: unknown) {
      readError.value = e instanceof Error ? e.message : '读取失败'
    } finally {
      reading.value = false
    }
  }

  async function submitSetMyMemo() {
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
      writeError.value = '请切换到 Sepolia。'
      return
    }

    const content = draft.value
    if (content.length > MAX_MEMO_CHARS) {
      writeError.value = `内容过长（最多 ${MAX_MEMO_CHARS} 字符），请缩短后再提交。`
      return
    }

    writeSubmitting.value = true
    try {
      const p = wallet.provider.value
      const signer = await p.getSigner()
      const cWrite = new Contract(ca, MEMO_STORAGE_ABI, signer)
      const tx = await cWrite.setMyMemo(content)
      lastTxHash.value = tx.hash
      const receipt = await tx.wait()
      if (!receipt) {
        writeError.value = '未拿到交易回执。'
        return
      }
      if (receipt.status === 0) {
        writeError.value = '交易已打包但执行失败。'
        return
      }
      lastTxBlock.value = receipt.blockNumber
      memoContent.value = content
    } catch (e: unknown) {
      writeError.value = formatEthersSendError(e)
      lastTxHash.value = null
      lastTxBlock.value = null
    } finally {
      writeSubmitting.value = false
    }
  }

  async function submitDeleteMyMemo() {
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
      writeError.value = '请切换到 Sepolia。'
      return
    }

    writeSubmitting.value = true
    try {
      const p = wallet.provider.value
      const signer = await p.getSigner()
      const cWrite = new Contract(ca, MEMO_STORAGE_ABI, signer)
      const tx = await cWrite.deleteMyMemo()
      lastTxHash.value = tx.hash
      const receipt = await tx.wait()
      if (!receipt) {
        writeError.value = '未拿到交易回执。'
        return
      }
      if (receipt.status === 0) {
        writeError.value = '交易已打包但执行失败。'
        return
      }
      lastTxBlock.value = receipt.blockNumber
      draft.value = ''
      if (resolvedQueryAddress.value.toLowerCase() === wallet.address.value.toLowerCase()) {
        memoContent.value = ''
      }
    } catch (e: unknown) {
      writeError.value = formatEthersSendError(e)
      lastTxHash.value = null
      lastTxBlock.value = null
    } finally {
      writeSubmitting.value = false
    }
  }

  return {
    queryAddress,
    memoContent,
    readError,
    reading,
    configuredAddress,
    resolvedQueryAddress,
    readFromChain,
    draft,
    writeError,
    writeSubmitting,
    lastTxHash,
    lastTxBlock,
    canWrite,
    submitSetMyMemo,
    submitDeleteMyMemo,
    maxMemoChars: MAX_MEMO_CHARS
  }
}
