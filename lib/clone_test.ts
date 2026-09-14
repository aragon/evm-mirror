import { assertEquals } from "@std/assert";
import { DEFAULT_SOLC_VERSION } from "./constants.ts";
import {
  detectRemappingsFromPaths,
  detectSourceRoot,
  generateFoundryConfig,
  parseCompilerVersion,
} from "./clone.ts";
import { CompilerMeta, Network } from "./types.ts";

// parseCompilerVersion --------------------------------------------------------

Deno.test("parseCompilerVersion: 'v0.8.17+commit.abc' → '0.8.17'", () => {
  assertEquals(parseCompilerVersion("v0.8.17+commit.abc123"), "0.8.17");
});

Deno.test("parseCompilerVersion: bare '0.8.20' → '0.8.20'", () => {
  assertEquals(parseCompilerVersion("0.8.20"), "0.8.20");
});

Deno.test("parseCompilerVersion: empty string → DEFAULT_SOLC_VERSION", () => {
  assertEquals(parseCompilerVersion(""), DEFAULT_SOLC_VERSION);
});

Deno.test("parseCompilerVersion: unparseable → DEFAULT_SOLC_VERSION", () => {
  assertEquals(parseCompilerVersion("garbage-string"), DEFAULT_SOLC_VERSION);
});

// detectSourceRoot ------------------------------------------------------------

Deno.test("detectSourceRoot: 'src/Token.sol' → 'src'", () => {
  assertEquals(detectSourceRoot("src/Token.sol"), "src");
});

Deno.test("detectSourceRoot: 'contracts/Token.sol' → 'contracts'", () => {
  assertEquals(detectSourceRoot("contracts/Token.sol"), "contracts");
});

Deno.test("detectSourceRoot: '@openzeppelin/…' → 'lib' (bare @-scope → lib/)", () => {
  assertEquals(
    detectSourceRoot("@openzeppelin/contracts/proxy/Proxy.sol"),
    "lib",
  );
});

Deno.test("detectSourceRoot: 'node_modules/…' → 'node_modules'", () => {
  assertEquals(
    detectSourceRoot("node_modules/@openzeppelin/contracts/Proxy.sol"),
    "node_modules",
  );
});

Deno.test("detectSourceRoot: bare 'Token.sol' → 'src' fallback", () => {
  assertEquals(detectSourceRoot("Token.sol"), "src");
});

Deno.test("detectSourceRoot: '' → 'src' fallback", () => {
  assertEquals(detectSourceRoot(""), "src");
});

// detectRemappingsFromPaths ---------------------------------------------------

Deno.test("detectRemappingsFromPaths: bare @-scope paths → 'lib/@scope/'", () => {
  const remappings = detectRemappingsFromPaths([
    "@openzeppelin/contracts/Foo.sol",
    "@openzeppelin/contracts/Bar.sol",
    "src/MyContract.sol",
  ]);
  assertEquals(remappings, ["@openzeppelin/=lib/@openzeppelin/"]);
});

Deno.test("detectRemappingsFromPaths: node_modules paths → 'node_modules/@scope/'", () => {
  const remappings = detectRemappingsFromPaths([
    "node_modules/@openzeppelin/contracts/Foo.sol",
  ]);
  assertEquals(remappings, ["@openzeppelin/=node_modules/@openzeppelin/"]);
});

Deno.test("detectRemappingsFromPaths: paths with no scope → empty result", () => {
  assertEquals(detectRemappingsFromPaths(["src/MyContract.sol"]), []);
});

Deno.test("detectRemappingsFromPaths: duplicate scopes deduplicated", () => {
  const remappings = detectRemappingsFromPaths([
    "@oz/contracts/A.sol",
    "@oz/contracts/B.sol",
    "@oz/contracts/C.sol",
  ]);
  assertEquals(remappings.length, 1);
});

// generateFoundryConfig -------------------------------------------------------

const network: Network = { chainId: "1", candidates: [] };

const baseMeta: CompilerMeta = {
  compilerVersion: "v0.8.17+commit.abc",
  optimizationUsed: true,
  runs: 200,
  evmVersion: "paris",
  contractFileName: "src/Foo.sol",
  contractName: "Foo",
  remappings: [],
};

Deno.test("generateFoundryConfig: optimizer on + evm_version set", () => {
  const out = generateFoundryConfig(baseMeta, "src", "0xABC", network);
  assertEquals(out.includes('solc = "0.8.17"'), true);
  assertEquals(out.includes("optimizer = true"), true);
  assertEquals(out.includes("optimizer_runs = 200"), true);
  assertEquals(out.includes('evm_version = "paris"'), true);
  assertEquals(out.includes('libs = ["lib"]'), true);
});

Deno.test("generateFoundryConfig: optimizer off → no optimizer_runs", () => {
  const out = generateFoundryConfig(
    { ...baseMeta, optimizationUsed: false },
    "src",
    "0xABC",
    network,
  );
  assertEquals(out.includes("optimizer = false"), true);
  assertEquals(out.includes("optimizer_runs"), false);
});

Deno.test("generateFoundryConfig: hasNodeModules → libs includes 'node_modules'", () => {
  const out = generateFoundryConfig(baseMeta, "src", "0xABC", network, true);
  assertEquals(out.includes('libs = ["lib", "node_modules"]'), true);
});

Deno.test("generateFoundryConfig: evmVersion 'Default' (case-insensitive) is skipped", () => {
  const out = generateFoundryConfig(
    { ...baseMeta, evmVersion: "Default" },
    "src",
    "0xABC",
    network,
  );
  assertEquals(out.includes("evm_version"), false);
});
