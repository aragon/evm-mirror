import { red } from "@std/fmt/colors";
import { ContractSourcesWithMeta } from "../types.ts";
import { Provider, safeHost } from "./types.ts";

export type EtherscanConfig = {
  urlPrefix: string;
  chainId: string;
  apiKey?: string;
  requiresApiKey?: boolean;
};

export function etherscanProvider(config: EtherscanConfig): Provider {
  return {
    name: "etherscan",
    label: `etherscan (${safeHost(config.urlPrefix)})`,
    fetchSources: (address) => fetchEtherscan(address, config),
  };
}

async function fetchEtherscan(
  address: string,
  config: EtherscanConfig,
): Promise<ContractSourcesWithMeta> {
  if (config.requiresApiKey && !config.apiKey) {
    throw new Error(`API key required for chain ${config.chainId}`);
  }

  const url =
    `${config.urlPrefix}&address=${address}&apikey=${config.apiKey ?? ""}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  if (data.status !== "1") {
    throw new Error(`${data.message} - ${data.result}`);
  }

  return parseVerifiedSources(address, data.result[0]);
}

export function parseVerifiedSources(
  address: string,
  sourceResult: EtherscanVerifiedContract,
): ContractSourcesWithMeta {
  let sourceCode = sourceResult.SourceCode;
  if (
    !sourceCode ||
    sourceResult.ABI?.trim() === "Contract source code not verified"
  ) {
    throw new Error("Contract is not verified");
  }

  const result: ContractSourcesWithMeta = {
    address,
    sources: {},
    meta: {
      compilerVersion: sourceResult.CompilerVersion,
      optimizationUsed: sourceResult.OptimizationUsed === "1",
      runs: parseInt(sourceResult.Runs, 10) || 200,
      evmVersion: sourceResult.EVMVersion,
      contractFileName: sourceResult.ContractFileName,
      contractName: sourceResult.ContractName,
      remappings: [],
    },
  };

  if (sourceResult.Proxy === "1" && sourceResult.Implementation) {
    result.proxy = { implementation: sourceResult.Implementation };
  }

  if (sourceCode.startsWith("{{") && sourceCode.endsWith("}}")) {
    // Standard JSON-Input format
    sourceCode = sourceCode.slice(1, -1);

    try {
      const jsonInput: EtherscanSourceSet = JSON.parse(sourceCode);
      if (jsonInput.sources) {
        for (const path in jsonInput.sources) {
          result.sources[path] = jsonInput.sources[path].content;
        }
      }
      if (jsonInput.settings?.remappings) {
        result.meta.remappings = jsonInput.settings.remappings;
      }
    } catch (error) {
      console.error(red("Failed to parse Solidity JSON-Input:"), error);
      result.sources[`${sourceResult.ContractName}.sol`] = sourceCode;
    }
  } else {
    result.sources[`${sourceResult.ContractName}.sol`] = sourceCode;
  }

  return result;
}

// Response types

type EtherscanVerifiedContract = {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string;
  CompilerType: string;
  OptimizationUsed: string;
  Runs: string;
  ConstructorArguments: string;
  EVMVersion: string;
  Library: string;
  ContractFileName: string;
  LicenseType: string;
  Proxy: string;
  Implementation: string;
  SwarmSource: string;
  SimilarMatch: string;
};

type EtherscanSourceSet = {
  language: "Solidity";
  sources: { [key: string]: { content: string } };
  settings?: { remappings?: string[] };
};
