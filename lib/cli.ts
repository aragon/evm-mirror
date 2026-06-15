import { parseArgs } from "jsr:@std/cli/parse-args";

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
      "source-provider",
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
      p: "sourceProvider",
      m: "remappings",
      v: "version",
      h: "help",
      o: "output",
      f: "followProxy",
      "source-root": "sourceRoot",
      "chain-id": "chainId",
      "api-key": "apiKey",
      "source-provider": "sourceProvider",
      "follow-proxy": "followProxy",
    },
  });
}
