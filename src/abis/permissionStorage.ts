/** PermissionStorage.sol — 与 hardhat/contracts 保持一致，供前端只读 / 将来写入 */
export const PERMISSION_STORAGE_ABI = [
  'function owner() view returns (address)',
  'function getPermission(address account) view returns (bool)',
  'function setPermission(address account, bool allowed)'
] as const
