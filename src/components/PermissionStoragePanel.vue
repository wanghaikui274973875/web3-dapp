<script setup lang="ts">
import { usePermissionStorage } from '../composables/usePermissionStorage'

const {
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
} = usePermissionStorage()
</script>

<template>
  <section class="contract-card">
    <h2>PermissionStorage（读链上合约）</h2>
    <p class="sub">
      在 <code>web3-dapp/.env</code> 配置
      <code>VITE_PERMISSION_STORAGE_ADDRESS</code>（与 Hardhat 部署到 Sepolia 的地址一致），保存后需重启
      <code>npm run dev</code>。
    </p>

    <p v-if="!configuredAddress" class="warn compact">
      当前未配置有效合约地址。可复制 <code>.env.example</code> 为 <code>.env</code> 并填入地址。
    </p>
    <p v-else class="addr-line">
      <span class="label">合约</span>
      <code>{{ configuredAddress }}</code>
    </p>

    <div class="row">
      <label class="label" for="perm-query">查询权限的地址</label>
      <input
        id="perm-query"
        v-model="queryAddress"
        type="text"
        class="input"
        placeholder="留空则使用当前已连接的钱包地址"
        spellcheck="false"
        autocomplete="off"
      />
    </div>

    <button type="button" class="btn primary" :disabled="reading" @click="readFromChain">
      {{ reading ? '读取中…' : '读取 owner + getPermission' }}
    </button>

    <p v-if="readError" class="error">{{ readError }}</p>

    <dl v-if="owner !== null || permission !== null" class="result">
      <div v-if="owner !== null">
        <dt>owner</dt>
        <dd><code>{{ owner }}</code></dd>
      </div>
      <div v-if="permission !== null">
        <dt>getPermission(查询地址)</dt>
        <dd>
          <code>{{ permission ? 'true（已授权）' : 'false（未授权）' }}</code>
        </dd>
      </div>
    </dl>

    <hr class="sep" />

    <h3 class="h3">setPermission（仅 owner）</h3>
    <p class="sub write-hint">
      通过 <code>getSigner()</code> 发送交易，MetaMask 会估算 gas；需少量
      <strong>Sepolia ETH</strong>。建议先在上文点一次「读取」以确认
      <code>owner</code> 与当前钱包一致。
    </p>
    <p v-if="owner && !isOwnerWallet" class="warn compact">
      当前连接钱包与 owner 不一致，提交会在链上失败（NotOwner）。
    </p>

    <div class="row">
      <label class="label" for="perm-write-target">要设置权限的地址</label>
      <input
        id="perm-write-target"
        v-model="writeTarget"
        type="text"
        class="input"
        placeholder="0x…（40 位十六进制）"
        spellcheck="false"
        autocomplete="off"
      />
    </div>

    <label class="check-row">
      <input v-model="writeAllowed" type="checkbox" />
      <span>allowed = true（取消勾选则为撤销权限）</span>
    </label>

    <button
      type="button"
      class="btn danger"
      :disabled="!canSubmitWrite"
      @click="submitSetPermission"
    >
      {{ writeSubmitting ? '等待钱包 / 上链确认…' : '提交 setPermission' }}
    </button>

    <p v-if="writeError" class="error">{{ writeError }}</p>
    <p v-if="lastTxHash" class="success">
      已上链。
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

.check-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  color: var(--text-h);
  cursor: pointer;
}

.check-row input {
  margin-top: 0.2rem;
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
