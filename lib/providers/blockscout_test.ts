import { assertEquals, assertThrows } from "@std/assert";
import { parseVerifiedSources } from "./blockscout.ts";

const baseResult = {
  file_path: "src/Foo.sol",
  source_code: "contract Foo {}",
  additional_sources: [],
  abi: [{ type: "function" }],
  optimization_enabled: true,
  optimization_runs: 200,
  compiler_version: "v0.8.20+commit.abc",
  compiler_settings: { remappings: [] },
  implementations: [],
  name: "Foo",
  evm_version: "paris",
};

Deno.test("blockscout parser: main file + additional sources are merged", () => {
  const parsed = parseVerifiedSources("0xABC", {
    ...baseResult,
    additional_sources: [
      { file_path: "src/lib/Math.sol", source_code: "library Math {}" },
      { file_path: "src/Bar.sol", source_code: "contract Bar {}" },
    ],
  });
  assertEquals(parsed.sources["src/Foo.sol"], "contract Foo {}");
  assertEquals(parsed.sources["src/lib/Math.sol"], "library Math {}");
  assertEquals(parsed.sources["src/Bar.sol"], "contract Bar {}");
  assertEquals(Object.keys(parsed.sources).length, 3);
});

Deno.test("blockscout parser: absent additional_sources → still parses main file", () => {
  const parsed = parseVerifiedSources("0xABC", {
    ...baseResult,
    additional_sources: undefined as unknown as [],
  });
  assertEquals(Object.keys(parsed.sources), ["src/Foo.sol"]);
});

Deno.test("blockscout parser: implementations[0] populates proxy", () => {
  const parsed = parseVerifiedSources("0xABC", {
    ...baseResult,
    implementations: [{ address: "0xIMPL", name: "FooImpl" }],
  });
  assertEquals(parsed.proxy?.implementation, "0xIMPL");
});

Deno.test("blockscout parser: empty implementations → no proxy", () => {
  const parsed = parseVerifiedSources("0xABC", baseResult);
  assertEquals(parsed.proxy, undefined);
});

Deno.test("blockscout parser: missing source_code throws", () => {
  assertThrows(
    () =>
      parseVerifiedSources("0xABC", {
        ...baseResult,
        source_code: "",
      }),
    Error,
    "Contract is not verified",
  );
});

Deno.test("blockscout parser: empty ABI throws", () => {
  assertThrows(
    () =>
      parseVerifiedSources("0xABC", {
        ...baseResult,
        abi: [],
      }),
    Error,
    "Contract is not verified",
  );
});

Deno.test("blockscout parser: missing compiler_settings.remappings defaults to []", () => {
  const parsed = parseVerifiedSources("0xABC", {
    ...baseResult,
    compiler_settings: undefined,
  });
  assertEquals(parsed.meta.remappings, []);
});

Deno.test("blockscout parser: compiler_settings.remappings is preserved when present", () => {
  const parsed = parseVerifiedSources("0xABC", {
    ...baseResult,
    compiler_settings: { remappings: ["@oz/=lib/oz/", "@ds/=lib/ds/"] },
  });
  assertEquals(parsed.meta.remappings, ["@oz/=lib/oz/", "@ds/=lib/ds/"]);
});
