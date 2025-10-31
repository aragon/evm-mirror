import { SUPPORTED_CHAIN_IDS } from "./constants.ts";

export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export type ContractSources = {
  address: string;
  sources: { [k: string]: string };
};

export type Remappings = Record<string, string>;

export type Network = {
  urlPrefix: string;
  requiresApiKey: boolean;
};
