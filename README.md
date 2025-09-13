# EVM Mirror

**EVM Mirror** is a CLI tool that verifies whether the source code of an EVM smart contract matches a given snapshot. It fetches the verified source code from Etherscan (or compatible) and compares each file against a local folder, ensuring that the deployed code matches an exact Git commit.

Inspired by the great [DiffyScan](https://github.com/lidofinance/diffyscan) from [Lido](https://lido.fi/ethereum), EVM Mirror is tailored for **Foundry** projects, offering a streamlined, dependency-free experience.

## The Problem

Smart contract audits are performed against a specific Git commit hash, and contract source code is typically verified on block explorers like Etherscan. But a critical verification gap remains: how can you check that the code verified on-chain is the *exact* same code that was audited?

Manually comparing dozens of files for multiple contracts and chains is tedious, time-consuming, and prone to error. EVM Mirror automates this process, providing a definitive answer in seconds.

## Why EVM Mirror?

- **Foundry First**: Built for Foundry projects, it automatically handles `remappings.txt` to correctly resolve import paths.
- **Minimal Requirements**: No Python, no Docker, and no GitHub personal access tokens. All you need is a list of contract addresses, your local Git repository, and an Etherscan API key for certain networks.
- **Modern and Flexible**:
  - Supports Etherscan's V2 multi-chain API, allowing a single API key to work across all supported networks.
  - Automatically detects the endpoint for the given Chain ID (Etherscan, Routescan).
  - Can be used as a standalone binary or as a Deno script within your existing TypeScript/JavaScript projects.

## Get Started

### Using the Standalone Binary

1.  Download the latest release for your operating system and architecture from the [Releases](https://github.com/aragon/evm-mirror/releases) page.
2.  Make the binary executable. For Linux/macOS:
    `chmod +x mirror`
3.  Run the tool

**Basic Example**

This command checks the provided contract addresses against the source code within the current directory on Ethereum Mainnet.

```sh
./mirror --api-key <YOUR_ETHERSCAN_API_KEY> 0x1234... 0x2345...
```

**Full Example**

This command checks contracts on the Sepolia testnet against a specified source directory and `remappings.txt` file.

```sh
./mirror \
  --api-key <YOUR_ETHERSCAN_API_KEY> \
  --source-root ../my-foundry-project \
  --remappings ../my-foundry-project/remappings.txt \
  --chain-id 11155111 \
  0x1234... 0x2345...
```

### Using Deno

If you have Deno installed, you can run EVM Mirror directly from the source code.

```sh
deno run --allow-net --allow-read main.ts \
  --api-key <YOUR_ETHERSCAN_API_KEY> \
  --source-root ../my-foundry-project \
  --chain-id 11155111 \
  0x1234... 0x2345...
```

### Options

| Flag | Alias | Description | Default |
| --- | --- | --- | --- |
| `--source-root` | `-r` | The root path of the source code folder. | `.` (current directory) |
| `--chain-id` | `-i` | The chain ID of the target network. | `1` (Ethereum Mainnet) |
| `--api-key` | `-k` | Your Etherscan API key. Required for most chains. | `     ` |
| `--remappings` | `-m` | Path to the `remappings.txt` file. | `remappings.txt` in the source root |
| `--version` | | Show the version number. | |
| `--help` | | Show the help message. | |

## Building from Source

You can compile the standalone binary from the source code using Deno.

1.  Clone the repository:
    `git clone https://github.com/aragon/evm-mirror.git`
2.  Navigate to the project directory:
    `cd evm-mirror`
3.  Compile the script:

```sh
# For Linux (x86_64)
deno compile --allow-net --allow-read --target x86_64-unknown-linux-gnu -o mirror main.ts

# For macOS (Apple Silicon)
deno compile --allow-net --allow-read --target aarch64-apple-darwin -o mirror main.ts

# For macOS (x86_64)
deno compile --allow-net --allow-read --target x86_64-apple-darwin -o mirror main.ts

# For Windows (x86_64)
deno compile --allow-net --allow-read --target x86_64-pc-windows-msvc -o mirror.exe main.ts
```

The compiled binary will be available in the project root.

## Contributing

Contributions are welcome! The easiest way to contribute is by expanding the list of supported networks.

To add a new Etherscan-compatible chain, please open a pull request that adds the network's details to the `chains.ts` configuration file. Ensure you include the chain ID and the API base URL.
