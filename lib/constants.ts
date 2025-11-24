export const MIRROR_VERSION = "0.13.0";

export const SUPPORTED_CHAIN_IDS = [
  // Etherscan
  "1", // Mainnet
  "137", // Polygon
  "42161", // Arbitrum
  "8453", // Base
  "10", // Optimism
  "324", // ZkSync
  // Etherscan (testnets)
  "11155111", // Sepolia
  "17000", // Holesky
  "300", // ZkSync Sepolia

  // Routescan
  "43114", // Avalanche
  "21000000", // Corn
  "88888", // Chiliz

  // BlockScout
  "747474", // Katana
] as const;
