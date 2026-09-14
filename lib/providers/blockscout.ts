import { ContractSourcesWithMeta } from "../types.ts";
import { Provider, safeHost } from "./types.ts";

export type BlockscoutConfig = {
  urlPrefix: string;
  chainId: string;
  apiKey?: string;
};

export function blockscoutProvider(config: BlockscoutConfig): Provider {
  return {
    name: "blockscout",
    label: `blockscout (${safeHost(config.urlPrefix)})`,
    fetchSources: (address) => fetchBlockscout(address, config),
  };
}

async function fetchBlockscout(
  address: string,
  config: BlockscoutConfig,
): Promise<ContractSourcesWithMeta> {
  const base = config.urlPrefix.replace(/\/$/, "");
  const endpoint = `${base}/v2/smart-contracts/${address}`;
  const headers: Record<string, string> = {};
  if (config.apiKey) headers["api-key"] = config.apiKey;

  const response = await fetch(endpoint, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();

  return parseVerifiedSources(address, data);
}

export function parseVerifiedSources(
  address: string,
  apiResult: BlockscoutContractResponse,
): ContractSourcesWithMeta {
  if (!apiResult.source_code || !apiResult.abi?.length) {
    throw new Error("Contract is not verified");
  }

  const result: ContractSourcesWithMeta = {
    address,
    sources: {
      [apiResult.file_path]: apiResult.source_code,
    },
    meta: {
      compilerVersion: apiResult.compiler_version,
      optimizationUsed: apiResult.optimization_enabled,
      runs: apiResult.optimization_runs,
      evmVersion: apiResult.evm_version,
      contractFileName: apiResult.file_path,
      contractName: apiResult.name,
      remappings: apiResult.compiler_settings?.remappings || [],
    },
  };

  if (apiResult.implementations?.length) {
    result.proxy = { implementation: apiResult.implementations[0].address };
  }

  for (const dependency of apiResult.additional_sources ?? []) {
    result.sources[dependency.file_path] = dependency.source_code;
  }

  return result;
}

// Response types

type BlockscoutContractResponse = {
  file_path: string;
  source_code: string;
  additional_sources?: Array<{ file_path: string; source_code: string }>;
  abi?: Array<unknown>;
  optimization_enabled: boolean;
  optimization_runs: number;
  compiler_version: string;
  compiler_settings?: { remappings?: string[] };
  implementations?: Array<{ address: string; name?: string }>;
  proxy_type?: string;
  name: string;
  evm_version: string;
  is_verified?: boolean;
  is_partially_verified?: boolean;
};
