import { gray, green, red, yellow } from "@std/fmt/colors";
import { join } from "@std/path";
import {
  buildResolverOptions,
  CliArguments,
  getArguments,
} from "./lib/cli.ts";
import { getNetworkData } from "./lib/networks.ts";
import { ContractSourcesWithMeta } from "./lib/types.ts";
import { Provider } from "./lib/providers/types.ts";
import {
  fetchWithFallback,
  resolveProviders,
} from "./lib/providers/resolver.ts";
import {
  diffContractSources,
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
 *   mirror clone   --chain-id 1 --api-key <YOUR_KEY> <address>
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
 * Fetches contract sources through the provider fallback chain,
 * optionally resolving proxy to implementation.
 */
async function fetchContractSources(
  address: string,
  providers: Provider[],
  followProxy: boolean,
): Promise<ContractSourcesWithMeta> {
  const contractInfo = await fetchWithFallback(providers, address);

  if (!followProxy) return contractInfo;
  if (!contractInfo.proxy?.implementation) {
    console.log(gray(`Note: ${address} is not a proxy, nothing to follow.\n`));
    return contractInfo;
  }

  console.log(
    gray(
      `Following proxy to implementation: ${contractInfo.proxy.implementation}\n`,
    ),
  );
  return await fetchWithFallback(providers, contractInfo.proxy.implementation);
}

function assertAddress(address: string | undefined): asserts address is string {
  if (!address || !address.match(/^0x[0-9a-fA-F]{40}$/)) {
    throw new Error("Invalid address: " + address);
  }
}

// Handlers

async function verifyContractsCmd(args: CliArguments) {
  const contracts = args._.slice(1);
  let {
    chainId,
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
  for (const addr of contracts) assertAddress(addr);

  const network = getNetworkData(chainId);
  const providers = resolveProviders(network, buildResolverOptions(args));

  if (!remappingsFile?.trim()) {
    remappingsFile = join(sourceRoot, "remappings.txt");
  }
  const remappings = await loadRemappings(remappingsFile!);

  let hasIssues = false;

  for (const address of contracts) {
    const contractInfo = await fetchContractSources(
      address,
      providers,
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
    console.error(red("One or more contracts differ or have issues"));
    Deno.exit(1);
  }
}

async function diffContractsCmd(args: CliArguments) {
  if (args._.length !== 3) {
    throw new Error("Two contract addresses are required to perform a diff");
  }

  const [addressA, addressB] = args._.slice(1);
  let { chainId, followProxy } = args;

  if (!chainId) chainId = "1";
  assertAddress(addressA);
  assertAddress(addressB);

  const network = getNetworkData(chainId);
  const providers = resolveProviders(network, buildResolverOptions(args));

  const contractA = await fetchContractSources(
    addressA,
    providers,
    !!followProxy,
  );
  const contractB = await fetchContractSources(
    addressB,
    providers,
    !!followProxy,
  );

  if (Object.keys(contractA.sources).length === 0) {
    throw new Error(`No source files were received for ${contractA.address}.`);
  } else if (Object.keys(contractB.sources).length === 0) {
    throw new Error(`No source files were received for ${contractB.address}.`);
  }

  const results = diffContractSources(contractA, contractB);
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
  let { chainId, output, followProxy } = args;

  if (!chainId) chainId = "1";
  if (!address || !address.match(/^0x[0-9a-fA-F]{40}$/)) {
    console.error("A valid contract address is required.");
    showHelp();
    Deno.exit(1);
  }

  const network = getNetworkData(chainId);
  const providers = resolveProviders(network, buildResolverOptions(args));

  const contractInfo = await fetchContractSources(
    address,
    providers,
    !!followProxy,
  );

  if (Object.keys(contractInfo.sources).length === 0) {
    throw new Error(`No source files were received for ${address}.`);
  }

  // Default output directory to contract name
  if (!output) {
    output = `./${contractInfo.meta.contractName}`;
  }

  await cloneContract(contractInfo, output, network);
}

// Global

function showHelp() {
  console.log(`Usage: mirror <command> [options] [contracts...]

Commands:
  verify     Fetch and compare contract source code against a local project
  diff       Show the diff between two on-chain contracts
  clone      Download verified sources and create a Foundry project

Global options:
  -i, --chain-id            Chain ID of the network (default: 1)
  -k, --api-key             API key applied to the resolved provider
      --etherscan-api-key   Etherscan-specific key (wins over --api-key for Etherscan)
  -p, --provider            Force one of: etherscan, blockscout, sourcify (disables fallback)
      --api-url             Endpoint override (requires --provider)
  -f, --follow-proxy        Resolve proxy contracts to their implementation

Verify options:
  -r, --source-root         Root path of the source code (default: \$PWD)
  -m, --remappings          Path to remappings.txt file (default: <source-root>/remappings.txt)

Clone options:
  -o, --output              Destination folder (default: ./<ContractName>)

Environment variables:
  ETHERSCAN_API_KEY         Same as --etherscan-api-key
  ETHERSCAN_URL             Override the Etherscan-compatible base URL
  BLOCKSCOUT_URL            Supply / override the Blockscout base URL
  SOURCIFY_URL              Override the Sourcify base URL

Provider selection:
  Chain ID drives the default. Known chains map to Etherscan or Blockscout.
  If those fail (or the chain is unknown), Sourcify is tried as a fallback.
  Pass --provider to pin one and skip the fallback chain.

Examples:
  mirror verify <address-1> <address-...>
  mirror verify <address-1> <address-...> --source-root ./src --chain-id 1 --api-key <your-key>
  mirror verify --provider sourcify --chain-id 143 <address>
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
    Deno.exit(1);
  });
}
