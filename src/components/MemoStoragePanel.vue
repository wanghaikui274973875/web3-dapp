<script setup lang="ts">
import { useMemoStorage } from '../composables/useMemoStorage'

const {
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
  maxMemoChars
} = useMemoStorage()
</script>

<template>
  <section class="contract-card">
    <h2>链上备忘录（MemoStorage）</h2>
    <p class="sub">
      先连接 MetaMask 并切到 Sepolia；在 <code>web3-dapp/.env</code> 配置
      <code>VITE_MEMO_STORAGE_ADDRESS</code>（<code>npm run deploy:sepolia:memo</code> 部署后地址），保存后重启
      <code>npm run dev</code>。
    </p>
    <p class="sub rule">
      规则：每个地址<strong>仅本人</strong>可写入/更新/删除自己的备忘录；任何人可读任意地址的备忘录（输入查询地址或留空读当前钱包）。
    </p>

    <p v-if="!configuredAddress" class="warn compact">
      未配置合约地址，请复制 <code>.env.example</code> 中的变量到 <code>.env</code> 并填入。
    </p>
    <p v-else class="addr-line">
      <span class="label">合约</span>
      <code>{{ configuredAddress }}</code>
    </p>

    <h3 class="h3">读取</h3>
    <div class="row">
      <label class="label" for="memo-query">查询地址（留空 = 当前已连接钱包）</label>
      <input
        id="memo-query"
        v-model="queryAddress"
        type="text"
        class="input"
        placeholder="0x…"
        spellcheck="false"
        autocomplete="off"
      />
    </div>
    <button type="button" class="btn primary" :disabled="reading" @click="readFromChain">
      {{ reading ? '读取中…' : '读取链上备忘录' }}
    </button>
    <p v-if="readError" class="error">{{ readError }}</p>
    <div v-if="memoContent !== null" class="memo-box">
      <p class="memo-meta">
        地址 <code>{{ resolvedQueryAddress }}</code> 的备忘录：
      </p>
      <pre class="memo-pre">{{ memoContent || '（空）' }}</pre>
    </div>

    <hr class="sep" />

    <h3 class="h3">写入 / 删除（仅当前钱包本人）</h3>
    <p class="sub write-hint">
      下方内容将调用 <code>setMyMemo</code> 存到链上；删除调用 <code>deleteMyMemo</code>。需 Sepolia ETH；文本越长 gas 越高（前端限制 {{ maxMemoChars }} 字符）。
    </p>
    <div class="row">
      <label class="label" for="memo-draft">我的备忘录</label>
      <textarea
        id="memo-draft"
        v-model="draft"
        class="textarea"
        rows="6"
        :maxlength="maxMemoChars"
        placeholder="在此输入要保存到链上的内容…"
        spellcheck="true"
      />
      <p class="char-count">{{ draft.length }} / {{ maxMemoChars }}</p>
    </div>
    <div class="btn-row">
      <button type="button" class="btn primary" :disabled="!canWrite" @click="submitSetMyMemo">
        {{ writeSubmitting ? '处理中…' : '保存到链上' }}
      </button>
      <button type="button" class="btn danger" :disabled="!canWrite" @click="submitDeleteMyMemo">
        {{ writeSubmitting ? '处理中…' : '删除我的备忘录' }}
      </button>
    </div>
    <p v-if="writeError" class="error">{{ writeError }}</p>
    <p v-if="writeError && lastTxHash" class="tx-hint">
      <a :href="`https://sepolia.etherscan.io/tx/${lastTxHash}`" target="_blank" rel="noreferrer">Etherscan</a>
      <code class="tx-hash">{{ lastTxHash }}</code>
    </p>
    <p v-if="lastTxBlock !== null" class="success">
      已确认（区块 #{{ lastTxBlock }}）。
      <a :href="`https://sepolia.etherscan.io/tx/${lastTxHash}`" target="_blank" rel="noreferrer">查看交易</a>
    </p>
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

.sub code {
  font-size: 0.8rem;
}

.rule {
  padding: 0.5rem 0.65rem;
  border-radius: 8px;
  background: var(--code-bg);
  border: 1px solid var(--border);
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

.row {
  margin-bottom: 0.75rem;
}

.row .label {
  display: block;
  font-size: 0.75rem;
  color: var(--text);
  margin-bottom: 0.35rem;
}

.input,
.textarea {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  font-size: 0.9rem;
  padding: 0.5rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  color: var(--text-h);
}

.textarea {
  resize: vertical;
  min-height: 6rem;
}

.char-count {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  color: var(--text);
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
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

.btn.danger {
  border-color: rgba(220, 38, 38, 0.45);
  background: rgba(220, 38, 38, 0.12);
}

@media (prefers-color-scheme: dark) {
  .btn.danger {
    border-color: rgba(248, 113, 113, 0.45);
    background: rgba(248, 113, 113, 0.12);
  }
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.write-hint {
  margin-bottom: 0.75rem;
}

.error {
  margin: 0.75rem 0 0;
  color: #dc2626;
  font-size: 0.9rem;
}

@media (prefers-color-scheme: dark) {
  .error {
    color: #f87171;
  }
}

.memo-box {
  margin-top: 1rem;
}

.memo-meta {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: var(--text);
}

.memo-pre {
  margin: 0;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--text-h);
}

.tx-hint {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
}

.tx-hint a {
  color: var(--accent);
  margin-right: 0.35rem;
}

.tx-hash {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.72rem;
  word-break: break-all;
}

.success {
  margin: 0.75rem 0 0;
  font-size: 0.9rem;
  color: var(--text-h);
}

.success a {
  color: var(--accent);
}
</style>
