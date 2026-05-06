/** PermissionStorage 合约 ABI 片段（与 hardhat/contracts 中接口一致） */
export const PERMISSION_STORAGE_ABI = [
  'function owner() view returns (address)',
  'function getPermission(address account) view returns (bool)',
  'function setPermission(address account, bool allowed)'
] as const
