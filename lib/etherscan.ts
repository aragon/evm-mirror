import { red, bold, gray } from "jsr:@std/fmt/colors";
import { ETHERSCAN_ENDPOINTS } from "./constants.ts";
import {
  EtherscanSourceResult,
  EtherscanSoliditySourceEntries,
} from "./types.ts";

/**
 * Fetches the verified source code for a contract from the Etherscan API.
 * @param contractAddress The address of the smart contract to verify.
 * @param chainId The ID of the target chain.
 * @param apiKey The Etherscan API key.
 * @returns The full details of the contract, if available.
 */
export async function fetchContractSource(
  contractAddress: string,
  chainId: keyof typeof ETHERSCAN_ENDPOINTS,
  apiKey: string = "",
): Promise<EtherscanSourceResult> {
  const endpoint = ETHERSCAN_ENDPOINTS[chainId];
  if (!endpoint) {
    throw new Error("Unsupported chain ID: " + chainId);
  } else if (endpoint.requiresApiKey && !apiKey) {
    throw new Error("An API key is required for chain ID " + chainId);
  }

  console.log(gray(`Fetching sources for ${bold(contractAddress)}...`));

  const url = `${endpoint.urlPrefix}&address=${contractAddress}&apikey=${apiKey}`;

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
  if (
    !sourceCode ||
    sourceResult.ABI?.trim() === "Contract source code not verified"
  ) {
    throw new Error("The contract source is not verified");
  }

  const result = new Map<string, string>();

  if (sourceCode.startsWith("{{") && sourceCode.endsWith("}}")) {
    // Standard JSON-Input format
    sourceCode = sourceCode.slice(1, -1); // Remove the outer braces

    try {
      const jsonInput: EtherscanSoliditySourceEntries = JSON.parse(sourceCode);
      if (jsonInput.sources) {
        for (const path in jsonInput.sources) {
          result.set(path, jsonInput.sources[path].content);
        }
      }
    } catch (error) {
      console.error(red("Failed to parse Solidity JSON-Input:"), error);
      // Fallback for single files with weird formats
      result.set(`${sourceResult.ContractName}.sol`, sourceCode);
    }
  } else {
    // Single file source
    result.set(`${sourceResult.ContractName}.sol`, sourceCode);
  }

  return result;
}
