import { red, yellow } from "https://deno.land/std@0.224.0/fmt/colors.ts";
import { Remappings } from "./types.ts";
import { normalizeLineEndings } from "./text.ts";

/**
 * Loads the remappings file and returns it as a key-value record.
 * @param path Path to the remappings.txt file
 * @returns A key-value object for each alias.
 */
export async function loadRemappings(
  remappingsFile: string,
): Promise<Remappings> {
  try {
    const content = await Deno.readTextFile(remappingsFile);
    const entries = normalizeLineEndings(content).split("\n");

    const result = {} as Remappings;
    for (const entry of entries) {
      if (!entry.trim()) continue;
      else if (entry.indexOf("=") < 1) continue;

      const [alias, newPath] = entry.split("=");
      if (!alias || !newPath) {
        console.warn(
          yellow(
            `Warning: skipping invalid line ${entry} from ${remappingsFile}`,
          ),
        );
        continue;
      }
      result[alias.trim()] = newPath.trim();
    }

    return result;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log(
        `${yellow("Warning: " + remappingsFile + " could not be found")}`,
      );
      return {};
    } else {
      console.error(red(`Error reading local file ${remappingsFile}:`), error);
    }
    throw error;
  }
}
