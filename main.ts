import yargs from "npm:yargs";
import { red, yellow } from "https://deno.land/std@0.224.0/fmt/colors.ts";
import { join } from "https://deno.land/std@0.224.0/path/posix/mod.ts";
import { fetchContractSource, parseSourceCode } from "./lib/etherscan.ts";
import { compareSources } from "./lib/source.ts";
import { loadRemappings } from "./lib/foundry.ts";
import { CliArguments } from "./lib/types.ts";

/**
 * @title Etherscan Contract Diff Tool
 * @description A Deno script to fetch a contract's verified source code from Etherscan
 * and compare it against a local project directory.
 *
 * @usage
 * deno run --allow-net --allow-read main.ts \
 *   --source-root /path/to/your/repo \
 *   --contract <CONTRACT_ADDRESS> \
 *   --chain-id <CHAIN_ID> \
 *   --api-key <ETHERSCAN_API_KEY> \
 *   --remappings /path/to/your/repo/remappings.txt
 *
 * @flags
 * --source-root   (Required) The root path of the source code folder.
 * --contract      (Required) The address of the smart contract to verify.
 * --chain-id      (Optional) The chain ID of the network.
 * --api-key       (Optional) Your Etherscan API key, required for most chains.
 * --remappings    (Optional) Path of the remappings.txt file (Foundry)
 *                 By default, it reads remappings.txt from the given local path
 */
async function main() {
  const argv = await yargs(Deno.args)
    .usage("Usage: $0 [options]")
    .option("source-root", {
      alias: "r",
      describe: "Root path of the source code",
      type: "string",
      demandOption: true,
    })
    .option("contract", {
      alias: "c",
      describe: "The address of the smart contract",
      type: "string",
      demandOption: true,
    })
    .option("chain-id", {
      alias: "i",
      describe: "Chain ID of the network",
      type: "string",
      default: "1",
    })
    .option("api-key", {
      alias: "k",
      describe: "Etherscan API Key",
      type: "string",
    })
    .option("remappings", {
      alias: "m",
      describe: "Optional path to the remappings.txt file",
      type: "string",
    })
    .version("Mirror version 0.1.0")
    .strict()
    .help().argv;

  try {
    const { contract, apiKey, chainId, sourceRoot } = argv as CliArguments;
    let { remappings: remappingsFile } = argv as CliArguments;

    if (!remappingsFile?.trim()) {
      remappingsFile = join(sourceRoot, "remappings.txt");
    }
    const remappings = await loadRemappings(remappingsFile!);

    const sourceResult = await fetchContractSource(
      contract,
      chainId as any,
      apiKey,
    );
    const sources = parseSourceCode(sourceResult);

    if (sources.size === 0) {
      console.error(yellow("No source files could be fetched from Etherscan."));
      return;
    }

    await compareSources(sources, sourceRoot, remappings);
  } catch (error: any) {
    console.error(red(`\nError: ${error.message}`));
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
