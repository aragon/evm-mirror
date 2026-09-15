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
      "api-url": "apiUrl",
      "follow-proxy": "followProxy",
    },
  });
}

/**
 * Merges CLI flags with environment variables into the resolver options.
 * The one API key (`--api-key` or `ETHERSCAN_API_KEY`) is Etherscan-only,
 * never sent to Blockscout or Sourcify.
 */
export function buildResolverOptions(args: CliArguments): ResolverOptions {
  const env = Deno.env;
  const provider = args.provider
    ? assertProviderName(args.provider)
    : undefined;
  const apiUrl = args.apiUrl?.trim() || undefined;

  // --api-url needs --provider to say which provider it targets. Silently
  // ignoring it would run the command against the chain default instead.
  if (apiUrl && !provider) {
    throw new Error(
      "--api-url requires --provider (etherscan|blockscout|sourcify) to say which provider it targets.",
    );
  }

  return {
    provider,
    apiUrl,
    etherscanApiKey: args.apiKey?.trim() ||
      env.get("ETHERSCAN_API_KEY")?.trim() ||
      undefined,
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
