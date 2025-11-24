import { bold, gray } from "jsr:@std/fmt/colors";
import { ContractSources, Network } from "./types.ts";

/**
 * Fetches the verified source code of a contract from the BlockScout API.
 * @param contractAddress The address of the smart contract to verify.
 * @param chainId The ID of the target chain.
 * @returns The full details of the contract, if available.
 */
export async function fetchSources(
  contractAddress: string,
  networkData: Network,
): Promise<ContractSources> {
  console.log(gray(`Fetching sources for ${bold(contractAddress)}...`));

  const endpoint = `${networkData.urlPrefix}/v2/smart-contracts/${contractAddress}`;

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const data = await response.json();

  return parseVerifiedSources(contractAddress, data);
}

/**
 * Parses the source code from BlockScout, which can be a single file
 * or a JSON object for multi-file verification.
 * @param apiResult The result from the BlockScout API.
 * @returns An object containing the file paths to their content as well as the deployed address.
 */
function parseVerifiedSources(
  contractAddress: string,
  apiResult: BlockScoutContractResponse,
): ContractSources {
  if (!apiResult.source_code || !apiResult.abi?.length) {
    throw new Error("The contract is not verified or does not exist");
  }

  if (apiResult.implementations?.length) {
    console.log(
      gray(
        `[Implementation at ${bold(apiResult.implementations[0].address)}]\n`,
      ),
    );
  }

  const result: ContractSources = {
    address: contractAddress,
    sources: {
      [apiResult.file_path]: apiResult.source_code,
    },
  };

  for (const dependency of apiResult.additional_sources) {
    result.sources[dependency.file_path] = dependency.source_code;
  }

  return result;
}

// Response types

type BlockScoutContractResponse = {
  /** Main file path */
  file_path: string;
  /** Main file source */
  source_code: string;
  /** Main file bytecode */
  deployed_bytecode: string;
  /** Source of the dependencies */
  additional_sources: Array<{ file_path: string; source_code: string }>;
  /** The ABI of the contract */
  abi: Array<any>;
  is_self_destructed: boolean;
  optimization_enabled: boolean;
  verified_twin_address_hash: null | string;
  is_verified: boolean;
  compiler_settings: {
    evmVersion: string;
    libraries: { [k: string]: any };
    metadata: {
      appendCBOR: boolean;
      bytecodeHash: string;
      useLiteralContent: boolean;
    };
    optimizer: {
      enabled: boolean;
      runs: number;
    };
    outputSelection: {
      "*": { [k: string]: Array<string> };
    };
    remappings: Array<string>;
    viaIR: boolean;
  };
  optimization_runs: number;
  sourcify_repo_url: null;
  decoded_constructor_args: null;
  compiler_version: string;
  is_verified_via_verifier_alliance: boolean;
  verified_at: string;
  implementations: [
    {
      address: string;
      address_hash: string;
      name: string;
    },
  ];
  proxy_type?: "eip1967";
  external_libraries: [];
  status: "success";
  creation_bytecode: null;
  /** Main contract name */
  name: string;
  is_blueprint: boolean;
  license_type: string;
  is_fully_verified: boolean;
  is_verified_via_eth_bytecode_db: boolean;
  language: "solidity";
  evm_version: string;
  can_be_visualized_via_sol2uml: boolean;
  is_verified_via_sourcify: boolean;
  certified: boolean;
  is_changed_bytecode: boolean;
  is_partially_verified: boolean;
  constructor_args: null | string;
};
