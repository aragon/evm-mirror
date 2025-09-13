import { parseArgs } from "jsr:@std/cli/parse-args";
import { green, red, yellow } from "jsr:@std/fmt/colors";
import { join } from "jsr:@std/path";
import { fetchContractSource, parseSourceCode } from "./lib/etherscan.ts";
import { compareSources, displayResults } from "./lib/source.ts";
import { loadRemappings } from "./lib/foundry.ts";
import { CliArguments } from "./lib/types.ts";
import { MIRROR_VERSION } from "./lib/constants.ts";

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
  const args = parseArgs(Deno.args, {
    string: ["_"],
    alias: {
      r: "sourceRoot",
      i: "chainId",
      k: "apiKey",
      m: "remappings",
      "source-root": "sourceRoot",
      "chain-id": "chainId",
      "api-key": "apiKey",
    },
  }) as any as CliArguments;

  if (args.help) {
    return showHelp();
  } else if (args.version) {
    return showVersion();
  }

  try {
    let hasIssues = false;

    const { _: contracts, apiKey } = args;
    let { chainId, sourceRoot, remappings: remappingsFile } = args;

    if (!chainId) chainId = "1";
    if (!sourceRoot) sourceRoot = ".";

    if (!contracts?.length) {
      showHelp();
      console.log();
      console.log("At least one contract address is required");
      Deno.exit(1);
    }

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
          `All the fetched contracts match the source code within the ${sourceRoot} directory`,
        ),
      );
    } else {
      console.error(red("One or more contracts could not be verified"));

      Deno.exit(1);
    }
  } catch (error: any) {
    console.error(red(`Error: ${error.message}`));
    Deno.exit(1);
  }
}

function showHelp() {
  console.log(`Usage: mirror [options] [contracts...]

  List:
    contracts  The list of addresses to verify

  Options:
    -r, --source-root  Root path of the source code  (default: current directory)
    -i, --chain-id     Chain ID of the network  (default: 1)
    -k, --api-key      API Key (Etherscan)
    -m, --remappings   Use a specific remappings.txt file
        --version      Show version number
        --help         Show help`);
}

function showVersion() {
  console.log("Mirror", MIRROR_VERSION);
}

if (import.meta.main) {
  await main();
}
