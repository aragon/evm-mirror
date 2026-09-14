import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { etherscanProvider, parseVerifiedSources } from "./etherscan.ts";

// Minimal fixture — a valid Etherscan verified-contract response
const baseResult = {
  SourceCode: "contract Foo {}",
  ABI: '[{"type":"function"}]',
  ContractName: "Foo",
  CompilerVersion: "v0.8.17+commit.abc123",
  CompilerType: "solc-j",
  OptimizationUsed: "1",
  Runs: "200",
  ConstructorArguments: "",
  EVMVersion: "paris",
  Library: "",
  ContractFileName: "src/Foo.sol",
  LicenseType: "MIT",
  Proxy: "0",
  Implementation: "",
  SwarmSource: "",
  SimilarMatch: "",
};

Deno.test("etherscan parser: single-file source (no JSON-Input wrapper)", () => {
  const parsed = parseVerifiedSources("0xABC", baseResult);
  assertEquals(parsed.address, "0xABC");
  assertEquals(parsed.sources, { "Foo.sol": "contract Foo {}" });
  assertEquals(parsed.meta.compilerVersion, "v0.8.17+commit.abc123");
  assertEquals(parsed.meta.optimizationUsed, true);
  assertEquals(parsed.meta.runs, 200);
  assertEquals(parsed.meta.evmVersion, "paris");
  assertEquals(parsed.meta.contractFileName, "src/Foo.sol");
  assertEquals(parsed.meta.contractName, "Foo");
  assertEquals(parsed.meta.remappings, []);
  assertEquals(parsed.proxy, undefined);
});

Deno.test("etherscan parser: multi-file JSON-Input format with remappings", () => {
  const jsonInput = JSON.stringify({
    language: "Solidity",
    sources: {
      "src/A.sol": { content: "contract A {}" },
      "src/B.sol": { content: "contract B {}" },
    },
    settings: {
      remappings: ["@openzeppelin/=lib/oz/"],
    },
  });
  // Etherscan's convention: wrap the JSON object in one extra {...}. Since
  // jsonInput already starts with '{' and ends with '}', concatenation yields
  // a payload starting with '{{' and ending with '}}' — the sentinel the
  // parser sniffs for.
  const parsed = parseVerifiedSources("0xABC", {
    ...baseResult,
    SourceCode: `{${jsonInput}}`,
  });
  assertEquals(parsed.sources["src/A.sol"], "contract A {}");
  assertEquals(parsed.sources["src/B.sol"], "contract B {}");
  assertEquals(parsed.meta.remappings, ["@openzeppelin/=lib/oz/"]);
});

Deno.test("etherscan parser: proxy fields populate result.proxy", () => {
  const parsed = parseVerifiedSources("0xABC", {
    ...baseResult,
    Proxy: "1",
    Implementation: "0xIMPL",
  });
  assertEquals(parsed.proxy?.implementation, "0xIMPL");
});

Deno.test("etherscan parser: Proxy='1' but no Implementation → no proxy set", () => {
  const parsed = parseVerifiedSources("0xABC", {
    ...baseResult,
    Proxy: "1",
    Implementation: "",
  });
  assertEquals(parsed.proxy, undefined);
});

Deno.test("etherscan parser: unverified contract throws", () => {
  assertThrows(
    () =>
      parseVerifiedSources("0xABC", {
        ...baseResult,
        SourceCode: "",
        ABI: "Contract source code not verified",
      }),
    Error,
    "Contract is not verified",
  );
});

Deno.test("etherscan parser: malformed JSON-Input falls back to single file", () => {
  // Passes the {{...}} sentinel but the inner content is not valid JSON.
  const parsed = parseVerifiedSources("0xABC", {
    ...baseResult,
    SourceCode: "{{not valid json}}",
  });
  // Fallback stores the raw stripped content (one { and } peeled off each end)
  // under <ContractName>.sol.
  assertEquals(parsed.sources["Foo.sol"], "{not valid json}");
});

Deno.test("etherscan parser: OptimizationUsed='0' → optimizationUsed=false", () => {
  const parsed = parseVerifiedSources("0xABC", {
    ...baseResult,
    OptimizationUsed: "0",
    Runs: "0",
  });
  assertEquals(parsed.meta.optimizationUsed, false);
  // Runs defaults to 200 when unparseable / zero
  assertEquals(parsed.meta.runs, 200);
});

// fetchEtherscan retry behavior ----------------------------------------------

type FetchStub = (input: string | URL | Request) => Promise<Response>;

function withFetch(stub: FetchStub, fn: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = stub as typeof globalThis.fetch;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

const goodResult = {
  ...baseResult,
  SourceCode: "contract F {}",
  ContractName: "F",
  ContractFileName: "F.sol",
};

Deno.test("etherscan fetch: retries once when the API reports a rate limit", async () => {
  let calls = 0;
  await withFetch(() => {
    calls++;
    const body = calls === 1
      ? { status: "0", message: "NOTOK", result: "Max calls per sec rate limit reached (3/sec)" }
      : { status: "1", message: "OK", result: [goodResult] };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  }, async () => {
    const p = etherscanProvider({ urlPrefix: "http://x/api?", chainId: "1" });
    const result = await p.fetchSources(
      "0x0000000000000000000000000000000000000001",
    );
    assertEquals(calls, 2);
    assertEquals(result.meta.contractName, "F");
  });
});

Deno.test("etherscan fetch: does NOT retry on non-rate-limit errors", async () => {
  let calls = 0;
  await withFetch(() => {
    calls++;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          status: "0",
          message: "NOTOK",
          result: "Invalid API Key",
        }),
        { status: 200 },
      ),
    );
  }, async () => {
    const p = etherscanProvider({ urlPrefix: "http://x/api?", chainId: "1" });
    await assertRejects(
      () => p.fetchSources("0x0000000000000000000000000000000000000001"),
      Error,
      "Invalid API Key",
    );
    assertEquals(calls, 1);
  });
});

Deno.test("etherscan fetch: retry that also fails throws the second error", async () => {
  let calls = 0;
  await withFetch(() => {
    calls++;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          status: "0",
          message: "NOTOK",
          result: "Max calls per sec rate limit reached (3/sec)",
        }),
        { status: 200 },
      ),
    );
  }, async () => {
    const p = etherscanProvider({ urlPrefix: "http://x/api?", chainId: "1" });
    await assertRejects(
      () => p.fetchSources("0x0000000000000000000000000000000000000001"),
      Error,
      "rate limit",
    );
    assertEquals(calls, 2);
  });
});
