<script setup lang="ts">
import { computed } from 'vue'
import { useGameItemNft } from '../composables/useGameItemNft'

const {
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
  listFilter,
  filteredList,
  selectedRow,
  selectNft,
  displayUriHref,
  parseInlineJson
} = useGameItemNft()

const inlineMeta = computed(() => {
  const u = selectedRow.value?.uri
  if (!u) return null
  return parseInlineJson(u)
})

const metaImageHref = computed(() => {
  const m = inlineMeta.value
  if (!m || typeof m.image !== 'string') return null
  return displayUriHref(m.image) ?? (m.image.startsWith('http') ? m.image : null)
})

const selectedUriExternal = computed(() => {
  const u = selectedRow.value?.uri
  if (!u) return null
  return displayUriHref(u)
})
</script>

<template>
  <section class="contract-card">
    <h2>NFT（GameItem · ERC721）</h2>
    <p class="sub">
      连接钱包并切到 Sepolia；在 <code>web3-dapp/.env</code> 配置
      <code>VITE_GAME_ITEM_NFT_ADDRESS</code>（在 <code>hardhat/</code> 执行
      <code>npm run deploy:sepolia:nft</code>），保存后重启 <code>npm run dev</code>。
    </p>

    <p v-if="!configuredAddress" class="warn compact">未配置 NFT 合约地址。</p>
    <p v-else class="addr-line">
      <span class="label">合约</span>
      <code>{{ configuredAddress }}</code>
    </p>

    <div class="row actions-inline">
      <button type="button" class="btn" :disabled="loadingMeta" @click="loadCollectionMeta">
        {{ loadingMeta ? '…' : '刷新合集信息' }}
      </button>
      <button type="button" class="btn" :disabled="loadingList" @click="loadNftList">
        {{ loadingList ? '…' : '刷新 NFT 列表' }}
      </button>
    </div>
    <p v-if="metaError" class="error">{{ metaError }}</p>

    <dl v-if="collectionName !== null && !metaError" class="meta-dl">
      <div>
        <dt>名称 / 符号</dt>
        <dd>
          <code>{{ collectionName }}</code> / <code>{{ collectionSymbol }}</code>
        </dd>
      </div>
      <div>
        <dt>已铸造总数</dt>
        <dd><code>{{ totalMinted ?? '—' }}</code></dd>
      </div>
      <div>
        <dt>我的持有量</dt>
        <dd><code>{{ myBalance ?? '—' }}</code></dd>
      </div>
      <div>
        <dt>本地址铸造额度（mint + owner 发放）</dt>
        <dd>
          <code>{{ myMintCount ?? '—' }} / {{ mintCapPerWallet ?? '—' }}</code>
          <span v-if="atMintCap" class="cap-warn">已达上限，无法再 mint。</span>
        </dd>
      </div>
    </dl>

    <hr class="sep" />

    <h3 class="h3">铸造 NFT</h3>
    <p class="sub write-hint">
      调用 <code>mint(tokenURI)</code>，NFT 归当前地址；合约使用 <code>ReentrancyGuard</code>、<code>_safeMint</code>，且每地址通过
      mint / <code>awardItem</code> 获得的总数有上限（见上表）。URI 可为 <code>https://...</code>、<code>ipfs://...</code> 或
      <code>data:application/json;base64,...</code>。
    </p>
    <div class="row">
      <label class="label" for="nft-uri">tokenURI</label>
      <textarea
        id="nft-uri"
        v-model="tokenUriDraft"
        class="textarea"
        rows="3"
        placeholder="https://…/1.json"
        spellcheck="false"
      />
    </div>
    <button type="button" class="btn primary" :disabled="!canMint" @click="submitMint">
      {{ mintSubmitting ? '等待钱包 / 确认…' : '铸造' }}
    </button>
    <p v-if="mintError" class="error">{{ mintError }}</p>
    <p v-if="lastMintTxHash" class="success">
      已提交
      <a :href="`https://sepolia.etherscan.io/tx/${lastMintTxHash}`" target="_blank" rel="noreferrer">Etherscan</a>
      <span v-if="lastMintBlock !== null">（区块 #{{ lastMintBlock }}）</span>
    </p>

    <hr class="sep" />

    <h3 class="h3">已铸造列表</h3>
    <div class="filter-row">
      <label class="radio-pill">
        <input v-model="listFilter" type="radio" value="all" />
        <span>全部（最多 100 条）</span>
      </label>
      <label class="radio-pill">
        <input v-model="listFilter" type="radio" value="mine" />
        <span>仅我的</span>
      </label>
    </div>
    <p v-if="listError" class="error soft">{{ listError }}</p>

    <div v-if="filteredList.length" class="table-wrap">
      <table class="rec-table">
        <thead>
          <tr>
            <th>tokenId</th>
            <th>owner</th>
            <th>tokenURI（摘要）</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in filteredList"
            :key="r.id"
            :class="{ active: selectedRow?.id === r.id }"
            class="click-row"
            @click="selectNft(r.id)"
          >
            <td class="mono">#{{ r.id }}</td>
            <td class="mono small">{{ r.owner }}</td>
            <td class="mono small uri-ellipsis" :title="r.uri">{{ r.uri }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="!loadingList" class="muted-inline">暂无 NFT 或当前筛选无结果。</p>

    <div v-if="selectedRow" class="detail-card">
      <h4 class="h4">NFT 详情 · #{{ selectedRow.id }}</h4>
      <dl class="detail-dl">
        <div>
          <dt>owner</dt>
          <dd class="mono">{{ selectedRow.owner }}</dd>
        </div>
        <div>
          <dt>tokenURI（完整）</dt>
          <dd>
            <pre class="uri-pre">{{ selectedRow.uri }}</pre>
            <a
              v-if="selectedUriExternal"
              class="ext-link"
              :href="selectedUriExternal"
              target="_blank"
              rel="noreferrer"
              >在浏览器中打开资源</a
            >
          </dd>
        </div>
      </dl>

      <template v-if="inlineMeta">
        <p class="sub strong">链上内嵌 JSON 元数据</p>
        <div v-if="metaImageHref" class="img-wrap">
          <img :src="metaImageHref" alt="metadata image" class="meta-img" />
        </div>
        <pre class="json-pre">{{ JSON.stringify(inlineMeta, null, 2) }}</pre>
      </template>
    </div>
  </section>
</template>

<style scoped>
.contract-card {
  margin-top: 1.75rem;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  box-shadow: var(--shadow);
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
  color: var(--text-h);
}

.h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  color: var(--text-h);
}

