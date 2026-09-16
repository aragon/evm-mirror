import { assertEquals, assertThrows } from "@std/assert";
import { buildResolverOptions, CliArguments } from "./cli.ts";

const ENV_KEYS = ["ETHERSCAN_API_KEY"] as const;

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
      etherscanApiKey: undefined,
    });
  });
});

Deno.test("buildResolverOptions: ETHERSCAN_API_KEY env populates the key slot", () => {
  withEnv({ ETHERSCAN_API_KEY: "envkey" }, () => {
    const opts = buildResolverOptions(args());
    assertEquals(opts.etherscanApiKey, "envkey");
  });
});

Deno.test("buildResolverOptions: --api-url without --provider throws", () => {
  withEnv({}, () => {
    assertThrows(
      () =>
        buildResolverOptions(args({ apiUrl: "https://my-scout.internal/api" })),
      Error,
      "--api-url requires --provider",
    );
  });
});

Deno.test("buildResolverOptions: --api-url + --provider is accepted", () => {
  withEnv({}, () => {
    const opts = buildResolverOptions(
      args({ apiUrl: "https://x/api", provider: "blockscout" }),
    );
    assertEquals(opts.apiUrl, "https://x/api");
    assertEquals(opts.provider, "blockscout");
  });
});

Deno.test("buildResolverOptions: --api-key flag wins over env", () => {
  withEnv({ ETHERSCAN_API_KEY: "envkey" }, () => {
    const opts = buildResolverOptions(args({ apiKey: "flagkey" }));
    assertEquals(opts.etherscanApiKey, "flagkey");
  });
});

Deno.test("buildResolverOptions: --api-key populates the (Etherscan-scoped) key slot", () => {
  withEnv({}, () => {
    const opts = buildResolverOptions(args({ apiKey: "key123" }));
    assertEquals(opts.etherscanApiKey, "key123");
    // There is no separate generic `apiKey` slot on resolver options.
    assertEquals(
      Object.prototype.hasOwnProperty.call(opts, "apiKey"),
      false,
    );
  });
});

Deno.test("buildResolverOptions: whitespace-only flags become undefined", () => {
  withEnv({}, () => {
    const opts = buildResolverOptions(
      args({ apiKey: "\t", apiUrl: "" }),
    );
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
