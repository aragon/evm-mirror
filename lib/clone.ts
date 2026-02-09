import { bold, gray, green, yellow } from "jsr:@std/fmt/colors";
import { join, dirname } from "jsr:@std/path";
import { ensureDir } from "jsr:@std/fs";
import { CompilerMeta, ContractSourcesWithMeta, Network } from "./types.ts";
import { DEFAULT_SOLC_VERSION } from "./constants.ts";

/**
 * Main entry point - orchestrates the clone operation
 */
export async function cloneContract(
  contractInfo: ContractSourcesWithMeta,
  outputDir: string,
  networkData: Network,
): Promise<void> {
  const { meta, sources } = contractInfo;

  console.log(
    gray(`Cloning ${bold(meta.contractName)} to ${bold(outputDir)}\n`),
  );

  const paths = Object.keys(sources);

  // Write source files preserving original paths
  console.log(gray(`Writing ${paths.length} source files...`));
  await writeSourceFiles(sources, outputDir);

  // Check for Vyper contracts
  if (meta.compilerVersion.toLowerCase().includes("vyper")) {
    console.log(
      yellow(
        "\nWarning: Vyper contract detected. Skipping foundry.toml generation.",
      ),
    );
    console.log(
      gray(`\nClone complete. Source files written to ${bold(outputDir)}`),
    );
    return;
  }

  // Check if any paths use node_modules (Hardhat-style)
  const hasNodeModules = paths.some((p) => p.startsWith("node_modules/"));

  // Detect source root from contract file name
  const srcDir = detectSourceRoot(meta.contractFileName);

  // Generate foundry.toml
  const foundryConfig = generateFoundryConfig(
    meta,
    srcDir,
    contractInfo.address,
    networkData,
    hasNodeModules,
  );
  const foundryPath = join(outputDir, "foundry.toml");
  await writeFileWithCheck(foundryPath, foundryConfig);
  console.log(
    gray(
      `\nGenerated ${bold("foundry.toml")} (solc ${parseCompilerVersion(meta.compilerVersion)}, optimizer ${meta.runs} runs)`,
    ),
  );

  // Generate remappings.txt - use metadata if available, otherwise detect from paths
  const remappings =
    meta.remappings.length > 0 ? meta.remappings : detectRemappingsFromPaths(paths);

  if (remappings.length > 0) {
    const remappingsContent = remappings.join("\n") + "\n";
    const remappingsPath = join(outputDir, "remappings.txt");
    await writeFileWithCheck(remappingsPath, remappingsContent);
    console.log(
      gray(
        `Generated ${bold("remappings.txt")} (${remappings.length} ${remappings.length === 1 ? "entry" : "entries"})`,
      ),
    );
  }

  console.log(
    green(`\nClone complete. Run 'cd ${outputDir} && forge build' to compile.`),
  );
}

/**
 * Transform bare @-prefixed paths to lib/:
 * - "@openzeppelin/..." → "lib/@openzeppelin/..."
 * - "node_modules/..." paths are kept as-is (Foundry uses libs = ["node_modules"])
 * - All other paths remain unchanged
 */
function transformPath(originalPath: string): string {
  if (originalPath.startsWith("@")) {
    return `lib/${originalPath}`;
  }
  return originalPath;
}

/**
 * Write all source files respecting overwrite rules
 */
async function writeSourceFiles(
  sources: Record<string, string>,
  outputDir: string,
): Promise<void> {
  for (const [path, content] of Object.entries(sources)) {
    const transformedPath = transformPath(path);
    const fullPath = join(outputDir, transformedPath);
    await writeFileWithCheck(fullPath, content, true);
  }
}

/**
 * Write a file with overwrite protection
 * - If file exists with same content → skip silently
 * - If file exists with different content → error and abort
 * - If file doesn't exist → create directories and write
 */
