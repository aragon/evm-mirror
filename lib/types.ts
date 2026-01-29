import { SUPPORTED_CHAIN_IDS } from "./constants.ts";

export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export type ContractSources = {
  address: string;
  sources: { [k: string]: string };
};

export type CompilerMeta = {
  compilerVersion: string; // "v0.8.17+commit.abc123"
  optimizationUsed: boolean;
  runs: number;
  evmVersion: string; // "paris" or "Default"
  contractFileName: string; // "src/Token.sol"
  contractName: string; // "Token"
};

export type ContractSourcesWithMeta = ContractSources & {
  meta: CompilerMeta;
};

export type Remappings = Record<string, string>;

export type Network = {
  type: "etherscan" | "blockscout";
  urlPrefix: string;
  requiresApiKey?: boolean;
  chainId: SupportedChainId;
};
