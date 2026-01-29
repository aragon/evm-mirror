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

  // Detect remappings from source paths
  const paths = Object.keys(sources);
  const remappings = detectRemappings(paths);

  // Transform paths and write source files
  const transformedSources: Record<string, string> = {};
  for (const [path, content] of Object.entries(sources)) {
    transformedSources[transformPath(path)] = content;
  }

  console.log(
    gray(`Writing ${Object.keys(transformedSources).length} source files...`),
  );
  await writeSourceFiles(transformedSources, outputDir);

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

  // Detect source root from contract file name
  const srcDir = detectSourceRoot(meta.contractFileName);

  // Generate foundry.toml
  const foundryConfig = generateFoundryConfig(
    meta,
    srcDir,
    contractInfo.address,
    networkData,
  );
  const foundryPath = join(outputDir, "foundry.toml");
  await writeFileWithCheck(foundryPath, foundryConfig);
  console.log(
    gray(
      `\nGenerated ${bold("foundry.toml")} (solc ${parseCompilerVersion(meta.compilerVersion)}, optimizer ${meta.runs} runs)`,
    ),
  );

  // Generate remappings.txt if needed
  if (remappings) {
    const remappingsContent =
      Object.entries(remappings)
        .map(([from, to]) => `${from}=${to}`)
        .join("\n") + "\n";
    const remappingsPath = join(outputDir, "remappings.txt");
    await writeFileWithCheck(remappingsPath, remappingsContent);
    console.log(
      gray(
        `Generated ${bold("remappings.txt")} (${Object.keys(remappings).length} ${Object.keys(remappings).length === 1 ? "entry" : "entries"})`,
      ),
    );
  }

  console.log(
    green(`\nClone complete. Run 'cd ${outputDir} && forge build' to compile.`),
  );
}

/**
 * Write all source files respecting overwrite rules
 */
async function writeSourceFiles(
  sources: Record<string, string>,
  outputDir: string,
): Promise<void> {
  for (const [path, content] of Object.entries(sources)) {
    const fullPath = join(outputDir, path);
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
 * Uses the transformed path logic to determine where files will end up.
 */
export function detectSourceRoot(contractFileName: string): string {
  if (!contractFileName) return "src";

  // Files starting with @ or node_modules/@ get transformed to lib/
  if (
    contractFileName.startsWith("@") ||
    contractFileName.startsWith("node_modules/@")
  ) {
    return "lib";
  }

  const parts = contractFileName.split("/");
  if (parts.length > 1) {
    const firstSegment = parts[0];
    // Common source directories
    if (["src", "contracts", "source", "packages"].includes(firstSegment)) {
      return firstSegment;
    }
  }
  return "src";
}

/**
 * Scan paths, detect @-prefixed imports, return remappings or null
 */
export function detectRemappings(
  paths: string[],
): Record<string, string> | null {
  const remappings: Record<string, string> = {};

  for (const path of paths) {
    let scope: string | null = null;

    if (path.startsWith("@")) {
      // "@openzeppelin/contracts/..." → "@openzeppelin"
      scope = path.split("/")[0];
    } else if (path.startsWith("node_modules/@")) {
      // "node_modules/@openzeppelin/contracts/..." → "@openzeppelin"
      scope = path.split("/")[1];
    }

    if (scope) {
      const remapKey = `${scope}/`;
      if (!remappings[remapKey]) {
        remappings[remapKey] = `lib/${scope}/`;
      }
    }
  }

  return Object.keys(remappings).length > 0 ? remappings : null;
}

/**
 * Transform paths:
 * - "@openzeppelin/..." → "lib/@openzeppelin/..."
 * - "node_modules/@openzeppelin/..." → "lib/@openzeppelin/..."
 */
export function transformPath(originalPath: string): string {
  if (originalPath.startsWith("@")) {
    return `lib/${originalPath}`;
  }
  if (originalPath.startsWith("node_modules/@")) {
    return `lib/${originalPath.slice("node_modules/".length)}`;
  }
  return originalPath;
}

/**
 * Generate foundry.toml content string
 */
export function generateFoundryConfig(
  meta: CompilerMeta,
  srcDir: string,
  address: string,
  networkData: Network,
): string {
  const solcVersion = parseCompilerVersion(meta.compilerVersion);

  const lines = [
    "# Auto-generated by evm-mirror clone",
    `# Address: ${address}`,
    `# Chain ID: ${networkData.chainId}`,
    `# Contract: ${meta.contractName}`,
    "",
    "[profile.default]",
    `src = "${srcDir}"`,
    'out = "out"',
    'libs = ["lib"]',
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
