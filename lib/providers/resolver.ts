import { gray, yellow } from "@std/fmt/colors";
import { ContractSourcesWithMeta, Network } from "../types.ts";
import { Provider, ProviderName } from "./types.ts";
import { etherscanProvider } from "./etherscan.ts";
import { blockscoutProvider } from "./blockscout.ts";
import { DEFAULT_SOURCIFY_URL, sourcifyProvider } from "./sourcify.ts";

/**
 * All the user-supplied context needed to instantiate providers.
 */
export type ResolverOptions = {
  provider?: ProviderName;
  /** Only meaningful with `provider` set; overrides the URL for that provider. */
  apiUrl?: string;
  /**
   * The Etherscan API key. Populated from `--api-key` / `-k` or the
   * `ETHERSCAN_API_KEY` env var. Etherscan-only — never crosses providers.
   */
  etherscanApiKey?: string;
};

/**
 * Builds the ordered list of providers to try for a chain.
 *
 *   - If `--provider` is pinned → return only that one (fail-hard mode).
 *   - Otherwise → chain-mapped providers in order, then Sourcify as the tail.
 */
export function resolveProviders(
  network: Network,
  options: ResolverOptions,
): Provider[] {
  if (options.provider) {
    const one = buildProvider(options.provider, network, options);
    if (!one) {
      throw new Error(
        `Cannot use provider '${options.provider}' for chain ${network.chainId}: no URL configured. ` +
          `Pass --api-url.`,
      );
    }
    return [one];
  }

  const list: Provider[] = [];
  const seen = new Set<ProviderName>();
  const add = (kind: ProviderName) => {
    if (seen.has(kind)) return;
    const p = buildProvider(kind, network, options);
    if (!p) return;
    seen.add(kind);
    list.push(p);
  };

  for (const c of network.candidates) add(c.kind);
  add("sourcify");

  return list;
}

/**
 * Tries each provider in order. On failure, logs the reason and moves on.
 * Returns the first successful result; throws if every provider fails.
 */
export async function fetchWithFallback(
  providers: Provider[],
  address: string,
): Promise<ContractSourcesWithMeta> {
  if (!providers.length) {
    throw new Error("No providers available for this chain");
  }

  const errors: string[] = [];
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    const prefix = i === 0 ? "Fetching sources for" : "  Trying";
    console.log(gray(`${prefix} ${address} via ${p.label}...`));

    try {
      return await p.fetchSources(address);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(yellow(`  ${p.name} failed: ${msg}`));
      errors.push(`${p.label}: ${msg}`);
    }
  }

  throw new Error(
    `All providers failed for ${address}:\n  - ${errors.join("\n  - ")}`,
  );
}

// Helpers

function buildProvider(
  kind: ProviderName,
  network: Network,
  options: ResolverOptions,
): Provider | null {
  const chainId = network.chainId;
  // `--api-url` only applies to the pinned provider. In non-pinned mode
  // `options.provider` is undefined, so this is always undefined and every
  // provider uses its chain-map URL.
  const pinnedUrl = options.provider === kind ? options.apiUrl : undefined;

  switch (kind) {
    case "etherscan": {
      const chainCandidate = network.candidates.find(
        (c): c is Extract<typeof c, { kind: "etherscan" }> =>
          c.kind === "etherscan",
      );
      const urlPrefix = pinnedUrl ?? chainCandidate?.urlPrefix;
      if (!urlPrefix) return null;

      // Trust the operator's own URL; only enforce key requirement when
      // we're using the chain-map URL that we know needs one.
      const requiresApiKey = pinnedUrl
        ? false
        : chainCandidate?.requiresApiKey ?? false;

      return etherscanProvider({
        urlPrefix,
        chainId,
        apiKey: options.etherscanApiKey,
        requiresApiKey,
      });
    }
    case "blockscout": {
      const chainCandidate = network.candidates.find(
        (c): c is Extract<typeof c, { kind: "blockscout" }> =>
          c.kind === "blockscout",
      );
      const urlPrefix = pinnedUrl ?? chainCandidate?.urlPrefix;
      if (!urlPrefix) return null;

      return blockscoutProvider({ urlPrefix, chainId });
    }
    case "sourcify": {
      const urlPrefix = pinnedUrl ?? DEFAULT_SOURCIFY_URL;
      return sourcifyProvider({ urlPrefix, chainId });
    }
  }
}
