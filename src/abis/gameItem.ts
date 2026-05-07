/** GameItem（ERC721 + URIStorage）ABI 片段 */
export const GAME_ITEM_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function MAX_MINT_PER_WALLET() view returns (uint256)',
  'function mintCountOf(address account) view returns (uint256)',
  'function totalMinted() view returns (uint256)',
  'function mint(string tokenURI) returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
] as const
