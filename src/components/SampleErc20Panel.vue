<script setup lang="ts">
import { useSampleErc20 } from '../composables/useSampleErc20'

const {
  tokenName,
  tokenSymbol,
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
  historyBlockSpan
} = useSampleErc20()
</script>

<template>
  <section class="contract-card">
    <h2>ERC20 转账（SampleERC20）</h2>
    <p class="sub">
      连接钱包并切到 Sepolia；在 <code>web3-dapp/.env</code> 配置
      <code>VITE_SAMPLE_ERC20_ADDRESS</code>（在 <code>hardhat/</code> 执行
      <code>npm run deploy:sepolia:erc20</code> 部署后把地址写入），保存后重启
      <code>npm run dev</code>。
    </p>

    <p v-if="!configuredAddress" class="warn compact">
      未配置代币合约地址。
    </p>
    <p v-else class="addr-line">
      <span class="label">代币合约</span>
      <code>{{ configuredAddress }}</code>
    </p>

    <div class="row actions-inline">
      <button type="button" class="btn" :disabled="loadingInfo" @click="loadTokenInfo">
        {{ loadingInfo ? '刷新中…' : '刷新余额与名称' }}
      </button>
      <button type="button" class="btn" :disabled="loadingHistory" @click="loadTransferHistory">
        {{ loadingHistory ? '加载中…' : '刷新转账记录' }}
      </button>
    </div>

    <p v-if="infoError" class="error">{{ infoError }}</p>

    <dl v-if="tokenSymbol !== null && !infoError" class="token-meta">
      <div>
        <dt>代币</dt>
        <dd>
          <code>{{ tokenName }}</code>（<code>{{ tokenSymbol }}</code>）
        </dd>
      </div>
      <div>
        <dt>当前钱包余额</dt>
        <dd>
          <code>{{ tokenBalance ?? '—' }} {{ tokenSymbol }}</code>
        </dd>
      </div>
    </dl>

    <hr class="sep" />

    <h3 class="h3">转账</h3>
    <p class="sub write-hint">向接收地址发送代币；需 Sepolia ETH 支付 gas。数量按人类可读小数填写（与代币 decimals 一致）。</p>

    <div class="row">
      <label class="label" for="erc20-to">接收地址</label>
      <input
        id="erc20-to"
        v-model="transferTo"
        type="text"
        class="input"
        placeholder="0x…"
        spellcheck="false"
        autocomplete="off"
      />
    </div>
    <div class="row">
      <label class="label" for="erc20-amt">数量（{{ tokenSymbol ?? '…' }}）</label>
      <input
        id="erc20-amt"
        v-model="transferAmount"
        type="text"
        class="input"
        inputmode="decimal"
        placeholder="例如 10 或 0.5"
        spellcheck="false"
        autocomplete="off"
      />
    </div>

    <button type="button" class="btn primary" :disabled="!canTransfer" @click="submitTransfer">
      {{ transferSubmitting ? '等待钱包 / 确认…' : '发起转账' }}
    </button>

    <p v-if="transferError" class="error">{{ transferError }}</p>
    <p v-if="transferError && lastTxHash" class="tx-hint">
      <a :href="`https://sepolia.etherscan.io/tx/${lastTxHash}`" target="_blank" rel="noreferrer">Etherscan</a>
      <code class="tx-hash">{{ lastTxHash }}</code>
    </p>
    <p v-if="lastTxBlock !== null" class="success">
      已确认（区块 #{{ lastTxBlock }}）。
      <a :href="`https://sepolia.etherscan.io/tx/${lastTxHash}`" target="_blank" rel="noreferrer">查看交易</a>
    </p>

    <hr class="sep" />

    <h3 class="h3">转账记录</h3>
    <p class="sub muted">
      最近约 {{ historyBlockSpan }} 个区块内、与当前钱包相关的 <code>Transfer</code> 事件（最多 25 条）；完整历史可在 Etherscan 代币页查看。
    </p>
    <p v-if="historyError" class="error">{{ historyError }}</p>

    <div v-if="transferRecords.length" class="table-wrap">
      <table class="rec-table">
        <thead>
          <tr>
            <th>方向</th>
            <th>对手地址</th>
            <th>数量</th>
            <th>区块</th>
            <th>交易</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in transferRecords" :key="`${r.txHash}-${i}`">
            <td>
              <span :class="r.direction === 'out' ? 'tag-out' : 'tag-in'">{{
                r.direction === 'out' ? '转出' : '转入'
              }}</span>
            </td>
            <td class="mono">{{ r.peer }}</td>
            <td class="mono">{{ r.amount }}</td>
            <td class="mono">{{ r.blockNumber }}</td>
            <td>
              <a
                :href="`https://sepolia.etherscan.io/tx/${r.txHash}`"
                target="_blank"
                rel="noreferrer"
                >打开</a
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="tokenSymbol !== null && !loadingHistory && !historyError" class="muted-inline">
      暂无记录（或尚未在该区块范围内发生过转账）。
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

.sub.muted {
  opacity: 0.9;
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

.token-meta {
  margin: 0.5rem 0 0;
  display: grid;
  gap: 0.65rem;
}

.token-meta dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  margin-bottom: 0.2rem;
}

.token-meta dd {
  margin: 0;
  word-break: break-all;
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

.table-wrap {
  overflow-x: auto;
  margin-top: 0.75rem;
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
  font-weight: 600;
}

.rec-table tr:last-child td {
  border-bottom: none;
}

.mono {
  font-family: ui-monospace, monospace;
  word-break: break-all;
  max-width: 12rem;
}

.tag-out,
.tag-in {
  display: inline-block;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  font-size: 0.72rem;
}

.tag-out {
  background: rgba(59, 130, 246, 0.15);
}

.tag-in {
  background: rgba(34, 197, 94, 0.15);
}

.rec-table a {
  color: var(--accent);
  white-space: nowrap;
}

.muted-inline {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
  color: var(--text);
  opacity: 0.85;
}
</style>
