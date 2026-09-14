import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { diffContractSources, diffWithLocalPath } from "./source.ts";
import { ContractSources } from "./types.ts";

function contract(
  address: string,
  sources: Record<string, string>,
): ContractSources {
  return { address, sources };
}

// diffContractSources ---------------------------------------------------------

Deno.test("diffContractSources: identical sets → all match", () => {
  const a = contract("0xA", { "F.sol": "code" });
  const b = contract("0xB", { "F.sol": "code" });
  const results = diffContractSources(a, b);
  assertEquals(results.length, 1);
  assertEquals(results[0].status, "match");
  assertEquals(results[0].path, "F.sol");
});

Deno.test("diffContractSources: differing content → 'differ' status with diff string", () => {
  const a = contract("0xA", { "F.sol": "old\ncode\n" });
  const b = contract("0xB", { "F.sol": "new\ncode\n" });
  const results = diffContractSources(a, b);
  assertEquals(results.length, 1);
  assertEquals(results[0].status, "differ");
  if (results[0].status === "differ") {
    assertEquals(results[0].diff.length > 0, true);
  }
});

Deno.test("diffContractSources: file missing on B → 'not-found' b/…", () => {
  const a = contract("0xA", { "F.sol": "x", "G.sol": "y" });
  const b = contract("0xB", { "F.sol": "x" });
  const results = diffContractSources(a, b);
  const missing = results.find((r) => r.status === "not-found");
  assertEquals(missing?.path, "b/G.sol");
});

Deno.test("diffContractSources: file missing on A → 'not-found' a/…", () => {
  const a = contract("0xA", { "F.sol": "x" });
  const b = contract("0xB", { "F.sol": "x", "H.sol": "z" });
  const results = diffContractSources(a, b);
  const missing = results.find(
    (r) => r.status === "not-found" && r.path.startsWith("a/"),
  );
  assertEquals(missing?.path, "a/H.sol");
});

Deno.test("diffContractSources: CRLF vs LF is normalized (same source ⇒ match)", () => {
  const a = contract("0xA", { "F.sol": "line1\r\nline2\r\n" });
  const b = contract("0xB", { "F.sol": "line1\nline2\n" });
  const results = diffContractSources(a, b);
  assertEquals(results[0].status, "match");
});

// diffWithLocalPath -----------------------------------------------------------

Deno.test("diffWithLocalPath: matching content → 'match'", async () => {
  const dir = await Deno.makeTempDir({ dir: ".test-tmp", prefix: "mirror_" });
  try {
    await Deno.writeTextFile(join(dir, "F.sol"), "contract F {}");
    const results = await diffWithLocalPath(
      contract("0xA", { "F.sol": "contract F {}" }),
      dir,
      {},
    );
    assertEquals(results.length, 1);
    assertEquals(results[0].status, "match");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("diffWithLocalPath: differing content → 'differ'", async () => {
  const dir = await Deno.makeTempDir({ dir: ".test-tmp", prefix: "mirror_" });
  try {
    await Deno.writeTextFile(join(dir, "F.sol"), "contract F { uint a; }");
    const results = await diffWithLocalPath(
      contract("0xA", { "F.sol": "contract F { uint b; }" }),
      dir,
      {},
    );
    assertEquals(results[0].status, "differ");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("diffWithLocalPath: missing local file → 'not-found' with expectedPath", async () => {
  const dir = await Deno.makeTempDir({ dir: ".test-tmp", prefix: "mirror_" });
  try {
    const results = await diffWithLocalPath(
      contract("0xA", { "F.sol": "any" }),
      dir,
      {},
    );
    assertEquals(results[0].status, "not-found");
    if (results[0].status === "not-found") {
      assertEquals(results[0].expectedPath, join(dir, "F.sol"));
    }
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("diffWithLocalPath: remapping rewrites the lookup path", async () => {
  const dir = await Deno.makeTempDir({ dir: ".test-tmp", prefix: "mirror_" });
  try {
    await Deno.mkdir(join(dir, "lib", "oz"), { recursive: true });
    await Deno.writeTextFile(
      join(dir, "lib", "oz", "Owned.sol"),
      "contract Owned {}",
    );
    const results = await diffWithLocalPath(
      contract("0xA", { "@openzeppelin/Owned.sol": "contract Owned {}" }),
      dir,
      { "@openzeppelin/": "lib/oz/" },
    );
    assertEquals(results[0].status, "match");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
