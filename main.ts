import yargs from "npm:yargs";
import {
  green,
  red,
  yellow,
} from "https://deno.land/std@0.224.0/fmt/colors.ts";
import { join } from "https://deno.land/std@0.224.0/path/posix/mod.ts";
import { fetchContractSource, parseSourceCode } from "./lib/etherscan.ts";
import { compareSources, displayResults } from "./lib/source.ts";
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
 *   --chain-id <CHAIN_ID> \
 *   --api-key <ETHERSCAN_API_KEY> \
 *   --remappings /path/to/your/repo/remappings.txt \
 *   [contracts...]
 *
 * @flags
 * --source-root   (Required) The root path of the source code folder.
 * --chain-id      (Optional) The chain ID of the network.
 * --api-key       (Optional) Your Etherscan API key, required for most chains.
 * --remappings    (Optional) Path of the remappings.txt file (Foundry)
 *                 By default, it reads remappings.txt from the given local path
 */
async function main() {
  const argv = await yargs(Deno.args)
    .usage("Usage: $0 [options] [contracts...]")
    .option("source-root", {
      alias: "r",
      describe: "Root path of the source code",
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
    .command(
      "$0 <contracts...>",
      "The default command for processing contracts",
      (yargs: any) => {
        yargs.positional("contracts", {
          describe: "The list of addresses to verify",
          type: "string",
        });
      },
    )
    .version("Mirror version 0.1.0")
    .parse();

  try {
    let hasIssues = false;
    const { contracts, apiKey, chainId, sourceRoot } = argv as CliArguments;
    let { remappings: remappingsFile } = argv as CliArguments;

    for (const addr of contracts) {
      if (!addr || !addr.match(/^0x[0-9a-fA-F]{40}$/)) {
        throw new Error("Invalid address: " + addr);
      }
    }
    if (!remappingsFile?.trim()) {
      remappingsFile = join(sourceRoot, "remappings.txt");
    }
    const remappings = await loadRemappings(remappingsFile!);

    // Handle each contract
    for (const address of contracts) {
      const sourceResult = await fetchContractSource(
        address,
        chainId as any,
        apiKey,
      );

      const contractSources = parseSourceCode(sourceResult);
      if (contractSources.size === 0) {
        console.warn(yellow(`No source files were received for ${address}.`));
        continue;
      }

      const results = await compareSources(
        contractSources,
        sourceRoot,
        remappings,
      );
      displayResults(results);
      console.log();

      if (results.some((item) => item.status !== "match")) {
        hasIssues = true;
      }
    }

    if (!hasIssues) {
      console.error(
        green(
          `All contracts match the source code within the ${sourceRoot} directory`,
        ),
      );
    } else {
      console.error(red("One or more contracts could not be verified"));

      Deno.exit(1);
    }
  } catch (error: any) {
    console.error(red(`\nError: ${error.message}`));
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
