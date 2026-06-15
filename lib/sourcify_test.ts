import { assertEquals, assertThrows } from "@std/assert";
import { parseVerifiedSources } from "./sourcify.ts";

Deno.test("parseVerifiedSources converts Sourcify contract lookup responses", () => {
  const result = parseVerifiedSources(
    "0x2738d13E81e30bC615766A0410e7cF199FD59A83",
    {
      sources: {
        "contracts/1_Storage.sol": {
          content: "contract Storage {}",
        },
      },
      compilation: {
        language: "Solidity",
        compiler: "solc",
        compilerVersion: "0.8.7+commit.e28d00a7",
        compilerSettings: {
          optimizer: { enabled: false, runs: 200 },
          evmVersion: "london",
          remappings: ["@openzeppelin/=lib/openzeppelin-contracts/"],
        },
        name: "Storage",
        fullyQualifiedName: "contracts/1_Storage.sol:Storage",
      },
      proxyResolution: {
        implementations: [],
      },
    },
  );

  assertEquals(result, {
    address: "0x2738d13E81e30bC615766A0410e7cF199FD59A83",
    sources: {
      "contracts/1_Storage.sol": "contract Storage {}",
    },
    meta: {
      compilerVersion: "0.8.7+commit.e28d00a7",
      optimizationUsed: false,
      runs: 200,
      evmVersion: "london",
      contractFileName: "contracts/1_Storage.sol",
      contractName: "Storage",
      remappings: ["@openzeppelin/=lib/openzeppelin-contracts/"],
    },
  });
});

Deno.test("parseVerifiedSources records Sourcify proxy implementations", () => {
  const result = parseVerifiedSources(
    "0x0000000000000000000000000000000000000001",
    {
      sources: {
        "src/Proxy.sol": {
          content: "contract Proxy {}",
        },
      },
      compilation: {
        compilerVersion: "0.8.28+commit.7893614a",
        compilerSettings: {
          optimizer: { enabled: true, runs: "1000" },
        },
        fullyQualifiedName: "src/Proxy.sol:Proxy",
      },
      proxyResolution: {
        implementations: [
          {
            address: "0x0000000000000000000000000000000000000002",
          },
        ],
      },
    },
  );

  assertEquals(result.proxy, {
    implementation: "0x0000000000000000000000000000000000000002",
  });
  assertEquals(result.meta.optimizationUsed, true);
  assertEquals(result.meta.runs, 1000);
});

Deno.test("parseVerifiedSources rejects missing Sourcify sources", () => {
  assertThrows(
    () => {
      parseVerifiedSources("0x0000000000000000000000000000000000000001", {});
    },
    Error,
    "The contract is not verified or does not exist",
  );
});