.h4 {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  color: var(--text-h);
}

.sep {
  margin: 1.5rem 0;
  border: none;
  border-top: 1px solid var(--border);
}

.sub {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: var(--text);
  line-height: 1.5;
}

.sub.strong {
  font-weight: 600;
  color: var(--text-h);
}

.sub code {
  font-size: 0.8rem;
}

.warn.compact {
  margin: 0 0 1rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  font-size: 0.85rem;
  color: var(--text-h);
}

.addr-line {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  word-break: break-all;
}

.addr-line .label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  margin-bottom: 0.25rem;
}

.actions-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.btn {
  font: inherit;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  color: var(--text-h);
  cursor: pointer;
}

.btn.primary {
  background: var(--accent-bg);
  border-color: var(--accent-border);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.meta-dl {
  margin: 0.5rem 0 0;
  display: grid;
  gap: 0.65rem;
}

.meta-dl dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  margin-bottom: 0.2rem;
}

.meta-dl dd {
  margin: 0;
}

.cap-warn {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: #ca8a04;
}

@media (prefers-color-scheme: dark) {
  .cap-warn {
    color: #facc15;
  }
}

.row {
  margin-bottom: 0.75rem;
}

.row .label {
  display: block;
  font-size: 0.75rem;
  color: var(--text);
  margin-bottom: 0.35rem;
}

.textarea {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  font-size: 0.88rem;
  padding: 0.5rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  color: var(--text-h);
  resize: vertical;
}

.write-hint {
  margin-bottom: 0.75rem;
}

.error {
  margin: 0.75rem 0 0;
  color: #dc2626;
  font-size: 0.9rem;
}

.error.soft {
  opacity: 0.95;
}

@media (prefers-color-scheme: dark) {
  .error {
    color: #f87171;
  }
}

.success {
  margin: 0.75rem 0 0;
  font-size: 0.9rem;
  color: var(--text-h);
}

.success a {
  color: var(--accent);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.radio-pill {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.88rem;
  cursor: pointer;
  color: var(--text-h);
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.rec-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.rec-table th,
.rec-table td {
  padding: 0.45rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.rec-table th {
  background: var(--code-bg);
  color: var(--text);
}

.rec-table tr:last-child td {
  border-bottom: none;
}

.click-row {
  cursor: pointer;
}

.click-row:hover {
  background: var(--accent-bg);
}

.click-row.active {
  outline: 2px solid var(--accent-border);
}

.mono {
  font-family: ui-monospace, monospace;
  word-break: break-all;
}

.mono.small {
  font-size: 0.72rem;
  max-width: 10rem;
}

.uri-ellipsis {
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted-inline {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
  color: var(--text);
  opacity: 0.85;
}

.detail-card {
  margin-top: 1.25rem;
  padding: 1rem;
  border-radius: 10px;
  border: 1px solid var(--accent-border);
  background: var(--code-bg);
}

.detail-dl {
  margin: 0;
  display: grid;
  gap: 0.75rem;
}

.detail-dl dt {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
}

.detail-dl dd {
  margin: 0;
}

.uri-pre {
  margin: 0.35rem 0;
  padding: 0.5rem;
  border-radius: 6px;
  background: var(--bg);
  border: 1px solid var(--border);
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 10rem;
  overflow: auto;
}

.ext-link {
  font-size: 0.85rem;
  color: var(--accent);
}

.json-pre {
  margin: 0.5rem 0 0;
  padding: 0.65rem;
  border-radius: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  font-size: 0.75rem;
  overflow: auto;
  max-height: 16rem;
}

.img-wrap {
  margin: 0.5rem 0;
}

.meta-img {
  max-width: 100%;
  max-height: 220px;
  border-radius: 8px;
  border: 1px solid var(--border);
  object-fit: contain;
}
</style>
