export const ETHERSCAN_ENDPOINTS = {
  // Etherscan
  "1": {
    urlPrefix:
      "https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode",
    requiresApiKey: true,
  },
  "137": {
    urlPrefix:
      "https://api.etherscan.io/v2/api?chainid=137&module=contract&action=getsourcecode",
    requiresApiKey: true,
  },
  "42161": {
    urlPrefix:
      "https://api.etherscan.io/v2/api?chainid=42161&module=contract&action=getsourcecode",
    requiresApiKey: true,
  },
  "8453": {
    urlPrefix:
      "https://api.etherscan.io/v2/api?chainid=8453&module=contract&action=getsourcecode",
    requiresApiKey: true,
  },
  "10": {
    urlPrefix:
      "https://api.etherscan.io/v2/api?chainid=10&module=contract&action=getsourcecode",
    requiresApiKey: true,
  },
  "11155111": {
    urlPrefix:
      "https://api.etherscan.io/v2/api?chainid=11155111&module=contract&action=getsourcecode",
    requiresApiKey: true,
  },

  // Etherscan-compatible
  "21000000": {
    urlPrefix:
      "https://api.routescan.io/v2/network/mainnet/evm/21000000/etherscan/api?module=contract&action=getsourcecode",
    requiresApiKey: false,
  },
  "88888": {
    urlPrefix:
      "https://api.routescan.io/v2/network/mainnet/evm/88888/etherscan/api?module=contract&action=getsourcecode",
    requiresApiKey: false,
  },
} as const;
