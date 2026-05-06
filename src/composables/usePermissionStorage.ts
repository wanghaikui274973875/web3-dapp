import { computed, inject, ref } from 'vue'
import { Contract } from 'ethers'
import { PERMISSION_STORAGE_ABI } from '../abis/permissionStorage'
import { WalletInjectionKey } from '../injectionKeys'

/** Sepolia 上部署的合约地址，在 web3-dapp/.env 中配置 VITE_PERMISSION_STORAGE_ADDRESS */
function contractAddress(): string | undefined {
  const raw = import.meta.env.VITE_PERMISSION_STORAGE_ADDRESS?.trim()
  return raw && /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw : undefined
}

function rpcErrorCode(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined
  const c = (err as { code?: unknown }).code
  return typeof c === 'number' ? c : undefined
}

function formatSetPermissionError(err: unknown): string {
  if (rpcErrorCode(err) === 4001) {
    return '已取消签名 / 用户拒绝了交易。'
  }
  if (err instanceof Error) {
    const m = err.message
    if (/NotOwner|not owner/i.test(m) || m.includes('execution reverted')) {
      return '交易失败：需要合约 owner 钱包签名，或目标地址非法等链上 revert。'
    }
    return m
  }
  return '发送交易失败。'
}

export function usePermissionStorage() {
  const injected = inject(WalletInjectionKey)
  if (!injected) {
    throw new Error('usePermissionStorage 需在 App 中 provide 钱包后使用')
  }
  const wallet = injected

  const queryAddress = ref('')
  const permission = ref<boolean | null>(null)
  const owner = ref<string | null>(null)
  const readError = ref<string | null>(null)
  const reading = ref(false)

  const writeTarget = ref('')
  const writeAllowed = ref(true)
  const writeError = ref<string | null>(null)
  const writeSubmitting = ref(false)
  const lastTxHash = ref<string | null>(null)

  const configuredAddress = computed(() => contractAddress())

  /** 是否与链上 owner 一致（需先「读取」一次拿到 owner，或提交前会再次校验） */
  const isOwnerWallet = computed(() => {
    const a = wallet.address.value?.toLowerCase() ?? ''
    const o = owner.value?.toLowerCase() ?? ''
    return Boolean(a && o && a === o)
  })

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

  async function readFromChain() {
    readError.value = null
    permission.value = null
    owner.value = null

    const ca = configuredAddress.value
    if (!ca) {
      readError.value =
        '未配置合约地址：在 web3-dapp/.env 设置 VITE_PERMISSION_STORAGE_ADDRESS=0x... 后重启 dev 服务'
      return
    }
    if (!wallet.provider.value) {
      readError.value = '请先连接 MetaMask'
      return
    }
    if (wallet.chainId.value !== wallet.sepoliaChainId) {
      readError.value = '请切换到 Sepolia 再读合约（与 Hardhat 部署网络一致）'
      return
    }

    const who = queryAddress.value.trim()
    const target =
      who && /^0x[a-fA-F0-9]{40}$/i.test(who)
        ? who
        : wallet.address.value
    if (!target) {
      readError.value = '请填写有效查询地址，或先连接钱包用当前地址'
      return
    }

    reading.value = true
    try {
      const c = new Contract(ca, PERMISSION_STORAGE_ABI, wallet.provider.value)
      const [allowed, o] = await Promise.all([
        c.getPermission(target),
        c.owner()
      ])
      permission.value = Boolean(allowed)
      owner.value = String(o)
    } catch (e: unknown) {
      readError.value =
        e instanceof Error ? e.message : '读取失败（地址或网络是否正确？）'
    } finally {
      reading.value = false
    }
  }

  /**
   * owner 调用 setPermission；MetaMask 弹窗估算 gas 并签名，上链需 Sepolia ETH。
   */
  async function submitSetPermission() {
    writeError.value = null
    lastTxHash.value = null

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

    const target = writeTarget.value.trim()
    if (!/^0x[a-fA-F0-9]{40}$/i.test(target)) {
      writeError.value = '目标地址格式无效（需 0x + 40 位十六进制）。'
      return
    }

    writeSubmitting.value = true
    try {
      const p = wallet.provider.value
      const signer = await p.getSigner()
      const me = (await signer.getAddress()).toLowerCase()

      const cRead = new Contract(ca, PERMISSION_STORAGE_ABI, p)
      const onChainOwner = String(await cRead.owner()).toLowerCase()
      if (me !== onChainOwner) {
        writeError.value =
          '当前钱包不是合约 owner，无法调用 setPermission（链上会 revert NotOwner）。'
        return
      }

      const cWrite = new Contract(ca, PERMISSION_STORAGE_ABI, signer)
      const tx = await cWrite.setPermission(target, writeAllowed.value)
      lastTxHash.value = tx.hash
      await tx.wait()
    } catch (e: unknown) {
      writeError.value = formatSetPermissionError(e)
      lastTxHash.value = null
    } finally {
      writeSubmitting.value = false
    }
  }

  return {
    queryAddress,
    permission,
    owner,
    readError,
    reading,
    configuredAddress,
    readFromChain,
    writeTarget,
    writeAllowed,
    writeError,
    writeSubmitting,
    lastTxHash,
    isOwnerWallet,
    canSubmitWrite,
    submitSetPermission
  }
}
