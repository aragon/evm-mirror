import { assertEquals } from "@std/assert";
import { parseVerifiedSources, SourcifyContractResponse } from "./sourcify.ts";

Deno.test("sourcify parser: extracts sources, meta, and remappings", () => {
  const raw: SourcifyContractResponse = {
    match: "exact_match",
    chainId: "1",
    address: "0xABC",
    sources: {
      "src/Token.sol": { content: "contract Token {}" },
      "src/lib/Math.sol": { content: "library Math {}" },
    },
    compilation: {
      language: "Solidity",
      compiler: "solc",
      compilerVersion: "0.8.20+commit.a1b79de6",
      compilerSettings: {
        optimizer: { enabled: true, runs: 999 },
        evmVersion: "paris",
        remappings: ["@openzeppelin/=lib/oz/"],
      },
      name: "Token",
      fullyQualifiedName: "src/Token.sol:Token",
    },
  };
  const parsed = parseVerifiedSources("0xABC", raw);
  assertEquals(parsed.address, "0xABC");
  assertEquals(parsed.sources["src/Token.sol"], "contract Token {}");
  assertEquals(parsed.sources["src/lib/Math.sol"], "library Math {}");
  assertEquals(parsed.meta.compilerVersion, "0.8.20+commit.a1b79de6");
  assertEquals(parsed.meta.optimizationUsed, true);
  assertEquals(parsed.meta.runs, 999);
  assertEquals(parsed.meta.evmVersion, "paris");
  assertEquals(parsed.meta.contractFileName, "src/Token.sol");
  assertEquals(parsed.meta.contractName, "Token");
  assertEquals(parsed.meta.remappings, ["@openzeppelin/=lib/oz/"]);
  assertEquals(parsed.proxy, undefined);
});

Deno.test("sourcify parser: sets proxy when proxyResolution reports one", () => {
  const raw: SourcifyContractResponse = {
    match: "match",
    chainId: "1",
    address: "0xABC",
    sources: { "F.sol": { content: "// x" } },
    compilation: {
      compilerVersion: "0.8.0",
      compilerSettings: { optimizer: { enabled: false, runs: 200 } },
      name: "F",
      fullyQualifiedName: "F.sol:F",
    },
    proxyResolution: {
      isProxy: true,
      implementations: [{ address: "0xIMPL" }],
      proxyType: "EIP1967Proxy",
    },
  };
  const parsed = parseVerifiedSources("0xABC", raw);
  assertEquals(parsed.proxy?.implementation, "0xIMPL");
});

Deno.test("sourcify parser: falls back to first source path when fullyQualifiedName missing", () => {
  const raw: SourcifyContractResponse = {
    match: "match",
    chainId: "1",
    address: "0xABC",
    sources: { "onlyFile.sol": { content: "// x" } },
    compilation: {
      compilerVersion: "0.8.0",
      compilerSettings: {},
      name: "OnlyFile",
    },
  };
  const parsed = parseVerifiedSources("0xABC", raw);
  assertEquals(parsed.meta.contractFileName, "onlyFile.sol");
});

Deno.test("sourcify parser: handles missing optimizer settings with sane defaults", () => {
  const raw: SourcifyContractResponse = {
    match: "exact_match",
    chainId: "1",
    address: "0xABC",
    sources: { "F.sol": { content: "// x" } },
    compilation: {
      compilerVersion: "0.8.0",
      compilerSettings: {},
      name: "F",
      fullyQualifiedName: "F.sol:F",
    },
  };
  const parsed = parseVerifiedSources("0xABC", raw);
  assertEquals(parsed.meta.optimizationUsed, false);
  assertEquals(parsed.meta.runs, 200);
  assertEquals(parsed.meta.remappings, []);
});
