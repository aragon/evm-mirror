import { diff } from "jsr:@libs/diff";
import { resolveLocalPath } from "./path.ts";
import { normalizeLineEndings } from "./text.ts";
import { green, red, bold, gray } from "jsr:@std/fmt/colors";
import { ContractSources, Remappings } from "./types.ts";

type DiffResult =
  | {
      status: "match";
      path: string;
    }
  | {
      status: "mismatch";
      path: string;
      diff: string;
    }
  | {
      status: "not-found" | "error";
      path: string;
      expectedPath?: string;
    };

/**
 * Compares the fetched source files against their local counterparts.
 * @param sources A map of Etherscan file paths to their content.
 * @param localPath The root directory of the local project.
 * @param remappings A map of import prefixes to local directory paths.
 */
export async function diffWithLocalPath(
  sources: ContractSources,
  localPath: string,
  remappings: Remappings,
): Promise<Array<DiffResult>> {
  console.log(
    gray(
      `Comparing ${Object.keys(sources.sources).length} source file(s) against ${bold(localPath)}\n`,
    ),
  );
  const result = [] as DiffResult[];

  for (const etherscanPath in sources.sources) {
    const etherscanContent = sources.sources[etherscanPath];
    const resolvedPath = resolveLocalPath(etherscanPath, localPath, remappings);

    try {
      const localContent = await Deno.readTextFile(resolvedPath);

      const normalizedEtherscan = normalizeLineEndings(etherscanContent);
      const normalizedLocal = normalizeLineEndings(localContent);

      if (normalizedEtherscan === normalizedLocal) {
        result.push({ status: "match", path: etherscanPath });
      } else {
        result.push({
          status: "mismatch",
          path: etherscanPath,
          diff: diff(normalizedLocal, normalizedEtherscan, {
            colors: true,
          }),
        });
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        result.push({
          status: "not-found",
          path: etherscanPath,
          expectedPath: resolvedPath,
        });
      } else {
        result.push({
          status: "error",
          path: etherscanPath,
          expectedPath: resolvedPath,
        });
        console.error(red(`Error reading local file ${resolvedPath}:`), error);
      }
    }
  }
  return result;
}

/**
 * Compares the fetched source files against their local counterparts.
 * @param sourcesA A map of Etherscan file paths to their content.
 * @param sourcesB A map of Etherscan file paths to their content.
 */
export function diffEtherscanSources(
  sourcesA: ContractSources,
  sourcesB: ContractSources,
): Array<DiffResult> {
  console.log(
    gray(
      `Comparing ${Object.keys(sourcesA.sources).length} source file(s) from ${sourcesA.address} against ${Object.keys(sourcesB.sources).length} source file(s) from ${sourcesB.address}\n`,
    ),
  );
  const result = [] as DiffResult[];

  // Compare A against B
  for (const filePathA in sourcesA.sources) {
    const sourceA = sourcesA.sources[filePathA];
    if (typeof sourceA !== "string") {
      throw new Error("Unexpected empty source code");
    }

    const sourceB = sourcesB.sources[filePathA];
    if (typeof sourceB !== "string") {
      result.push({
        status: "not-found",
        path: "b/" + filePathA,
      });
      continue;
    }

    const normalizedA = normalizeLineEndings(sourceA);
    const normalizedB = normalizeLineEndings(sourceB);

    if (normalizedA === normalizedB) {
      result.push({ status: "match", path: filePathA });
    } else {
      result.push({
        status: "mismatch",
        path: filePathA,
        diff: diff(normalizedA, normalizedB, {
          colors: true,
        }),
      });
    }
  }

  // Check files on B that are not present on A
  for (const filePathB in sourcesB.sources) {
    if (typeof sourcesA.sources[filePathB] !== "string") {
      result.push({
        status: "not-found",
        path: "a/" + filePathB,
      });
    }
  }

  return result;
}

export function printDiffResults(results: Array<DiffResult>) {
  let matches = 0;
  let mismatches = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (const item of results) {
    if (item.status === "match") {
      console.log(`${green("[MATCH]")} ${item.path}`);
      matches++;
    } else if (item.status === "mismatch") {
      console.log(`${red("[MISMATCH]")}  ${item.path}`);
      console.log(item.diff + "\n");
      mismatches++;
    } else if (item.status === "not-found") {
      console.log(`${red("[NOT FOUND]")} ${item.path}`);
      if (item.expectedPath) {
        console.log(gray(`  > Expected at: ${item.expectedPath}\n`));
      }
      notFoundCount++;
    } else if (item.status === "error") {
      console.log(`${red("[ERROR]")} ${item.path}`);
      if (item.expectedPath) {
        console.log(gray(`  > Expected at: ${item.expectedPath}\n`));
      }
      errorCount++;
    }
  }

  console.log();
  if (matches) {
    console.log(green(`${matches} file(s) matched`));
  }
  if (mismatches) {
    console.log(red(`${mismatches} file(s) had mismatches`));
  }
  if (notFoundCount) {
    console.log(red(`${notFoundCount} file(s) could not be found`));
  }
  if (errorCount) {
    console.log(red(`${errorCount} file(s) could not be read`));
  }
}
