/** SimpleStorage 合约 ABI 片段（与 hardhat/contracts 中接口一致） */
export const SIMPLE_STORAGE_ABI = [
  'function getNum() view returns (uint256)',
  'function setNum(uint256 _num)',
  'event NumUpdated(uint256 newValue)'
] as const
