/** MemoStorage 合约 ABI 片段（与 hardhat/contracts 中接口一致） */
export const MEMO_STORAGE_ABI = [
  'function getMemo(address account) view returns (string)',
  'function setMyMemo(string content)',
  'function deleteMyMemo()',
  'event MemoUpdated(address indexed author, string content)',
  'event MemoDeleted(address indexed author)'
] as const
