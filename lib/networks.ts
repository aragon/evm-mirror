import { Network, SupportedChainId } from "./types.ts";

export function getNetworkData(chainId: SupportedChainId): Network {
  switch (chainId) {
    // Etherscan
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
        type: "etherscan",
        urlPrefix: `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode`,
        requiresApiKey: true,
        chainId,
      };

    // Routescan (Etherscan compatible)
    case "21000000":
    case "43114":
    case "88888":
      return {
        type: "etherscan",
        urlPrefix: `https://api.routescan.io/v2/network/mainnet/evm/${chainId}/etherscan/api?module=contract&action=getsourcecode`,
        chainId,
      };

    // Blockscout
    case "747474":
      return {
        type: "blockscout",
        urlPrefix: "https://explorer.katanarpc.com/api",
        chainId,
      };

    default:
      throw new Error("Network not supported: " + chainId);
  }
}
