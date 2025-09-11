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
 *   --contract <CONTRACT_ADDRESS> \
 *   --api-key <ETHERSCAN_API_KEY> \
 *   --source-root /path/to/your/repo \
 *   --remappings /path/to/your/repo/remappings.txt
 *
 * @flags
 * --contract      (Required) The address of the smart contract to verify.
 * --api-key       (Required) Your Etherscan API key.
 * --source-root   (Required) The root path of the source code folder.
 * --remappings    (Optional) Path of the remappings.txt file (Foundry)
 *                 By default, it reads remappings.txt from the given local path
 */
async function main() {
  const argv = await yargs(Deno.args)
    .usage("Usage: $0 [options]")
    .option("contract", {
      alias: "c",
      describe: "The address of the smart contract",
      type: "string",
      demandOption: true,
    })
    .option("api-key", {
      alias: "k",
      describe: "Etherscan API Key",
      type: "string",
      demandOption: true,
    })
    .option("source-root", {
      alias: "r",
      describe: "Root path of the source code",
      type: "string",
      demandOption: true,
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
    const { contract, apiKey, sourceRoot } = argv as CliArguments;
    let { remappings: remappingsFile } = argv as CliArguments;

    if (!remappingsFile?.trim())
      remappingsFile = join(sourceRoot, "remappings.txt");
    const remappings = await loadRemappings(remappingsFile!);

    const sourceResult = await fetchContractSource(contract, apiKey);
    const sources = parseSourceCode(sourceResult);

    if (sources.size === 0) {
      console.error(yellow("No source files could be fetched from Etherscan."));
      return;
    }

    await compareSources(sources, sourceRoot, remappings);
  } catch (error: any) {
    console.error(red(`\nAn error occurred: ${error.message}`));
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
