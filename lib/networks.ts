import { CHAINS } from "./constants.ts";
import { Network, NetworkCandidate } from "./types.ts";

/**
 * Returns the ordered list of providers to try for a chain.
 *
 * A chain can list multiple candidates (e.g., Etherscan + Blockscout). The
 * resolver tries them top-to-bottom and, if all fail, falls through to
 * Sourcify. Unknown chains return an empty candidate list — Sourcify still
 * handles them via the resolver tail.
 */
export function getNetworkData(chainId: string): Network {
  return {
    chainId,
    candidates: REGISTRY[chainId] ?? [],
  };
}

// Candidate constructors

const etherscanV2 = (chainId: string): NetworkCandidate => ({
  kind: "etherscan",
  urlPrefix:
    `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode`,
  requiresApiKey: true,
});

const routescan = (chainId: string): NetworkCandidate => ({
  kind: "etherscan",
  urlPrefix:
    `https://api.routescan.io/v2/network/mainnet/evm/${chainId}/etherscan/api?module=contract&action=getsourcecode`,
});

const blockscout = (host: string): NetworkCandidate => ({
  kind: "blockscout",
  urlPrefix: `https://${host}/api`,
});

/**
 * Single source of truth for chain → provider mapping. Add a chain by adding
 * one entry here.
 */
const REGISTRY: Record<string, NetworkCandidate[]> = {
  // Etherscan V2
  [CHAINS.MAINNET]: [etherscanV2(CHAINS.MAINNET)],
  [CHAINS.OPTIMISM]: [etherscanV2(CHAINS.OPTIMISM)],
  [CHAINS.POLYGON]: [etherscanV2(CHAINS.POLYGON)],
  [CHAINS.ZKSYNC_SEPOLIA]: [etherscanV2(CHAINS.ZKSYNC_SEPOLIA)],
  [CHAINS.ZKSYNC]: [etherscanV2(CHAINS.ZKSYNC)],
  [CHAINS.BASE]: [etherscanV2(CHAINS.BASE)],
  [CHAINS.ARBITRUM]: [etherscanV2(CHAINS.ARBITRUM)],
  [CHAINS.TAIKO]: [etherscanV2(CHAINS.TAIKO)],
  [CHAINS.MONAD]: [etherscanV2(CHAINS.MONAD)],
  [CHAINS.SEPOLIA]: [etherscanV2(CHAINS.SEPOLIA)],

  // Routescan
  [CHAINS.AVALANCHE]: [routescan(CHAINS.AVALANCHE)],
  [CHAINS.CHILIZ]: [routescan(CHAINS.CHILIZ)],
  [CHAINS.CORN]: [routescan(CHAINS.CORN)],

  // Blockscout
  [CHAINS.CITREA]: [blockscout("explorer.mainnet.citrea.xyz")],
  [CHAINS.HEMI]: [blockscout("explorer.hemi.xyz")],

  // Etherscan primary, Blockscout fallback
  [CHAINS.KATANA]: [
    etherscanV2(CHAINS.KATANA),
    blockscout("explorer.katanarpc.com"),
  ],
};
