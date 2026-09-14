import { ContractSourcesWithMeta } from "../types.ts";

export type ProviderName = "etherscan" | "blockscout" | "sourcify";

export type Provider = {
  name: ProviderName;
  /** Human-readable label for fetch logs, e.g. "etherscan (api.etherscan.io)" */
  label: string;
  fetchSources(address: string): Promise<ContractSourcesWithMeta>;
};

export function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
