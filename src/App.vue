<script setup lang="ts">
import { onMounted } from 'vue'
import { useWallet } from './composables/useWallet'

const {
  address,
  balanceWei,
  chainId,
  error,
  isConnecting,
  hasMetaMask,
  isSepolia,
  connect,
  refreshBalance,
  switchToSepolia,
  trySilentReconnect,
  registerListeners,
  sepoliaChainId
} = useWallet()

registerListeners()

onMounted(() => {
  void trySilentReconnect()
})
</script>

<template>
  <div class="wallet-app">
    <header class="wallet-header">
      <h1>Web3 DApp</h1>
      <p class="lead">Vue 3 + ethers.js v6 · MetaMask（Day 18–19）</p>
    </header>

    <section class="wallet-card">
      <p v-if="!hasMetaMask" class="warn">
        未检测到 <code>window.ethereum</code>。请安装
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer"
          >MetaMask</a
        >
        后使用本页。
      </p>

      <div class="actions">
        <button
          type="button"
          class="btn primary"
          :disabled="!hasMetaMask || isConnecting"
          @click="connect"
        >
          {{ isConnecting ? '连接中…' : '连接 MetaMask' }}
        </button>
        <button
          type="button"
          class="btn"
          :disabled="!address"
          @click="refreshBalance"
        >
          刷新余额
        </button>
        <button type="button" class="btn" :disabled="!hasMetaMask" @click="switchToSepolia">
          切换到 Sepolia
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <dl class="info">
        <div>
          <dt>账户地址</dt>
          <dd>
            <code v-if="address">{{ address }}</code>
            <span v-else class="muted">未连接</span>
          </dd>
        </div>
        <div>
          <dt>ETH 余额（当前 MetaMask 网络）</dt>
          <dd>
            <code v-if="balanceWei !== null">{{ balanceWei }} ETH</code>
            <span v-else class="muted">—</span>
          </dd>
        </div>
        <div>
          <dt>当前链</dt>
          <dd>
            <template v-if="chainId !== null">
              <code>chainId {{ chainId.toString() }}</code>
              <span v-if="isSepolia" class="badge ok">Sepolia</span>
              <span v-else class="badge warn">非 Sepolia（期望 {{ sepoliaChainId.toString() }}）</span>
            </template>
            <span v-else class="muted">—</span>
          </dd>
        </div>
      </dl>

      <p class="hint">
        在 Sepolia 上查看余额前，请先把 MetaMask 切到 Sepolia，或点击「切换到 Sepolia」。测试币可从
        <a href="https://sepoliafaucet.com/" target="_blank" rel="noreferrer">水龙头</a>
        领取。
      </p>
    </section>
  </div>
</template>

<style scoped>
.wallet-app {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
  text-align: left;
}

.wallet-header h1 {
  margin: 0 0 0.35rem;
  font-size: 1.75rem;
}

.lead {
  margin: 0;
  color: var(--text);
  opacity: 0.9;
  font-size: 0.95rem;
}

.wallet-card {
  margin-top: 1.75rem;
  padding: 1.5rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  box-shadow: var(--shadow);
}

.warn {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--text-h);
}

.warn a {
  color: var(--accent);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.btn {
  font: inherit;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  color: var(--text-h);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.btn:hover:not(:disabled) {
  border-color: var(--accent-border);
  box-shadow: var(--shadow);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn.primary {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--text-h);
}

.error {
  margin: 0 0 1rem;
  color: #dc2626;
  font-size: 0.9rem;
}

@media (prefers-color-scheme: dark) {
  .error {
    color: #f87171;
  }
}

.info {
  margin: 0;
  display: grid;
  gap: 1rem;
}

.info dt {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  margin-bottom: 0.25rem;
}

.info dd {
  margin: 0;
  word-break: break-all;
}

.muted {
  color: var(--text);
  opacity: 0.7;
}

.badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  vertical-align: middle;
}

.badge.ok {
  background: rgba(34, 197, 94, 0.2);
  color: #16a34a;
}

.badge.warn {
  background: rgba(234, 179, 8, 0.2);
  color: #ca8a04;
}

@media (prefers-color-scheme: dark) {
  .badge.ok {
    color: #4ade80;
  }
  .badge.warn {
    color: #facc15;
  }
}

.hint {
  margin: 1.25rem 0 0;
  font-size: 0.85rem;
  color: var(--text);
  line-height: 1.5;
}

.hint a {
  color: var(--accent);
}
</style>
