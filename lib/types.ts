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

/**
 * A single provider entry attached to a chain. The resolver instantiates one
 * `Provider` per candidate, in order, and falls through on failure.
 */
export type NetworkCandidate =
  | { kind: "etherscan"; urlPrefix: string; requiresApiKey?: boolean }
  | { kind: "blockscout"; urlPrefix: string };

export type Network = {
  chainId: string;
  candidates: NetworkCandidate[];
};
