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

// End-to-end wire-through: resolver → Provider → HTTP -----------------------

function withFetch(
  stub: (input: string | URL | Request) => Promise<Response>,
  fn: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = stub as typeof globalThis.fetch;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

Deno.test("resolveProviders: pinned etherscan + --api-url reflects override in label", () => {
  const list = resolveProviders(unknownChain, {
    provider: "etherscan",
    apiUrl:
      "https://my-scan.internal/v2/api?chainid=1&module=contract&action=getsourcecode",
  });
  assertEquals(list.length, 1);
  assertEquals(list[0].name, "etherscan");
  assertEquals(list[0].label, "etherscan (my-scan.internal)");
});

Deno.test("resolveProviders: pinned sourcify + --api-url uses that base URL", async () => {
  let capturedUrl = "";
  await withFetch(
    (input) => {
      capturedUrl = input.toString();
      return Promise.resolve(new Response("", { status: 404 }));
    },
    async () => {
      const [p] = resolveProviders(unknownChain, {
        provider: "sourcify",
        apiUrl: "https://my-sourcify.internal/server",
      });
      await p
        .fetchSources("0x0000000000000000000000000000000000000001")
        .catch(() => {});
      assertEquals(
        capturedUrl.startsWith("https://my-sourcify.internal/server/v2/contract/"),
        true,
        `unexpected fetch URL: ${capturedUrl}`,
      );
    },
  );
});

Deno.test("resolveProviders: --api-key flows through to the Etherscan HTTP URL", async () => {
  let capturedUrl = "";
  await withFetch(
    (input) => {
      capturedUrl = input.toString();
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: "1",
            message: "OK",
            result: [
              {
                SourceCode: "contract F {}",
                ABI: "[]",
                ContractName: "F",
                CompilerVersion: "v0.8.0",
                OptimizationUsed: "0",
                Runs: "200",
                EVMVersion: "paris",
                ContractFileName: "F.sol",
                Proxy: "0",
                Implementation: "",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    },
    async () => {
      const [p] = resolveProviders(chainWithEtherscan, {
        etherscanApiKey: "sekret",
      });
      await p.fetchSources("0x0000000000000000000000000000000000000001");
      assertEquals(
        capturedUrl.includes("apikey=sekret"),
        true,
        `expected apikey=sekret in URL; got: ${capturedUrl}`,
      );
    },
  );
});

Deno.test("resolveProviders: Sourcify tail uses the built-in default URL", async () => {
  let capturedUrl = "";
  await withFetch(
    (input) => {
      capturedUrl = input.toString();
      return Promise.resolve(new Response("", { status: 404 }));
    },
    async () => {
      // Unknown chain has zero candidates — resolver produces only Sourcify,
      // and with no override its base URL must be the built-in default.
      const [p] = resolveProviders(unknownChain, {});
      await p
        .fetchSources("0x0000000000000000000000000000000000000001")
        .catch(() => {});
      assertEquals(
        capturedUrl.startsWith("https://sourcify.dev/server/v2/contract/"),
        true,
        `unexpected fetch URL: ${capturedUrl}`,
      );
    },
  );
});
