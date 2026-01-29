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
      "source-root": "sourceRoot",
      "chain-id": "chainId",
      "api-key": "apiKey",
      "follow-proxy": "followProxy",
    },
  });
}
