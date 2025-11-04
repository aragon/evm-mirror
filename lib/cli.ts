import { parseArgs } from "jsr:@std/cli/parse-args";

export type CliArguments = ReturnType<typeof getArguments>;

export function getArguments() {
  return parseArgs(Deno.args, {
    string: ["_", "chain-id", "source-root", "api-key", "remappings"],
    boolean: ["h", "v"],
    alias: {
      r: "sourceRoot",
      i: "chainId",
      k: "apiKey",
      m: "remappings",
      v: "version",
      h: "help",
      "source-root": "sourceRoot",
      "chain-id": "chainId",
      "api-key": "apiKey",
    },
  });
}
