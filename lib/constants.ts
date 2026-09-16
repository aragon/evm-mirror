export const MIRROR_VERSION = "0.16.0";

export const DEFAULT_SOLC_VERSION = "0.8.28";

/**
 * Named chain IDs used throughout the codebase. Values are the on-chain IDs
 * as strings (matching the format returned by every JSON-RPC and CLI arg).
 * Reference these constants instead of writing bare numeric literals.
 */
export const CHAINS = {
  // Etherscan V2 (unified API, one key)
  MAINNET: "1",
  OPTIMISM: "10",
  POLYGON: "137",
  ZKSYNC_SEPOLIA: "300",
  ZKSYNC: "324",
  BASE: "8453",
  ARBITRUM: "42161",
  TAIKO: "167000",
  SEPOLIA: "11155111",

  // Routescan (Etherscan-compatible)
  AVALANCHE: "43114",
  CHILIZ: "88888",
  CORN: "21000000",

  // Blockscout
  MONAD: "143",
  CITREA: "4114",
  HEMI: "43111",
  KATANA: "747474",
} as const;
