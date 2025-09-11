/**
 * Normalizes line endings in a string to LF (\n).
 * @param text The input string.
 * @returns The normalized string.
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}
