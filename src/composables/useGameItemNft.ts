import { computed, inject, ref, watch } from 'vue'
import { Contract } from 'ethers'
import { GAME_ITEM_ABI } from '../abis/gameItem'
import { WalletInjectionKey } from '../injectionKeys'
import { formatEthersSendError } from '../utils/ethersTxError'

export type NftListRow = {
  id: string
  owner: string
  uri: string
}

function nftAddress(): string | undefined {
  const raw = import.meta.env.VITE_GAME_ITEM_NFT_ADDRESS?.trim()
  return raw && /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw : undefined
}

const MAX_LIST = 100

export function useGameItemNft() {
  const injected = inject(WalletInjectionKey)
  if (!injected) {
    throw new Error('useGameItemNft 需在 App 中 provide 钱包后使用')
  }
  const wallet = injected

  const collectionName = ref<string | null>(null)
  const collectionSymbol = ref<string | null>(null)
  const totalMinted = ref<string | null>(null)
  const myBalance = ref<string | null>(null)
  /** 合约常量：每地址 mint+award 上限 */
  const mintCapPerWallet = ref<string | null>(null)
  /** 当前钱包已通过 mint/award 计入上限的枚数 */
  const myMintCount = ref<string | null>(null)
  const metaError = ref<string | null>(null)
  const loadingMeta = ref(false)

  const tokenUriDraft = ref('')
  const mintError = ref<string | null>(null)
  const mintSubmitting = ref(false)
  const lastMintTxHash = ref<string | null>(null)
  const lastMintBlock = ref<number | null>(null)

  const listError = ref<string | null>(null)
  const loadingList = ref(false)
  const nftList = ref<NftListRow[]>([])

  const listFilter = ref<'all' | 'mine'>('all')
  const selectedId = ref<string | null>(null)

  const configuredAddress = computed(() => nftAddress())

  const atMintCap = computed(() => {
    if (myMintCount.value === null || mintCapPerWallet.value === null) return false
    return BigInt(myMintCount.value) >= BigInt(mintCapPerWallet.value)
  })

  const canMint = computed(
    () =>
      Boolean(
        configuredAddress.value &&
          wallet.provider.value &&
          wallet.address.value &&
          wallet.chainId.value === wallet.sepoliaChainId &&
          !mintSubmitting.value &&
          !atMintCap.value
      )
  )

  const filteredList = computed(() => {
    const me = wallet.address.value?.toLowerCase() ?? ''
    if (listFilter.value === 'mine' && me) {
      return nftList.value.filter((r) => r.owner.toLowerCase() === me)
    }
    return nftList.value
  })

  const selectedRow = computed(() => {
    const id = selectedId.value
    if (id === null) return null
    return nftList.value.find((r) => r.id === id) ?? null
  })

  async function loadCollectionMeta() {
    metaError.value = null
    collectionName.value = null
    collectionSymbol.value = null
    totalMinted.value = null
    myBalance.value = null
    mintCapPerWallet.value = null
    myMintCount.value = null

    const ca = configuredAddress.value
    if (!ca || !wallet.provider.value || wallet.chainId.value !== wallet.sepoliaChainId) {
      return
    }

    loadingMeta.value = true
    try {
      const c = new Contract(ca, GAME_ITEM_ABI, wallet.provider.value)
      const [n, s, t, cap] = await Promise.all([
        c.name(),
        c.symbol(),
        c.totalMinted(),
        c.MAX_MINT_PER_WALLET()
      ])
      collectionName.value = String(n)
      collectionSymbol.value = String(s)
      totalMinted.value = t.toString()
      mintCapPerWallet.value = cap.toString()

      if (wallet.address.value) {
        const [bal, mc] = await Promise.all([
          c.balanceOf(wallet.address.value),
          c.mintCountOf(wallet.address.value)
        ])
        myBalance.value = bal.toString()
        myMintCount.value = mc.toString()
      }
    } catch (e: unknown) {
      metaError.value = e instanceof Error ? e.message : '读取合集信息失败'
    } finally {
      loadingMeta.value = false
    }
  }

  async function loadNftList() {
    listError.value = null
    nftList.value = []
    selectedId.value = null

    const ca = configuredAddress.value
    const p = wallet.provider.value
    if (!ca || !p || wallet.chainId.value !== wallet.sepoliaChainId) {
      return
    }

    loadingList.value = true
    try {
      const c = new Contract(ca, GAME_ITEM_ABI, p)
      const total = await c.totalMinted()
      const n = Number(total)
      const cap = Math.min(n, MAX_LIST)
      const rows: NftListRow[] = []
      for (let i = 0; i < cap; i++) {
        const [owner, uri] = await Promise.all([c.ownerOf(i), c.tokenURI(i)])
        rows.push({ id: String(i), owner: String(owner), uri: String(uri) })
      }
      if (n > MAX_LIST) {
        listError.value = `链上共 ${n} 枚，此处仅加载 tokenId 0～${MAX_LIST - 1}（共 ${MAX_LIST} 条）。`
      }
      nftList.value = rows
    } catch (e: unknown) {
      listError.value = e instanceof Error ? e.message : '加载列表失败'
    } finally {
      loadingList.value = false
    }
  }

  watch(
    [configuredAddress, () => wallet.provider.value, () => wallet.chainId.value, () => wallet.address.value],
    async () => {
      if (!configuredAddress.value || !wallet.provider.value) return
      if (wallet.chainId.value !== wallet.sepoliaChainId) return
      await loadCollectionMeta()
      await loadNftList()
    },
    { immediate: true }
  )

  async function submitMint() {
    mintError.value = null
    lastMintTxHash.value = null
    lastMintBlock.value = null

    const ca = configuredAddress.value
    if (!ca) {
      mintError.value = '未配置 VITE_GAME_ITEM_NFT_ADDRESS'
      return
    }
    if (!wallet.provider.value || !wallet.address.value) {
      mintError.value = '请先连接 MetaMask'
      return
    }
    if (wallet.chainId.value !== wallet.sepoliaChainId) {
      mintError.value = '请切换到 Sepolia'
      return
    }

    const uri = tokenUriDraft.value.trim()
    if (!uri) {
      mintError.value = '请填写 tokenURI（例如 metadata JSON 的 https 或 ipfs 链接）。'
      return
    }
    if (uri.length > 8000) {
      mintError.value = 'tokenURI 过长，请使用短链接或 ipfs CID。'
      return
    }

    mintSubmitting.value = true
    try {
      const signer = await wallet.provider.value.getSigner()
      const cWrite = new Contract(ca, GAME_ITEM_ABI, signer)
      const tx = await cWrite.mint(uri)
      lastMintTxHash.value = tx.hash
      const receipt = await tx.wait()
      if (!receipt) {
        mintError.value = '未拿到交易回执'
        return
      }
      if (receipt.status === 0) {
        mintError.value = '交易执行失败'
        return
      }
      lastMintBlock.value = receipt.blockNumber
      tokenUriDraft.value = ''
      await loadCollectionMeta()
      await loadNftList()
      const t = Number(await new Contract(ca, GAME_ITEM_ABI, wallet.provider.value).totalMinted())
      if (t > 0) {
        selectedId.value = String(t - 1)
      }
    } catch (e: unknown) {
      mintError.value = formatEthersSendError(e)
      lastMintTxHash.value = null
      lastMintBlock.value = null
    } finally {
      mintSubmitting.value = false
    }
  }

  function selectNft(id: string) {
    selectedId.value = selectedId.value === id ? null : id
  }

  /** 将 ipfs:// 转为公共网关链接便于浏览器打开 */
  function displayUriHref(uri: string): string | null {
    if (uri.startsWith('ipfs://')) {
      const path = uri.slice('ipfs://'.length).replace(/^ipfs\//, '')
      return `https://ipfs.io/ipfs/${path}`
    }
    if (/^https?:\/\//i.test(uri)) return uri
    return null
  }

  /** 解析 data:application/json;base64,... 元数据 */
  function parseInlineJson(uri: string): Record<string, unknown> | null {
    const prefixes = ['data:application/json;base64,', 'data:application/json;charset=UTF-8;base64,']
    for (const p of prefixes) {
      if (uri.startsWith(p)) {
        try {
          const b64 = uri.slice(p.length)
          const json = atob(b64)
          return JSON.parse(json) as Record<string, unknown>
        } catch {
          return null
        }
      }
    }
    return null
  }

  return {
    collectionName,
    collectionSymbol,
    totalMinted,
    myBalance,
    mintCapPerWallet,
    myMintCount,
    atMintCap,
    metaError,
    loadingMeta,
    configuredAddress,
    loadCollectionMeta,
    loadNftList,
    tokenUriDraft,
    mintError,
    mintSubmitting,
    lastMintTxHash,
    lastMintBlock,
    canMint,
    submitMint,
    listError,
    loadingList,
    nftList,
    listFilter,
    filteredList,
    selectedId,
    selectedRow,
    selectNft,
    displayUriHref,
    parseInlineJson
  }
}
