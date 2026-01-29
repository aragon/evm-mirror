# EVM Mirror

**EVM Mirror** is a CLI tool that checks whether the code of an EVM smart contract matches a known snapshot. It retrieves the verified sources from Etherscan (or compatible) and compares each file against a given reference.

- Verifying that the deployed code matches an exact Git commit or an audit.
- Comparing the code of two on-chain contracts.
- Cloning verified contracts into local Foundry projects.

Inspired by the great [DiffyScan](https://github.com/lidofinance/diffyscan) from [Lido](https://lido.fi/ethereum), EVM Mirror is tailored for **Foundry** projects, offering a streamlined, dependency-free experience.

## The Problem

Smart contract audits are performed against a specific Git commit hash, while contract sources are typically verified on explorers like Etherscan.

However, a critical verification gap remains: how do you ensure that a contract's verified code is *exactly* the same that that the auditors reviewed?

Comparing 50 source files for each address, on multiple networks and doing it by hand is tedious, time-consuming, and prone to error. EVM Mirror automates this process and provides an answer in seconds.

## Why EVM Mirror?

- **Foundry First**: Built for Foundry projects, it automatically handles `remappings.txt` to correctly resolve import paths. It can also work in other environments with the appropriate remappings.
- **Minimal Requirements**:
  - No Python, no Docker. No GitHub personal access tokens.
  - You just need a list of contract addresses and an Etherscan API key (for certain networks).
- **Modern and Flexible**:
  - Supports Etherscan's V2 multi-chain API, allowing a single API key to work across all supported networks.
  - Automatically detects the endpoint for the given Chain ID (Etherscan, Routescan).
  - Can be used as a standalone binary or as a Deno script within your existing TypeScript/JavaScript projects.
  - Can work against a local repo or another verified contract
- **Secure by default**
  - Deno's permission model prevents supply chain attacks from indirect NPM dependencies.
  - Minimal permissions enabled (network and read-only file access).
  - Minimal dependencies. EVM Mirror only uses packages from `@std/*` and `@libs/diff` from JSR.

## Get Started

### Using the Standalone Binary

1.  Download the latest release from the [Releases](https://github.com/aragon/evm-mirror/releases) page.
2.  Make the binary executable (on Linux/macOS:
    `chmod +x mirror`)
3.  Run the tool

#### Verify a contract against a local project

Running `mirror verify` shows the diff between the given address(es) and the source files on a local directory. By default it targets Ethereum Mainnet and the root path is the current directory. In certain networks, the API is not required.

```sh
mirror verify --api-key <ETHERSCAN_API_KEY> 0x1234... 0x2345...
```

#### Full verify example

This command verifies contracts on the Sepolia testnet against a specific local directory and `remappings.txt` file.

```sh
mirror verify \
  --api-key <ETHERSCAN_API_KEY> \
  --chain-id 11155111 \
  --source-root ../my-foundry-project \
  --remappings ../my-foundry-project/remappings.txt \
  0x1234... 0x2345...
```

#### Diff'ing two on-chain contracts

Running `mirror diff` shows the diff between two on-chain contracts verified on Etherscan. By default it targets Ethereum Mainnet and in certain networks, the API is not required.

```sh
mirror diff \
    --api-key <ETHERSCAN_API_KEY> \
    --chain-id 11155111 \
    0x1234... 0x2345...
```

#### Cloning a verified contract

Running `mirror clone` downloads the verified source code from the block explorer and creates a local Foundry project that you can work with.

```sh
mirror clone \
    --api-key <ETHERSCAN_API_KEY> \
    --output ./my-contract \
    0x1234...

cd ./my-contract
forge build
```

This will:
- Download all source files preserving their directory structure
- Generate a `foundry.toml` with the correct compiler settings
- Generate `remappings.txt` if needed (for `@openzeppelin/` style imports)

Paths like `@openzeppelin/...` or `node_modules/@openzeppelin/...` are automatically transformed to `lib/@openzeppelin/...` for Foundry compatibility.

### Options

| Flag | Alias | Description | Default |
| --- | --- | --- | --- |
| `--api-key` | `-k` | Your Etherscan API key. Required for most chains. | |
| `--chain-id` | `-i` | The chain ID of the target network. | `1` (Ethereum Mainnet) |
| `--source-root` | `-r` | The root path of the source code folder (verify only). | `.` (current directory) |
| `--remappings` | `-m` | Path to the `remappings.txt` file (verify only). | `remappings.txt` in the source root |
| `--output` | `-o` | Destination folder for cloned contract (clone only). | `./<ContractName>` |
| `--version` | | Show the version number. | |
| `--help` | | Show the help message. | |

### Using with Deno

If you have Deno installed, you can run EVM Mirror directly from the source code.

```sh
deno run --allow-net --allow-read main.ts verify \
  --api-key <ETHERSCAN_API_KEY> \
  --chain-id 11155111 \
  --source-root ../my-foundry-project \
  0x1234... 0x2345...
```

## Building from Source

You can compile the standalone binary from the source code using Deno.

1.  Clone the repository:
    `git clone https://github.com/aragon/evm-mirror.git`
2.  Navigate to the project directory:
    `cd evm-mirror`
3.  Compile the script:

```sh
# For Linux (x86_64)
deno task build:linux

# For macOS (Apple Silicon)
deno task build:macos

# For macOS (x86_64)
deno task build:macos:x86

# For Windows (x86_64)
deno task build:win
```

The compiled binary will be available in the project root.

## Contributing

Contributions are welcome! The easiest way to contribute is by expanding the list of supported networks.

To add a new Etherscan-compatible chain or improve EVM Mirror, feel free to open a pull request.
