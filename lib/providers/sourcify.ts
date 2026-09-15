import { gray, yellow } from "@std/fmt/colors";
import { ContractSourcesWithMeta } from "../types.ts";
import { Provider } from "./types.ts";

export const DEFAULT_SOURCIFY_URL = "https://sourcify.dev/server";

export type SourcifyConfig = {
  urlPrefix: string;
  chainId: string;
};

export function sourcifyProvider(config: SourcifyConfig): Provider {
  return {
    name: "sourcify",
    label: "sourcify",
    fetchSources: (address) => fetchSourcify(address, config),
  };
}

async function fetchSourcify(
  address: string,
  config: SourcifyConfig,
): Promise<ContractSourcesWithMeta> {
  const base = config.urlPrefix.replace(/\/$/, "");
  const endpoint =
    `${base}/v2/contract/${config.chainId}/${address}` +
    `?fields=sources,compilation,proxyResolution`;

  const response = await fetch(endpoint);
  if (response.status === 404) {
    throw new Error("Contract not found on Sourcify");
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data: SourcifyContractResponse = await response.json();
  if (!data.match) {
    throw new Error("Contract has no verified sources on Sourcify");
  }
  if (!data.sources || !data.compilation) {
    throw new Error("Sourcify response missing sources or compilation");
  }

  const parsed = parseVerifiedSources(address, data);

  // Log partial-match notice so the operator sees it (metadata region differs,
  // runtime bytecode is identical — safe for diff/verify/clone).
  if (data.match === "match") {
    console.log(gray("  (partial match — metadata hash differs)"));
  }

  // Sourcify couldn't run its proxy RPC (unavailable, timeout, etc). Surface
  // it: "proxy status unknown" is a distinct state from "confirmed not a
  // proxy", and silently treating them the same means --follow-proxy would
  // verify the wrapper without noticing.
  if (data.proxyResolution?.proxyResolutionError) {
    console.log(
      yellow(
        `  warning: Sourcify could not determine proxy status (${data.proxyResolution.proxyResolutionError})`,
      ),
    );
  }

  return parsed;
}

export function parseVerifiedSources(
  address: string,
  data: SourcifyContractResponse,
): ContractSourcesWithMeta {
  const sources: Record<string, string> = {};
  for (const [path, entry] of Object.entries(data.sources ?? {})) {
    if (entry?.content != null) sources[path] = entry.content;
  }

  const settings = data.compilation?.compilerSettings ?? {};
  const contractFileName =
    data.compilation?.fullyQualifiedName?.split(":")[0] ??
    Object.keys(sources)[0] ??
    "";

  const result: ContractSourcesWithMeta = {
    address,
    sources,
    meta: {
      compilerVersion: data.compilation?.compilerVersion ?? "",
      optimizationUsed: settings.optimizer?.enabled ?? false,
      runs: settings.optimizer?.runs ?? 200,
      evmVersion: settings.evmVersion ?? "",
      contractFileName,
      contractName: data.compilation?.name ?? "",
      remappings: settings.remappings ?? [],
    },
  };

  const impl = data.proxyResolution?.implementations?.[0]?.address;
  if (data.proxyResolution?.isProxy && impl) {
    result.proxy = { implementation: impl };
  }

  return result;
}

// Response types

export type SourcifyContractResponse = {
  match: "match" | "exact_match" | null;
  chainId: string;
  address: string;
  sources?: Record<string, { content?: string }>;
  compilation?: {
    language?: string;
    compiler?: string;
    compilerVersion?: string;
    compilerSettings?: {
      optimizer?: { enabled?: boolean; runs?: number };
      evmVersion?: string;
      remappings?: string[];
    };
    name?: string;
    fullyQualifiedName?: string;
  };
  proxyResolution?: {
    isProxy?: boolean;
    implementations?: Array<{ address: string }>;
    proxyType?: string;
    proxyResolutionError?: string;
  };
};
