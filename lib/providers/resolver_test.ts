import { assertEquals, assertThrows } from "@std/assert";
import { Network } from "../types.ts";
import { resolveProviders, fetchWithFallback } from "./resolver.ts";
import { Provider } from "./types.ts";

// Fixtures

const chainWithEtherscan: Network = {
  chainId: "1",
  candidates: [
    {
      kind: "etherscan",
      urlPrefix: "https://api.etherscan.io/v2/api?chainid=1",
      requiresApiKey: true,
    },
  ],
};

const chainWithBlockscout: Network = {
  chainId: "747474",
  candidates: [
    { kind: "blockscout", urlPrefix: "https://explorer.katanarpc.com/api" },
  ],
};

const chainWithBoth: Network = {
  chainId: "1",
  candidates: [
    {
      kind: "etherscan",
      urlPrefix: "https://api.etherscan.io/v2/api?chainid=1",
      requiresApiKey: true,
    },
    { kind: "blockscout", urlPrefix: "https://eth.blockscout.com/api" },
  ],
};

const unknownChain: Network = {
  chainId: "999999",
  candidates: [],
};

// resolveProviders

Deno.test("resolveProviders: known Etherscan chain → [etherscan, sourcify]", () => {
  const list = resolveProviders(chainWithEtherscan, {}).map((p) => p.name);
  assertEquals(list, ["etherscan", "sourcify"]);
});

Deno.test("resolveProviders: known Blockscout chain → [blockscout, sourcify]", () => {
  const list = resolveProviders(chainWithBlockscout, {}).map((p) => p.name);
  assertEquals(list, ["blockscout", "sourcify"]);
});

Deno.test("resolveProviders: chain with both → [etherscan, blockscout, sourcify]", () => {
  const list = resolveProviders(chainWithBoth, {}).map((p) => p.name);
  assertEquals(list, ["etherscan", "blockscout", "sourcify"]);
});

Deno.test("resolveProviders: unknown chain → [sourcify] only", () => {
  const list = resolveProviders(unknownChain, {}).map((p) => p.name);
  assertEquals(list, ["sourcify"]);
});

Deno.test("resolveProviders: pinned provider returns exactly one", () => {
  const list = resolveProviders(chainWithBoth, { provider: "sourcify" }).map(
    (p) => p.name,
  );
  assertEquals(list, ["sourcify"]);
});

Deno.test("resolveProviders: pinned etherscan without URL config throws", () => {
  assertThrows(
    () => resolveProviders(unknownChain, { provider: "etherscan" }),
    Error,
    "no URL configured",
  );
});

Deno.test("resolveProviders: pinned + --api-url routes to that provider", () => {
  const list = resolveProviders(unknownChain, {
    provider: "blockscout",
    apiUrl: "https://my-scout.internal/api",
  });
  assertEquals(list.length, 1);
  assertEquals(list[0].name, "blockscout");
  assertEquals(list[0].label, "blockscout (my-scout.internal)");
});

Deno.test("resolveProviders: --api-key alone does not duplicate Etherscan", () => {
  // Etherscan is already the chain default; supplying a key must not add a
  // second etherscan entry in front of the chain-map one.
  const list = resolveProviders(chainWithEtherscan, {
    etherscanApiKey: "abc",
  }).map((p) => p.name);
  assertEquals(list, ["etherscan", "sourcify"]);
});

Deno.test("resolveProviders: sourcify is always the tail even without config", () => {
  const list = resolveProviders(chainWithEtherscan, {
    etherscanApiKey: "abc",
  }).map((p) => p.name);
  assertEquals(list[list.length - 1], "sourcify");
});

// fetchWithFallback

Deno.test("fetchWithFallback: returns first success", async () => {
  const providers: Provider[] = [
    {
      name: "etherscan",
      label: "etherscan (mock)",
      fetchSources: () => Promise.reject(new Error("first fails")),
    },
    {
      name: "sourcify",
      label: "sourcify",
      fetchSources: () =>
        Promise.resolve({
          address: "0xABC",
          sources: { "F.sol": "code" },
          meta: {
            compilerVersion: "0.8.0",
            optimizationUsed: false,
            runs: 200,
            evmVersion: "paris",
            contractFileName: "F.sol",
            contractName: "F",
            remappings: [],
          },
        }),
    },
  ];
  const result = await fetchWithFallback(providers, "0xABC");
  assertEquals(result.address, "0xABC");
});

Deno.test("fetchWithFallback: throws with all errors if every provider fails", async () => {
  const providers: Provider[] = [
    {
      name: "etherscan",
      label: "etherscan (mock)",
      fetchSources: () => Promise.reject(new Error("nope-1")),
    },
    {
      name: "sourcify",
      label: "sourcify",
      fetchSources: () => Promise.reject(new Error("nope-2")),
    },
  ];
  try {
    await fetchWithFallback(providers, "0xABC");
    throw new Error("expected to throw");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assertEquals(msg.includes("nope-1"), true);
    assertEquals(msg.includes("nope-2"), true);
  }
});

Deno.test("fetchWithFallback: empty provider list throws", async () => {
  try {
    await fetchWithFallback([], "0xABC");
    throw new Error("expected to throw");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    assertEquals(msg, "No providers available for this chain");
  }
});
