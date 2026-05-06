/** 解析钱包 / RPC 返回的数字错误码（含嵌套） */
function rpcNumericErrorCode(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined
  const o = err as Record<string, unknown>
  const c = o.code
  if (typeof c === 'number') return c
  if (c === '4001') return 4001
  const info = o.info
  if (typeof info === 'object' && info !== null && 'error' in info) {
    const inner = (info as { error?: { code?: unknown } }).error
    const ic = inner?.code
    if (typeof ic === 'number') return ic
    if (ic === '4001') return 4001
  }
  return undefined
}

/** MetaMask 拒绝签名、取消交易等（EIP-1193 4001 / ethers v6 ACTION_REJECTED） */
export function isEthersUserRejectedError(err: unknown): boolean {
  if (rpcNumericErrorCode(err) === 4001) return true
  if (typeof err !== 'object' || err === null) return false
  const o = err as Record<string, unknown>
  if (o.code === 'ACTION_REJECTED') return true
  const parts = [o.shortMessage, o.message].filter((x) => typeof x === 'string')
  const text = parts.join(' ')
  return /user rejected|denied transaction|ethers-user-denied|rejected signature|cancelled|canceled/i.test(
    text
  )
}

export function formatEthersSendError(err: unknown): string {
  if (isEthersUserRejectedError(err)) {
    return '已取消签名 / 用户拒绝了交易。'
  }
  if (err instanceof Error) {
    return err.message
  }
  return '发送交易失败。'
}
