export const ETHERSCAN_ENDPOINTS = {
  // Etherscan
  "1": { url: "https://api.etherscan.io", requiresApiKey: true },
  "137": { url: "https://api.polygonscan.com", requiresApiKey: true },
  "42161": { url: "https://api.arbiscan.io", requiresApiKey: true },
  "8453": { url: "https://api.basescan.org", requiresApiKey: true },
  "10": { url: "https://api.optimistic.etherscan.io", requiresApiKey: true },
  "11155111": { url: "https://api.sepolia.etherscan.io", requiresApiKey: true },
  // Etherscan-compatible
  "21000000": {
    url: "https://api.routescan.io/v2/network/mainnet/evm/21000000/etherscan",
    requiresApiKey: false,
  },
  "88888": {
    url: "https://api.routescan.io/v2/network/mainnet/evm/88888/etherscan",
    requiresApiKey: false,
  },
} as const;
