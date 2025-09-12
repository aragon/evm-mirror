export type CliArguments = {
  contracts: string[];
  chainId: string;
  apiKey: string;
  sourceRoot: string;
  remappings?: string;
};

export interface EtherscanSourceResult {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string; // "v0.8.17+commit.8df45f5f"
  CompilerType: string; // "solc-j"
  OptimizationUsed: string; // "1"
  Runs: string; // "2000"
  ConstructorArguments: string; // ""
  EVMVersion: string; // "Default"
  Library: string; // ""
  ContractFileName: string; // "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol"
  LicenseType: string; // ""
  Proxy: string; // "1"
  Implementation: string; // "0xced33df91ac49415c74bf1b5c218b83a2b8c2f3c"
  SwarmSource: string; // ""
  SimilarMatch: string; // "0xE640Da5AD169630555A86D9b6b9C145B4961b1EB
}

export interface EtherscanSoliditySourceEntries {
  language: "Solidity";
  sources: {
    [key: string]: {
      content: string;
    };
  };
}

export type Remappings = Record<string, string>;
