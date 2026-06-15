import { gray, green, red, yellow } from "jsr:@std/fmt/colors";
import { join } from "jsr:@std/path";
import { CliArguments, getArguments } from "./lib/cli.ts";
import { getNetworkData } from "./lib/networks.ts";
import { SourceProvider, SupportedChainId } from "./lib/types.ts";
import { fetchSources as fetchEtherscanSources } from "./lib/etherscan.ts";
import { fetchSources as fetchBlockscoutSources } from "./lib/blockscout.ts";
import { fetchSources as fetchSourcifySources } from "./lib/sourcify.ts";
import {
  diffEtherscanSources,
  diffWithLocalPath,
  printDiffResults,
} from "./lib/source.ts";
import { loadRemappings } from "./lib/foundry.ts";
import { cloneContract } from "./lib/clone.ts";
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
      await verifyContractsCmd(args);
      break;
    case "diff":
      await diffContractsCmd(args);
      break;
    case "clone":
      await cloneContractCmd(args);
      break;
    default:
      if (command) {
        console.error("Unrecognized command: use 'verify', 'diff', or 'clone'");
      }
      showHelp();
      Deno.exit(1);
  }
}

// Helpers

/**
 * Fetches contract sources, optionally resolving proxy to implementation.
 */
async function fetchContractSources(
  address: string,
  chainId: string,
  sourceProvider: SourceProvider,
  apiKey: string | undefined,
  followProxy: boolean,
) {
  const contractInfo = await fetchFromSourceProvider(
    address,
    chainId,
    sourceProvider,
    apiKey,
  );

  if (!followProxy) {
    return contractInfo;
  }

  if (!contractInfo.proxy?.implementation) {
    console.log(gray(`Note: ${address} is not a proxy, nothing to follow.\n`));
    return contractInfo;
  }

  console.log(
    gray(
      `Following proxy to implementation: ${contractInfo.proxy.implementation}\n`,
    ),
  );
  return await fetchFromSourceProvider(
    contractInfo.proxy.implementation,
    chainId,
    sourceProvider,
    apiKey,
  );
}

