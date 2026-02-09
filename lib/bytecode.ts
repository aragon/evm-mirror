import { green, red, gray, bold } from "jsr:@std/fmt/colors";

export type BytecodeDiffResult = {
  contract: string;
  status: "match" | "differ" | "not-found";
  detail?: string;
};

async function runForge(dir: string): Promise<void> {
  console.log(gray(`Running forge build in ${bold(dir)}...`));
  const cmd = new Deno.Command("forge", {
    args: ["build", "--via-ir", "--optimize"],
    cwd: dir,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();
  if (code !== 0) {
    const errText = new TextDecoder().decode(stderr);
    throw new Error(`forge build failed in ${dir}:\n${errText}`);
  }
}

async function findArtifact(
  dir: string,
  contractName: string,
): Promise<string | null> {
  const outDir = `${dir}/out`;
  for await (const entry of walkDir(outDir)) {
    if (entry.name === `${contractName}.json`) {
      return entry.path;
    }
  }
  return null;
}

async function* walkDir(
  dir: string,
): AsyncGenerator<{ name: string; path: string }> {
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      yield* walkDir(path);
    } else if (entry.isFile) {
      yield { name: entry.name, path };
    }
  }
}

function readDeployedBytecode(artifact: Record<string, unknown>): string | null {
  const deployedBytecode = artifact.deployedBytecode as
    | { object?: string }
    | undefined;
  return deployedBytecode?.object ?? null;
}

export async function buildAndDiffBytecodes(
  dirA: string,
  dirB: string,
  contractName: string,
): Promise<BytecodeDiffResult[]> {
  // Build both projects
  await runForge(dirA);
  await runForge(dirB);

  console.log(
    gray(
      `\nComparing bytecodes for ${bold(contractName)} between ${bold(dirA)} and ${bold(dirB)}\n`,
    ),
  );

  const results: BytecodeDiffResult[] = [];

  const artifactPathA = await findArtifact(dirA, contractName);
  const artifactPathB = await findArtifact(dirB, contractName);

  if (!artifactPathA) {
    results.push({
      contract: contractName,
      status: "not-found",
      detail: `Artifact not found in ${dirA}/out/`,
    });
    return results;
  }
  if (!artifactPathB) {
    results.push({
      contract: contractName,
      status: "not-found",
      detail: `Artifact not found in ${dirB}/out/`,
    });
    return results;
  }

  const artifactA = JSON.parse(await Deno.readTextFile(artifactPathA));
  const artifactB = JSON.parse(await Deno.readTextFile(artifactPathB));

  const bytecodeA = readDeployedBytecode(artifactA);
  const bytecodeB = readDeployedBytecode(artifactB);

  if (!bytecodeA) {
    results.push({
      contract: contractName,
      status: "not-found",
      detail: `No deployedBytecode.object in ${artifactPathA}`,
    });
    return results;
  }
  if (!bytecodeB) {
    results.push({
      contract: contractName,
      status: "not-found",
      detail: `No deployedBytecode.object in ${artifactPathB}`,
    });
    return results;
  }

  if (bytecodeA === bytecodeB) {
    results.push({ contract: contractName, status: "match" });
  } else {
    results.push({
      contract: contractName,
      status: "differ",
      detail: `Bytecodes differ (${bytecodeA.length} chars vs ${bytecodeB.length} chars)`,
    });
  }

  return results;
}

export function printBytecodeDiffResults(results: BytecodeDiffResult[]) {
  for (const item of results) {
    if (item.status === "match") {
      console.log(`${green("[MATCH]")}     ${item.contract}`);
    } else if (item.status === "differ") {
      console.log(`${red("[DIFFERS]")}   ${item.contract}`);
      if (item.detail) console.log(gray(`  > ${item.detail}`));
    } else if (item.status === "not-found") {
      console.log(`${red("[NOT FOUND]")} ${item.contract}`);
      if (item.detail) console.log(gray(`  > ${item.detail}`));
    }
  }

  console.log();
  const matches = results.filter((r) => r.status === "match").length;
  const differs = results.filter((r) => r.status === "differ").length;
  const notFound = results.filter((r) => r.status === "not-found").length;

  if (matches) console.log(green(`${matches} contract(s) match`));
  if (differs) console.log(red(`${differs} contract(s) differ`));
  if (notFound) console.log(red(`${notFound} contract(s) not found`));
}
