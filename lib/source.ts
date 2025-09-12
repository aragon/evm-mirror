import { diff } from "jsr:@libs/diff";
import { resolveLocalPath } from "./path.ts";
import { normalizeLineEndings } from "./text.ts";
import {
  green,
  red,
  yellow,
  bold,
  gray,
} from "https://deno.land/std@0.224.0/fmt/colors.ts";
import { Remappings } from "./types.ts";

/**
 * Compares the fetched source files against their local counterparts.
 * @param sources A map of Etherscan file paths to their content.
 * @param localPath The root directory of the local project.
 * @param remappings A map of import prefixes to local directory paths.
 */
export async function compareSources(
  sources: Map<string, string>,
  localPath: string,
  remappings: Remappings,
): Promise<void> {
  console.log(
    gray(
      `Comparing ${sources.size} source file(s) against ${bold(localPath)}\n`,
    ),
  );
  let matchCount = 0;
  let diffCount = 0;
  let notFoundCount = 0;

  for (const [etherscanPath, etherscanContent] of sources.entries()) {
    const resolvedPath = resolveLocalPath(etherscanPath, localPath, remappings);

    try {
      const localContent = await Deno.readTextFile(resolvedPath);

      const normalizedEtherscan = normalizeLineEndings(etherscanContent);
      const normalizedLocal = normalizeLineEndings(localContent);

      if (normalizedEtherscan === normalizedLocal) {
        console.log(`${green("[MATCH]")} ${etherscanPath}`);
        matchCount++;
      } else {
        console.log(`${yellow("[DIFF]")}  ${etherscanPath}`);
        diffCount++;
        const patch = diff(normalizedLocal, normalizedEtherscan, {
          colors: true,
        });
        console.log(patch);
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.log(`${red("[NOT FOUND]")} ${etherscanPath}`);
        console.log(gray(`  > Expected at: ${resolvedPath}`));
        notFoundCount++;
      } else {
        console.error(red(`Error reading local file ${resolvedPath}:`), error);
      }
    }
  }

  // --- Summary ---
  console.log();
  if (matchCount) {
    console.log(green(`${matchCount} file(s) matched.`));
  }
  if (diffCount) {
    console.log(red(`${diffCount} file(s) had differences.`));
  }
  if (notFoundCount) {
    console.log(red(`${notFoundCount} file(s) were not found locally.`));
  }
}
