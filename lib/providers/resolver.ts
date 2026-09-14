import { gray, yellow } from "@std/fmt/colors";
import { ContractSourcesWithMeta, Network } from "../types.ts";
import { Provider, ProviderName } from "./types.ts";
import { etherscanProvider } from "./etherscan.ts";
import { blockscoutProvider } from "./blockscout.ts";
import { DEFAULT_SOURCIFY_URL, sourcifyProvider } from "./sourcify.ts";

/**
 * All the user-supplied context needed to instantiate providers. Coming from a
 * mix of CLI flags and environment variables — the caller merges those into
 * this shape before passing them here.
 */
export type ResolverOptions = {
  provider?: ProviderName;
  /** Only meaningful with `provider` set; overrides the URL for that provider. */
  apiUrl?: string;
  /** Generic key applied to whichever provider ends up being tried. */
  apiKey?: string;
  /** Etherscan-specific key. Wins over `apiKey` when Etherscan is selected. */
  etherscanApiKey?: string;
  /** Environment-level URL overrides. Presence signals "prefer this provider". */
  etherscanUrl?: string;
  blockscoutUrl?: string;
  sourcifyUrl?: string;
};

/**
 * Builds the ordered list of providers to try for a chain.
 *
 * Priority (most specific first):
 *   1. If --provider is pinned → return only that one (fail-hard mode).
 *   2. Providers with user-supplied URL overrides (env or flag).
 *   3. Providers listed in the chain map, in the order given.
 *   4. Sourcify tail (always appended when not already present).
 */
export function resolveProviders(
  network: Network,
  options: ResolverOptions,
): Provider[] {
  // Pinned mode — --api-url routes to the pinned provider's URL slot.
  if (options.provider) {
    const routed = routeApiUrl(options);
    const one = buildProvider(options.provider, network, routed);
    if (!one) {
      throw new Error(
        `Cannot use provider '${options.provider}' for chain ${network.chainId}: no URL configured. ` +
          `Pass --api-url or set the corresponding *_URL environment variable.`,
      );
    }
    return [one];
  }

  const list: Provider[] = [];
  const seenKinds = new Set<ProviderName>();
  const add = (kind: ProviderName) => {
    if (seenKinds.has(kind)) return;
    const p = buildProvider(kind, network, options);
    if (!p) return;
    seenKinds.add(kind);
    list.push(p);
  };

  // 1. User-overridden providers first — presence of a URL/key signals intent.
  if (options.blockscoutUrl) add("blockscout");
  if (options.etherscanUrl || options.etherscanApiKey) add("etherscan");
  if (options.sourcifyUrl) add("sourcify");

  // 2. Chain-mapped candidates, in the order the network declared them.
  for (const c of network.candidates) add(c.kind);

  // 3. Sourcify tail — always the last chance.
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

  switch (kind) {
    case "etherscan": {
      const chainCandidate = network.candidates.find(
        (c): c is Extract<typeof c, { kind: "etherscan" }> =>
          c.kind === "etherscan",
      );
      const urlPrefix = options.etherscanUrl ?? chainCandidate?.urlPrefix;
      if (!urlPrefix) return null;

      // If the URL came from the chain map, honor its key requirement.
      // If the user provided their own URL, assume they know what they're doing.
      const requiresApiKey = options.etherscanUrl
        ? false
        : chainCandidate?.requiresApiKey ?? false;

      return etherscanProvider({
        urlPrefix,
        chainId,
        apiKey: options.etherscanApiKey ?? options.apiKey,
        requiresApiKey,
      });
    }
    case "blockscout": {
      const chainCandidate = network.candidates.find(
        (c): c is Extract<typeof c, { kind: "blockscout" }> =>
          c.kind === "blockscout",
      );
      const urlPrefix = options.blockscoutUrl ?? chainCandidate?.urlPrefix;
      if (!urlPrefix) return null;

      return blockscoutProvider({
        urlPrefix,
        chainId,
        apiKey: options.apiKey,
      });
    }
    case "sourcify": {
      const urlPrefix = options.sourcifyUrl ?? DEFAULT_SOURCIFY_URL;
      return sourcifyProvider({ urlPrefix, chainId });
    }
  }
}

/**
 * In pinned mode, `--api-url` targets the pinned provider's URL slot. Route it
 * into the corresponding *_url field so buildProvider picks it up.
 */
function routeApiUrl(options: ResolverOptions): ResolverOptions {
  if (!options.apiUrl || !options.provider) return options;
  const routed: ResolverOptions = { ...options };
  switch (options.provider) {
    case "etherscan":
      routed.etherscanUrl = options.apiUrl;
      break;
    case "blockscout":
      routed.blockscoutUrl = options.apiUrl;
      break;
    case "sourcify":
      routed.sourcifyUrl = options.apiUrl;
      break;
  }
  return routed;
}
