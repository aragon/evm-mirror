import { parseArgs } from "@std/cli/parse-args";
import { ProviderName } from "./providers/types.ts";
import { ResolverOptions } from "./providers/resolver.ts";

export type CliArguments = ReturnType<typeof getArguments>;

export function getArguments() {
  return parseArgs(Deno.args, {
    string: [
      "_",
      "chain-id",
      "i",
      "source-root",
      "r",
      "api-key",
      "k",
      "etherscan-api-key",
      "api-url",
      "provider",
      "p",
      "remappings",
      "m",
      "output",
      "o",
    ],
    boolean: ["h", "v", "follow-proxy", "f"],
    alias: {
      r: "sourceRoot",
      i: "chainId",
      k: "apiKey",
      m: "remappings",
      v: "version",
      h: "help",
      o: "output",
      f: "followProxy",
      p: "provider",
      "source-root": "sourceRoot",
      "chain-id": "chainId",
      "api-key": "apiKey",
      "etherscan-api-key": "etherscanApiKey",
      "api-url": "apiUrl",
      "follow-proxy": "followProxy",
    },
  });
}

/**
 * Merges CLI flags with environment variables into the resolver options.
 * Env vars fill slots the operator didn't override on the command line.
 */
export function buildResolverOptions(args: CliArguments): ResolverOptions {
  const env = Deno.env;
  const provider = args.provider
    ? assertProviderName(args.provider)
    : undefined;

  return {
    provider,
    apiUrl: args.apiUrl?.trim() || undefined,
    apiKey: args.apiKey?.trim() || undefined,
    etherscanApiKey:
      args.etherscanApiKey?.trim() ||
      env.get("ETHERSCAN_API_KEY")?.trim() ||
      undefined,
    etherscanUrl: env.get("ETHERSCAN_URL")?.trim() || undefined,
    blockscoutUrl: env.get("BLOCKSCOUT_URL")?.trim() || undefined,
    sourcifyUrl: env.get("SOURCIFY_URL")?.trim() || undefined,
  };
}

function assertProviderName(name: string): ProviderName {
  switch (name) {
    case "etherscan":
    case "blockscout":
    case "sourcify":
      return name;
    default:
      throw new Error(
        `Unknown provider: '${name}'. Use one of: etherscan, blockscout, sourcify.`,
      );
  }
}
