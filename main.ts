import { green, red, yellow } from "jsr:@std/fmt/colors";
import { join } from "jsr:@std/path";
import { CliArguments, getArguments } from "./lib/cli.ts";
import { fetchContractSource, parseSourceCode } from "./lib/etherscan.ts";
import { diffWithLocalPath, printResults } from "./lib/source.ts";
import { loadRemappings } from "./lib/foundry.ts";
import { MIRROR_VERSION } from "./lib/constants.ts";

/**
 * @title Smart contract diff toolkit
 * @description A CLI tool to compare verified smart contract codebases
 *
 * @usage
 *   mirror verify  --source-root /path/to/your/repo --chain-id 1 --api-key <YOUR_KEY> <address-1> <address-...>
 *   mirror diff    --chain-id 1 --api-key <YOUR_KEY> <address-1> <address-2>
 *
 * @flags (global)
 *   --version    Show version number
 *   --help       Show help
 */
async function main() {
  const args = getArguments();

  if (args.help) {
    return showHelp();
  } else if (args.version) {
    return showVersion();
  }

  const [command] = args._;
  switch (command) {
    case "verify":
      await verifyContracts(args);
      break;
    case "diff":
      await diffContracts(args);
      break;
    default:
      console.error("Unrecognized command: use 'verify' or 'diff'");
      showHelp();
      Deno.exit(1);
  }
}

// Handlers

async function verifyContracts(args: CliArguments) {
  const contracts = args._.slice(1);
  const { apiKey } = args;
  let { chainId, sourceRoot, remappings: remappingsFile } = args;

  if (!chainId) chainId = "1";
  if (!sourceRoot) sourceRoot = ".";
  if (!contracts?.length) {
    console.error("At least one contract address is required.");
    showHelp();
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

  let hasIssues = false;

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

    const results = await diffWithLocalPath(
      contractSources,
      sourceRoot,
      remappings,
    );
    printResults(results);
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
}

async function diffContracts(args: CliArguments) {
  console.log(yellow("The diff command is not implemented yet."));
}

// Global

function showHelp() {
  console.log(`Usage: mirror <command> [options] [contracts...]

Commands:
  verify   Fetch and compare contract source code from Etherscan
  diff     (Not implemented) Show differences between contracts

Options:
  -r, --source-root  Root path of the source code (default: current directory)
  -i, --chain-id     Chain ID of the network (default: 1)
  -k, --api-key      Etherscan API key
  -m, --remappings   Path to remappings.txt file (default: <source-root>/remappings.txt)

Examples:
  mirror verify --source-root ./src --chain-id 1 --api-key YOUR_KEY 0x... 0x...
  mirror verify 0x... --source-root ./src

Global flags:
  --version    Show version
  --help       Show this help`);
}

function showVersion() {
  console.log("Mirror", MIRROR_VERSION);
}

if (import.meta.main) {
  await main().catch((err) => {
    console.error(red("Error:"), err.message);
  });
}