async function writeFileWithCheck(
  filePath: string,
  content: string,
  logOutput = false,
): Promise<void> {
  try {
    const existing = await Deno.readTextFile(filePath);
    if (existing === content) {
      if (logOutput) {
        console.log(gray(`  [SKIP]  ${filePath} (already exists)`));
      }
      return;
    }
    throw new Error(
      `File already exists with different content: ${filePath}\nAborting to prevent overwriting existing work.`,
    );
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  // File doesn't exist, create it
  await ensureDir(dirname(filePath));
  await Deno.writeTextFile(filePath, content);
  if (logOutput) {
    console.log(gray(`  [WRITE] ${filePath}`));
  }
}

/**
 * Detect src folder from ContractFileName (e.g., "src/Token.sol" → "src")
 * Handles:
 * - "src/Token.sol" → "src"
 * - "contracts/Token.sol" → "contracts"
 * - "@openzeppelin/contracts/proxy/Proxy.sol" → "lib" (bare @ paths go to lib/)
 * - "node_modules/@openzeppelin/contracts/proxy/Proxy.sol" → "node_modules"
 */
export function detectSourceRoot(contractFileName: string): string {
  if (!contractFileName) return ".";

  const parts = contractFileName.split("/");
  if (parts.length > 1) {
    const firstSegment = parts[0];

    // Bare @-prefixed paths are transformed to lib/
    if (firstSegment.startsWith("@")) {
      return "lib";
    }

    // node_modules paths stay as-is
    if (firstSegment === "node_modules") {
      return "node_modules";
    }

    // Common source directories
    if (["src", "contracts", "source", "packages"].includes(firstSegment)) {
      return firstSegment;
    }
  }
  return ".";
}


/**
 * Fallback: detect remappings from file paths when metadata is not available.
 * Used for contracts verified without remapping info (e.g., older Hardhat verifications).
 */
function detectRemappingsFromPaths(paths: string[]): string[] {
  const remappings = new Set<string>();

  for (const path of paths) {
    if (path.startsWith("@")) {
      // "@openzeppelin/contracts/..." → "@openzeppelin/=lib/@openzeppelin/"
      const scope = path.split("/")[0];
      remappings.add(`${scope}/=lib/${scope}/`);
    } else if (path.startsWith("node_modules/@")) {
      // "node_modules/@openzeppelin/contracts/..." → "@openzeppelin/=node_modules/@openzeppelin/"
      const scope = path.split("/")[1];
      remappings.add(`${scope}/=node_modules/${scope}/`);
    }
  }

  return Array.from(remappings);
}

/**
 * Generate foundry.toml content string
 */
export function generateFoundryConfig(
  meta: CompilerMeta,
  srcDir: string,
  address: string,
  networkData: Network,
  hasNodeModules = false,
): string {
  const solcVersion = parseCompilerVersion(meta.compilerVersion);

  const libsValue = hasNodeModules ? '["lib", "node_modules"]' : '["lib"]';

  const lines = [
    "# Auto-generated by evm-mirror clone",
    `# Address: ${address}`,
    `# Chain ID: ${networkData.chainId}`,
    `# Contract: ${meta.contractName}`,
    "",
    "[profile.default]",
    `src = "${srcDir}"`,
    'out = "out"',
    `libs = ${libsValue}`,
    `solc = "${solcVersion}"`,
  ];

  if (meta.optimizationUsed) {
    lines.push("optimizer = true");
    lines.push(`optimizer_runs = ${meta.runs}`);
  } else {
    lines.push("optimizer = false");
  }

  // Only add evm_version if it's not "Default"
  if (meta.evmVersion && meta.evmVersion.toLowerCase() !== "default") {
    lines.push(`evm_version = "${meta.evmVersion.toLowerCase()}"`);
  }

  return lines.join("\n") + "\n";
}

/**
 * Parse "v0.8.17+commit.abc123" → "0.8.17"
 */
export function parseCompilerVersion(raw: string): string {
  if (!raw) {
    console.log(
      yellow(
        `Warning: Unknown compiler version, using default ${DEFAULT_SOLC_VERSION}`,
      ),
    );
    return DEFAULT_SOLC_VERSION;
  }

  // Handle formats like "v0.8.17+commit.abc123" or "0.8.17+commit.abc123"
  const match = raw.match(/v?(\d+\.\d+\.\d+)/);
  if (match) {
    return match[1];
  }

  console.log(
    yellow(
      `Warning: Could not parse compiler version "${raw}", using default ${DEFAULT_SOLC_VERSION}`,
    ),
  );
  return DEFAULT_SOLC_VERSION;
}
