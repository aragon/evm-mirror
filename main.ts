import { gray, green, red, yellow } from "jsr:@std/fmt/colors";
import { join } from "jsr:@std/path";
import { CliArguments, getArguments } from "./lib/cli.ts";
import { getNetworkData } from "./lib/networks.ts";
import { Network } from "./lib/types.ts";
import { fetchSources as fetchEtherscanSources } from "./lib/etherscan.ts";
import { fetchSources as fetchBlockscoutSources } from "./lib/blockscout.ts";
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
  networkData: Network,
  apiKey: string | undefined,
  followProxy: boolean,
) {
  const fetcher =
    networkData.type === "etherscan"
      ? fetchEtherscanSources
      : fetchBlockscoutSources;

  const contractInfo = await fetcher(address, networkData, apiKey);

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
  return await fetcher(contractInfo.proxy.implementation, networkData, apiKey);
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
  if (!contracts?.length) {
    console.error("At least one contract address is required.");
    showHelp();
    Deno.exit(1);
  }

  const networkData = getNetworkData(chainId as any);
  if (!networkData) {
    throw new Error("Unsupported chain ID: " + chainId);
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
      networkData,
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

  if (!addressA || !addressA.match(/^0x[0-9a-fA-F]{40}$/)) {
    throw new Error("Invalid address: " + addressA);
  } else if (!addressB || !addressB.match(/^0x[0-9a-fA-F]{40}$/)) {
    throw new Error("Invalid address: " + addressB);
  }

  const networkData = getNetworkData(chainId as any);
  if (!networkData) {
    throw new Error("Unsupported chain ID: " + chainId);
  }

  const contractA = await fetchContractSources(
    addressA,
    networkData,
    apiKey,
    !!followProxy,
  );
  const contractB = await fetchContractSources(
    addressB,
    networkData,
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
  if (!address || !address.match(/^0x[0-9a-fA-F]{40}$/)) {
    console.error("A valid contract address is required.");
    showHelp();
    Deno.exit(1);
  }

  const networkData = getNetworkData(chainId as any);
  if (!networkData) {
    throw new Error("Unsupported chain ID: " + chainId);
  }

  const contractInfo = await fetchContractSources(
    address,
    networkData,
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

  await cloneContract(contractInfo, output, networkData);
}

// Global

function showHelp() {
  console.log(`Usage: mirror <command> [options] [contracts...]

Commands:
  verify     Fetch and compare contract source code from Etherscan
  diff       Show the diff between two on-chain contracts
  clone      Download verified contract source code and create a Foundry project

Options:
  -i, --chain-id       Chain ID of the network (default: 1)
  -k, --api-key        Etherscan API key
  -f, --follow-proxy   Resolve proxy contracts to their implementation

Verify options:
  -r, --source-root    Root path of the source code (default: \$PWD)
  -m, --remappings     Path to remappings.txt file (default: <source-root>/remappings.txt)

Clone options:
  -o, --output         Destination folder (default: ./<ContractName>)

Examples:
  mirror verify <address-1> <address-...>
  mirror verify <address-1> <address-...> --source-root ./src --chain-id 1 --api-key <your-key>
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
