import { bold, gray } from "jsr:@std/fmt/colors";
import { ContractSourcesWithMeta } from "./types.ts";

const SOURCIFY_SERVER_URL = "https://sourcify.dev/server";

/**
 * Fetches the verified source code of a contract from the Sourcify API.
 * @param contractAddress The address of the smart contract to verify.
 * @param chainId The ID of the target chain.
 * @returns The full details of the contract, if available.
 */
export async function fetchSources(
  contractAddress: string,
  chainId: string,
): Promise<ContractSourcesWithMeta> {
  console.log(gray(`Fetching sources for ${bold(contractAddress)}...`));

  const endpoint =
    `${SOURCIFY_SERVER_URL}/v2/contract/${chainId}/${contractAddress}?fields=all`;

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(
      `Sourcify API Error: ${response.status} ${await parseError(response)}`,
    );
  }
  const data = await response.json();

  return parseVerifiedSources(contractAddress, data);
}

export function parseVerifiedSources(
  contractAddress: string,
  apiResult: SourcifyContractResponse,
): ContractSourcesWithMeta {
  const rawSources = apiResult.sources ?? apiResult.stdJsonInput?.sources;
  if (!rawSources || Object.keys(rawSources).length === 0) {
    throw new Error("The contract is not verified or does not exist");
  }

  const sources: Record<string, string> = {};
  for (const [path, source] of Object.entries(rawSources)) {
    if (typeof source === "string") {
      sources[path] = source;
    } else if (typeof source.content === "string") {
      sources[path] = source.content;
    } else {
      throw new Error(`Unexpected Sourcify source format for ${path}`);
    }
  }

  const firstSourcePath = Object.keys(sources)[0];
  const compilation = apiResult.compilation;
  const settings = compilation?.compilerSettings ??
    apiResult.stdJsonInput?.settings ?? {};
  const fullyQualifiedName = parseFullyQualifiedName(
    compilation?.fullyQualifiedName,
  );
  const contractFileName = fullyQualifiedName.contractFileName ??
    firstSourcePath;
  const contractName = compilation?.name ?? fullyQualifiedName.contractName ??
    inferContractName(contractFileName);

  const result: ContractSourcesWithMeta = {
    address: contractAddress,
    sources,
    meta: {
      compilerVersion: compilation?.compilerVersion ?? "",
      optimizationUsed: settings.optimizer?.enabled === true,
      runs: parseOptimizerRuns(settings.optimizer?.runs),
      evmVersion: settings.evmVersion ?? "Default",
      contractFileName,
      contractName,
      remappings: settings.remappings ?? [],
    },
  };

  const implementation = getProxyImplementation(apiResult.proxyResolution);
  if (implementation) {
    result.proxy = { implementation };
  }

  return result;
}

async function parseError(response: Response): Promise<string> {
  const body = await response.text();
  if (!body.trim()) {
    return response.statusText;
  }

  try {
    const json = JSON.parse(body);
    return json.message ?? json.error ?? body;
  } catch {
    return body;
  }
}

function parseFullyQualifiedName(
  fullyQualifiedName?: string,
): { contractFileName?: string; contractName?: string } {
  if (!fullyQualifiedName) {
    return {};
  }

  const separator = fullyQualifiedName.lastIndexOf(":");
  if (separator <= 0 || separator === fullyQualifiedName.length - 1) {
    return {};
  }

  return {
    contractFileName: fullyQualifiedName.slice(0, separator),
    contractName: fullyQualifiedName.slice(separator + 1),
  };
}

function inferContractName(contractFileName: string): string {
  const fileName = contractFileName.split("/").pop() ?? contractFileName;
  const extension = fileName.lastIndexOf(".");
  return extension > 0 ? fileName.slice(0, extension) : fileName;
}

function parseOptimizerRuns(runs: number | string | undefined): number {
  if (typeof runs === "number" && Number.isFinite(runs)) {
    return runs;
  }

  if (typeof runs === "string") {
    const parsed = parseInt(runs, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 200;
}

function getProxyImplementation(
  proxyResolution?: SourcifyProxyResolution,
): string | undefined {
  const implementation = proxyResolution?.implementations?.[0];
  if (!implementation) {
    return undefined;
  }

  if (typeof implementation === "string") {
    return implementation;
  }

  return implementation.address ?? implementation.addressHash ??
    implementation.address_hash;
}

type SourcifyContractResponse = {
  sources?: Record<string, SourcifySource>;
  stdJsonInput?: {
    sources?: Record<string, SourcifySource>;
    settings?: SourcifyCompilerSettings;
  };
  compilation?: {
    language?: string;
    compiler?: string;
    compilerVersion?: string;
    compilerSettings?: SourcifyCompilerSettings;
    name?: string;
    fullyQualifiedName?: string;
  };
  proxyResolution?: SourcifyProxyResolution;
};

type SourcifySource = string | {
  content?: string;
};

type SourcifyCompilerSettings = {
  optimizer?: {
    enabled?: boolean;
    runs?: number | string;
  };
  evmVersion?: string;
  remappings?: string[];
};

type SourcifyProxyResolution = {
  implementations?: Array<
    string | {
      address?: string;
      addressHash?: string;
      address_hash?: string;
    }
  >;
};
