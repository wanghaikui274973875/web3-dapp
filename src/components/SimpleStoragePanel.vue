<script setup lang="ts">
import { useSimpleStorage } from '../composables/useSimpleStorage'

const {
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
  recentEvents
} = useSimpleStorage()
</script>

<template>
  <section class="contract-card">
    <h2>SimpleStorage</h2>
    <p class="sub">
      在 <code>web3-dapp/.env</code> 配置
      <code>VITE_SIMPLE_STORAGE_ADDRESS</code>（与 Hardhat 部署到 Sepolia 的地址一致），保存后需重启
      <code>npm run dev</code>。
    </p>

    <p v-if="!configuredAddress" class="warn compact">
      当前未配置有效合约地址。可在 <code>.env.example</code> 中查看变量名，复制到 <code>.env</code> 并填入地址。
    </p>
    <p v-else class="addr-line">
      <span class="label">合约</span>
      <code>{{ configuredAddress }}</code>
    </p>

    <button type="button" class="btn primary" :disabled="reading" @click="readFromChain">
      {{ reading ? '读取中…' : '读取 getNum()' }}
    </button>

    <p v-if="readError" class="error">{{ readError }}</p>

    <dl v-if="numOnChain !== null" class="result">
      <div>
        <dt>getNum()</dt>
        <dd><code>{{ numOnChain }}</code></dd>
      </div>
    </dl>

    <p class="sub event-row">
      <span class="badge" :class="subscribed ? 'badge-ok' : 'badge-muted'">{{
        subscribed ? '已订阅 NumUpdated' : '未订阅'
      }}</span>
      <span class="event-hint">
        通过 MetaMask 注入的 HTTP 轮询监听，事件到达通常有几秒延迟；切链或断连后会自动重连订阅。
      </span>
    </p>
    <p v-if="subscribeError" class="error compact-err">{{ subscribeError }}</p>
    <p v-if="eventHistoryError" class="error compact-err">{{ eventHistoryError }}</p>

    <details v-if="configuredAddress" class="recent-events">
      <summary>最近 NumUpdated（最多 10 条）</summary>
      <ul v-if="recentEvents.length" class="event-list">
        <li v-for="(ev, i) in recentEvents" :key="`${ev.txHash}-${ev.blockNumber}-${i}`" class="event-item">
          <span class="ev-val"><code>{{ ev.value }}</code></span>
          <span class="ev-meta">区块 #{{ ev.blockNumber }}</span>
          <a
            class="ev-link"
            :href="`https://sepolia.etherscan.io/tx/${ev.txHash}`"
            target="_blank"
            rel="noreferrer"
            >交易</a
          >
          <span v-if="ev.removed" class="ev-removed">reorg 撤销</span>
        </li>
      </ul>
      <p v-else class="muted-inline">暂无记录（或历史加载失败 / 尚未有 setNum 上链）。</p>
    </details>

    <hr class="sep" />

    <h3 class="h3">setNum</h3>
    <p class="sub write-hint">
      使用 <code>getSigner()</code> 发送交易；需少量 Sepolia ETH。数值为非负十进制整数（uint256）。
    </p>

    <div class="row">
      <label class="label" for="simple-num">新数值</label>
      <input
        id="simple-num"
        v-model="writeNumStr"
        type="text"
        class="input"
        inputmode="numeric"
        placeholder="例如 42"
        spellcheck="false"
        autocomplete="off"
      />
    </div>

    <button
      type="button"
      class="btn danger"
      :disabled="!canSubmitWrite"
      @click="submitSetNum"
    >
      {{ writeSubmitting ? '等待钱包 / 上链确认…' : '提交 setNum' }}
    </button>

    <p v-if="writeError" class="error">{{ writeError }}</p>
    <p v-if="writeError && lastTxHash" class="tx-failed-hint">
      可在
      <a
        :href="`https://sepolia.etherscan.io/tx/${lastTxHash}`"
        target="_blank"
        rel="noreferrer"
        >Etherscan</a
      >
      查看该笔交易与回执。
      <code class="tx-hash">{{ lastTxHash }}</code>
    </p>
    <p v-if="lastTxBlock !== null" class="success">
      交易已确认（区块 #{{ lastTxBlock }}）。
      <a
        :href="`https://sepolia.etherscan.io/tx/${lastTxHash}`"
        target="_blank"
        rel="noreferrer"
        >Etherscan 查看交易</a
      >
      <code class="tx-hash">{{ lastTxHash }}</code>
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

.write-hint {
  margin-bottom: 0.75rem;
}

.tx-failed-hint {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: var(--text);
  line-height: 1.5;
}

.tx-failed-hint a {
  color: var(--accent);
  margin-right: 0.25rem;
}

.success {
  margin: 0.75rem 0 0;
  font-size: 0.9rem;
  color: var(--text-h);
  line-height: 1.5;
}

.success a {
  color: var(--accent);
  margin-right: 0.35rem;
}

.tx-hash {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.75rem;
  word-break: break-all;
}

.sub {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: var(--text);
  line-height: 1.5;
}

.sub code {
  font-size: 0.8rem;
}

.event-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem 0.75rem;
  margin-top: 0.75rem;
}

.event-hint {
  flex: 1 1 12rem;
  font-size: 0.8rem;
  color: var(--text);
  opacity: 0.9;
  line-height: 1.45;
}

.badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.badge-ok {
  background: rgba(34, 197, 94, 0.2);
  color: #16a34a;
}

.badge-muted {
  background: var(--code-bg);
  border: 1px solid var(--border);
  color: var(--text);
}

@media (prefers-color-scheme: dark) {
  .badge-ok {
    color: #4ade80;
  }
}

.compact-err {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
}

.recent-events {
  margin-top: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  font-size: 0.85rem;
}

.recent-events summary {
  cursor: pointer;
  color: var(--text-h);
  font-weight: 500;
}

.event-list {
  margin: 0.65rem 0 0;
  padding: 0;
  list-style: none;
}

.event-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.65rem;
  padding: 0.4rem 0;
  border-top: 1px solid var(--border);
}

.event-item:first-child {
  border-top: none;
  padding-top: 0.25rem;
}

.ev-val code {
  font-size: 0.85rem;
}

.ev-meta {
  font-size: 0.78rem;
  color: var(--text);
}

.ev-link {
  font-size: 0.78rem;
  color: var(--accent);
}

.ev-removed {
  font-size: 0.72rem;
  color: var(--text);
  opacity: 0.75;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: rgba(234, 179, 8, 0.15);
}

.muted-inline {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: var(--text);
  opacity: 0.75;
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

.input {
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

.result {
  margin: 1rem 0 0;
  display: grid;
  gap: 0.75rem;
}

.result dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  margin-bottom: 0.2rem;
}

.result dd {
  margin: 0;
  word-break: break-all;
}
</style>
