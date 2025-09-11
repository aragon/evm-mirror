import {
  EtherscanSourceResult,
  EtherscanSoliditySourceEntries,
} from "./types.ts";
import { red, bold, gray } from "https://deno.land/std@0.224.0/fmt/colors.ts";
import { ETHERSCAN_DOMAIN } from "./constants.ts";

/**
 * Fetches the verified source code for a contract from the Etherscan API.
 * @param contractAddress The address of the smart contract verify.
 * @param apiKey The Etherscan API key.
 * @returns The source code and contract name.
 */
export async function fetchContractSource(
  contractAddress: string,
  apiKey: string,
): Promise<EtherscanSourceResult> {
  console.log(gray(`\nFetching source code for ${bold(contractAddress)}...`));
  const url = `https://${ETHERSCAN_DOMAIN}/api?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== "1") {
    throw new Error(`Etherscan API Error: ${data.message} - ${data.result}`);
  }

  return data.result[0];
}

/**
 * Parses the source code from Etherscan, which can be a single file
 * or a JSON object for multi-file verification.
 * @param sourceResult The result from the Etherscan API.
 * @returns A map of file paths to their content.
 */
export function parseSourceCode(
  sourceResult: EtherscanSourceResult,
): Map<string, string> {
  let sourceCode = sourceResult.SourceCode;
  const sources = new Map<string, string>();

  // Check for Standard JSON-Input format
  if (sourceCode.startsWith("{{") && sourceCode.endsWith("}}")) {
    sourceCode = sourceCode.slice(1, -1); // Remove the outer braces
    try {
      const jsonInput: EtherscanSoliditySourceEntries = JSON.parse(sourceCode);
      if (jsonInput.sources) {
        for (const path in jsonInput.sources) {
          sources.set(path, jsonInput.sources[path].content);
        }
      }
    } catch (error) {
      console.error(red("Failed to parse Solidity JSON-Input:"), error);
      // Fallback for weirdly formatted single files
      sources.set(`${sourceResult.ContractName}.sol`, sourceCode);
    }
  } else {
    // Single file
    sources.set(`${sourceResult.ContractName}.sol`, sourceCode);
  }

  return sources;
}