async function fetchFromSourceProvider(
  address: string,
  chainId: string,
  sourceProvider: SourceProvider,
  apiKey: string | undefined,
) {
  switch (sourceProvider) {
    case "explorer":
      return await fetchExplorerSources(address, chainId, apiKey);
    case "sourcify":
      return await fetchSourcifySources(address, chainId);
    case "auto":
      try {
        return await fetchExplorerSources(address, chainId, apiKey);
      } catch (error) {
        console.warn(
          yellow(
            `Explorer fetch failed for ${address}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
        console.warn(yellow("Trying Sourcify..."));
        return await fetchSourcifySources(address, chainId);
      }
  }
}

async function fetchExplorerSources(
  address: string,
  chainId: string,
  apiKey: string | undefined,
) {
  const networkData = getNetworkData(chainId as SupportedChainId);
  const fetcher = networkData.type === "etherscan"
    ? fetchEtherscanSources
    : fetchBlockscoutSources;

  return await fetcher(address, networkData, apiKey);
}

function getSourceProvider(args: CliArguments): SourceProvider {
  const sourceProvider = String(args.sourceProvider ?? "explorer");
  if (
    sourceProvider === "explorer" || sourceProvider === "sourcify" ||
    sourceProvider === "auto"
  ) {
    return sourceProvider;
  }

  throw new Error(
    "Invalid source provider: use 'explorer', 'sourcify', or 'auto'",
  );
}

// Handlers

async function verifyContractsCmd(args: CliArguments) {
  const contracts = args._.slice(1);
  let {
    chainId,
    apiKey,
    sourceRoot,
    remappings: remappingsFile,
    followProxy,
  } = args;

  if (!chainId) chainId = "1";
  if (!sourceRoot) sourceRoot = ".";
  const sourceProvider = getSourceProvider(args);
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
    const contractInfo = await fetchContractSources(
      address,
      chainId,
      sourceProvider,
      apiKey,
      !!followProxy,
    );

    if (Object.keys(contractInfo.sources).length === 0) {
      console.warn(yellow(`No source files were received for ${address}.`));
      continue;
    }

    const results = await diffWithLocalPath(
      contractInfo,
      sourceRoot,
      remappings,
    );
    printDiffResults(results);
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

async function diffContractsCmd(args: CliArguments) {
  if (args._.length !== 3) {
    throw new Error("Two contract addresses are required to perform a diff");
  }

  const [addressA, addressB] = args._.slice(1);
  let { chainId, apiKey, followProxy } = args;

  if (!chainId) chainId = "1";
  const sourceProvider = getSourceProvider(args);

  if (!addressA || !addressA.match(/^0x[0-9a-fA-F]{40}$/)) {
    throw new Error("Invalid address: " + addressA);
  } else if (!addressB || !addressB.match(/^0x[0-9a-fA-F]{40}$/)) {
    throw new Error("Invalid address: " + addressB);
  }

  const contractA = await fetchContractSources(
    addressA,
    chainId,
    sourceProvider,
    apiKey,
    !!followProxy,
  );
  const contractB = await fetchContractSources(
    addressB,
    chainId,
    sourceProvider,
    apiKey,
    !!followProxy,
  );

  if (Object.keys(contractA.sources).length === 0) {
    throw new Error(`No source files were received for ${contractA.address}.`);
  } else if (Object.keys(contractB.sources).length === 0) {
    throw new Error(`No source files were received for ${contractB.address}.`);
  }

  const results = diffEtherscanSources(contractA, contractB);
  printDiffResults(results);
  console.log();

  const hasIssues = results.some((item) => item.status !== "match");

  if (!hasIssues) {
    console.error(
      green(`The source code of the provided addresses match each other`),
    );
  } else {
    console.error(red("One or more source files differ"));
    Deno.exit(1);
  }
}

async function cloneContractCmd(args: CliArguments) {
  const address = args._[1];
  let { chainId, apiKey, output, followProxy } = args;

  if (!chainId) chainId = "1";
  const sourceProvider = getSourceProvider(args);
  if (!address || !address.match(/^0x[0-9a-fA-F]{40}$/)) {
    console.error("A valid contract address is required.");
    showHelp();
    Deno.exit(1);
  }

  const contractInfo = await fetchContractSources(
    address,
    chainId,
    sourceProvider,
    apiKey,
    !!followProxy,
  );

  if (Object.keys(contractInfo.sources).length === 0) {
    throw new Error(`No source files were received for ${address}.`);
  }

  // Default output directory to contract name
  if (!output) {
    output = `./${contractInfo.meta.contractName}`;
  }

  await cloneContract(contractInfo, output, { chainId });
}

// Global

function showHelp() {
  console.log(`Usage: mirror <command> [options] [contracts...]

Commands:
  verify     Fetch and compare verified contract source code
  diff       Show the diff between two on-chain contracts
  clone      Download verified contract source code and create a Foundry project

Options:
  -i, --chain-id       Chain ID of the network (default: 1)
  -k, --api-key        Etherscan API key
  -p, --source-provider  Source provider: explorer, sourcify, auto (default: explorer)
  -f, --follow-proxy   Resolve proxy contracts to their implementation

Verify options:
  -r, --source-root    Root path of the source code (default: \$PWD)
  -m, --remappings     Path to remappings.txt file (default: <source-root>/remappings.txt)

Clone options:
  -o, --output         Destination folder (default: ./<ContractName>)

Examples:
  mirror verify <address-1> <address-...>
  mirror verify <address-1> <address-...> --source-root ./src --chain-id 1 --api-key <your-key>
  mirror verify <address-1> --source-provider sourcify --chain-id 1
  mirror diff <address-A> <address-B>
  mirror diff <address-A> <address-B> --chain-id 10 --api-key <your-key>
  mirror clone <address>
  mirror clone <address> --output ./my-contract --follow-proxy --api-key <your-key>

Global flags:
  --version    Show version
  --help       Show this help`);
}

function showVersion() {
  console.log("Mirror", MIRROR_VERSION);
}

if (import.meta.main) {
  await main().catch((err) => {
    console.error(yellow("Error:"), err.message);
  });
}
