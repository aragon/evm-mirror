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
  remappings: string[]; // ["@openzeppelin/=lib/openzeppelin/", ...]
};

export type ContractSourcesWithMeta = ContractSources & {
  meta: CompilerMeta;
  proxy?: {
    implementation: string;
  };
};

export type Remappings = Record<string, string>;

export type SourceProvider = "explorer" | "sourcify" | "auto";

export type ChainInfo = {
  chainId: string;
};

export type Network = {
  type: "etherscan" | "blockscout";
  urlPrefix: string;
  requiresApiKey?: boolean;
  chainId: SupportedChainId;
} & ChainInfo;
