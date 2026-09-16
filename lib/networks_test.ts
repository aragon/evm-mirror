import { assertEquals } from "@std/assert";
import { CHAINS } from "./constants.ts";
import { getNetworkData } from "./networks.ts";

Deno.test("networks: mainnet → Etherscan V2 only, requires API key", () => {
  const n = getNetworkData(CHAINS.MAINNET);
  assertEquals(n.chainId, "1");
  assertEquals(n.candidates.length, 1);
  assertEquals(n.candidates[0].kind, "etherscan");
  assertEquals(
    (n.candidates[0] as { requiresApiKey?: boolean }).requiresApiKey,
    true,
  );
  assertEquals(
    n.candidates[0].urlPrefix.includes("chainid=1"),
    true,
  );
});

Deno.test("networks: Katana → Etherscan primary, Blockscout fallback", () => {
  const n = getNetworkData(CHAINS.KATANA);
  assertEquals(n.candidates.length, 2);
  assertEquals(n.candidates[0].kind, "etherscan");
  assertEquals(n.candidates[1].kind, "blockscout");
  assertEquals(
    n.candidates[1].urlPrefix,
    "https://explorer.katanarpc.com/api",
  );
});

Deno.test("networks: Citrea → Blockscout at explorer.mainnet.citrea.xyz", () => {
  const n = getNetworkData(CHAINS.CITREA);
  assertEquals(n.candidates.length, 1);
  assertEquals(n.candidates[0].kind, "blockscout");
  assertEquals(
    n.candidates[0].urlPrefix,
    "https://explorer.mainnet.citrea.xyz/api",
  );
});

Deno.test("networks: Monad → Etherscan V2 (moved off Blockscout)", () => {
  const n = getNetworkData(CHAINS.MONAD);
  assertEquals(n.candidates.length, 1);
  assertEquals(n.candidates[0].kind, "etherscan");
  assertEquals(n.candidates[0].urlPrefix.includes("chainid=143"), true);
});

Deno.test("networks: Avalanche uses Routescan URL (not api.etherscan.io)", () => {
  const n = getNetworkData(CHAINS.AVALANCHE);
  assertEquals(n.candidates[0].kind, "etherscan");
  assertEquals(n.candidates[0].urlPrefix.includes("routescan"), true);
  // Routescan does not require a key
  assertEquals(
    (n.candidates[0] as { requiresApiKey?: boolean }).requiresApiKey,
    undefined,
  );
});

Deno.test("networks: unknown chain → empty candidates (Sourcify tail handles it)", () => {
  const n = getNetworkData("999999");
  assertEquals(n.chainId, "999999");
  assertEquals(n.candidates, []);
});
