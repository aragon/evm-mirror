import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { Remappings } from "./types.ts";

/**
 * Resolves the local path for a given contract file path from Etherscan.
 * It the given remappings for dependencies.
 * @param etherscanPath The file path from the Etherscan source code.
 * @param localBasePath The root directory of the local project.
 * @param remappings A map of import prefixes to local directory paths.
 * @returns The fully resolved local file path.
 */
export function resolveLocalPath(
  etherscanPath: string,
  localBasePath: string,
  remappings: Remappings,
): string {
  for (const prefix in remappings) {
    if (etherscanPath.startsWith(prefix)) {
      const newPath = etherscanPath.replace(prefix, remappings[prefix]);
      return join(localBasePath, newPath);
    }
  }
  return join(localBasePath, etherscanPath);
}
