import { red, bold, gray } from "jsr:@std/fmt/colors";
import { ContractSources, Network } from "./types.ts";

/**
 * Fetches the verified source code of a contract from the Etherscan API.
 * @param contractAddress The address of the smart contract to verify.
 * @param chainId The ID of the target chain.
 * @param apiKey The Etherscan API key.
 * @returns The full details of the contract, if available.
 */
export async function fetchSources(
  contractAddress: string,
  networkData: Network,
  apiKey: string = "",
): Promise<ContractSources> {
  if (networkData.requiresApiKey && !apiKey) {
    throw new Error(
      "An API key is required for chain ID " + networkData.chainId,
    );
  }

  console.log(gray(`Fetching sources for ${bold(contractAddress)}...`));

  const url = `${networkData.urlPrefix}&address=${contractAddress}&apikey=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const data = await response.json();
  if (data.status !== "1") {
    throw new Error(`Etherscan API Error: ${data.message} - ${data.result}`);
  }

  return parseVerifiedSources(contractAddress, data.result[0]);
}

/**
 * Parses the source code from Etherscan, which can be a single file
 * or a JSON object for multi-file verification.
 * @param sourceResult The result from the Etherscan API.
 * @returns An object containing the file paths to their content as well as the deployed address.
 */
function parseVerifiedSources(
  contractAddress: string,
  sourceResult: EtherscanVerifiedContract,
): ContractSources {
  let sourceCode = sourceResult.SourceCode;
  if (
    !sourceCode ||
    sourceResult.ABI?.trim() === "Contract source code not verified"
  ) {
    throw new Error("The contract is not verified or does not exist");
  }

  const result: ContractSources = {
    address: contractAddress,
    sources: {},
  };

  if (sourceCode.startsWith("{{") && sourceCode.endsWith("}}")) {
    // Standard JSON-Input format
    sourceCode = sourceCode.slice(1, -1); // Remove the outer braces

    try {
      const jsonInput: EtherscanSourceSet = JSON.parse(sourceCode);
      if (jsonInput.sources) {
        for (const path in jsonInput.sources) {
          result.sources[path] = jsonInput.sources[path].content;
        }
      }
    } catch (error) {
      console.error(red("Failed to parse Solidity JSON-Input:"), error);
      // Fallback for single files with weird formats
      result.sources[`${sourceResult.ContractName}.sol`] = sourceCode;
    }
  } else {
    // Single file source
    result.sources[`${sourceResult.ContractName}.sol`] = sourceCode;
  }

  return result;
}

// Response types

type EtherscanVerifiedContract = {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string; // "v0.8.17+commit.8df45f5f"
  CompilerType: string; // "solc-j"
  OptimizationUsed: string; // "1"
  Runs: string; // "2000"
  ConstructorArguments: string; // ""
  EVMVersion: string; // "Default"
  Library: string; // ""
  ContractFileName: string; // "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol"
  LicenseType: string; // ""
  Proxy: string; // "1"
  Implementation: string; // "0xced33df91ac49415c74bf1b5c218b83a2b8c2f3c"
  SwarmSource: string; // ""
  SimilarMatch: string; // "0xE640Da5AD169630555A86D9b6b9C145B4961b1EB
};

type EtherscanSourceSet = {
  language: "Solidity";
  sources: {
    [key: string]: {
      content: string;
    };
  };
};
