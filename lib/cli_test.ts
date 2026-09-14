import { assertEquals, assertThrows } from "@std/assert";
import { buildResolverOptions, CliArguments } from "./cli.ts";

const ENV_KEYS = [
  "ETHERSCAN_API_KEY",
  "ETHERSCAN_URL",
  "BLOCKSCOUT_URL",
  "SOURCIFY_URL",
] as const;

/**
 * Runs `fn` with the four env vars set to the given values (undefined = unset),
 * then restores whatever the shell had. Keeps tests deterministic regardless of
 * the caller's environment.
 */
function withEnv(
  vars: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  fn: () => void,
): void {
  const saved = {} as Record<string, string | undefined>;
  for (const k of ENV_KEYS) saved[k] = Deno.env.get(k);
  try {
    for (const k of ENV_KEYS) {
      const v = vars[k];
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
    fn();
  } finally {
    for (const k of ENV_KEYS) {
      const v = saved[k];
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

function args(partial: Partial<CliArguments> = {}): CliArguments {
  return { _: [], ...partial } as CliArguments;
}

Deno.test("buildResolverOptions: empty env + no flags → all undefined", () => {
  withEnv({}, () => {
    const opts = buildResolverOptions(args());
    assertEquals(opts, {
      provider: undefined,
      apiUrl: undefined,
      apiKey: undefined,
      etherscanApiKey: undefined,
      etherscanUrl: undefined,
      blockscoutUrl: undefined,
      sourcifyUrl: undefined,
    });
  });
});

Deno.test("buildResolverOptions: env vars flow into resolver options", () => {
  withEnv(
    {
      ETHERSCAN_API_KEY: "envkey",
      ETHERSCAN_URL: "https://envscan/api",
      BLOCKSCOUT_URL: "https://envscout/api",
      SOURCIFY_URL: "https://envsourcify/server",
    },
    () => {
      const opts = buildResolverOptions(args());
      assertEquals(opts.etherscanApiKey, "envkey");
      assertEquals(opts.etherscanUrl, "https://envscan/api");
      assertEquals(opts.blockscoutUrl, "https://envscout/api");
      assertEquals(opts.sourcifyUrl, "https://envsourcify/server");
    },
  );
});

Deno.test("buildResolverOptions: --etherscan-api-key flag wins over env", () => {
  withEnv({ ETHERSCAN_API_KEY: "envkey" }, () => {
    const opts = buildResolverOptions(args({ etherscanApiKey: "flagkey" }));
    assertEquals(opts.etherscanApiKey, "flagkey");
  });
});

Deno.test("buildResolverOptions: --api-key stays generic (does not fill etherscanApiKey slot)", () => {
  withEnv({}, () => {
    const opts = buildResolverOptions(args({ apiKey: "generic" }));
    assertEquals(opts.apiKey, "generic");
    assertEquals(opts.etherscanApiKey, undefined);
  });
});

Deno.test("buildResolverOptions: whitespace-only flags become undefined", () => {
  withEnv({}, () => {
    const opts = buildResolverOptions(
      args({ apiKey: "   ", etherscanApiKey: "\t", apiUrl: "" }),
    );
    assertEquals(opts.apiKey, undefined);
    assertEquals(opts.etherscanApiKey, undefined);
    assertEquals(opts.apiUrl, undefined);
  });
});

Deno.test("buildResolverOptions: --provider must be a known name", () => {
  withEnv({}, () => {
    assertThrows(
      () => buildResolverOptions(args({ provider: "bogus" })),
      Error,
      "Unknown provider: 'bogus'",
    );
  });
});

Deno.test("buildResolverOptions: --provider accepts each valid name", () => {
  withEnv({}, () => {
    for (const p of ["etherscan", "blockscout", "sourcify"] as const) {
      const opts = buildResolverOptions(args({ provider: p }));
      assertEquals(opts.provider, p);
    }
  });
});
