import { Network, SupportedChainId } from "./types.ts";

export function getNetworkExplorer(chainId: SupportedChainId): Network {
  switch (chainId) {
    case "1":
    case "137":
    case "42161":
    case "8453":
    case "10":
    case "11155111":
    case "17000":
    case "300":
    case "324":
      return {
        urlPrefix: `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode`,
        requiresApiKey: true,
      };

    case "21000000":
    case "88888":
      return {
        urlPrefix: `https://api.routescan.io/v2/network/mainnet/evm/${chainId}/etherscan/api?module=contract&action=getsourcecode`,
        requiresApiKey: false,
      };

    default:
      throw new Error("Network not supported: " + chainId);
  }
}
