import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";

const EAS_ADDRESS = "0x4200000000000000000000000000000000000021";
const LAB_RESULT_SCHEMA =
  "bytes32 resultHash, bytes32 orderHash, address labAddress, string labENS, bytes32 patientIdHash, uint256 timestamp";

function getProvider() {
  return new ethers.JsonRpcProvider(
    process.env.WORLD_CHAIN_SEPOLIA_RPC || "https://worldchain-sepolia.g.alchemy.com/public",
    { name: "world-chain-sepolia", chainId: 4801 },
  );
}

function getAttestationWallet() {
  const privateKey = process.env.ATTESTATION_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing ATTESTATION_PRIVATE_KEY");
  }

  return new ethers.Wallet(privateKey, getProvider());
}

export async function attestLabResult(params: {
  orderId: string;
  patientId: string;
  rawText: string;
  labAddress: string | null | undefined;
  labEns: string | null | undefined;
}) {
  const schemaUid = process.env.LAB_RESULT_SCHEMA_UID;
  if (!schemaUid) {
    throw new Error("Missing LAB_RESULT_SCHEMA_UID");
  }

  const wallet = getAttestationWallet();
  const eas = new EAS(EAS_ADDRESS);
  eas.connect(wallet);

  const encoder = new SchemaEncoder(LAB_RESULT_SCHEMA);
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const resultHash = ethers.keccak256(ethers.toUtf8Bytes(params.rawText));
  const orderHash = ethers.keccak256(ethers.toUtf8Bytes(params.orderId));
  const patientIdHash = ethers.keccak256(ethers.toUtf8Bytes(params.patientId));

  const encodedData = encoder.encodeData([
    { name: "resultHash", value: resultHash, type: "bytes32" },
    { name: "orderHash", value: orderHash, type: "bytes32" },
    {
      name: "labAddress",
      value:
        params.labAddress && ethers.isAddress(params.labAddress)
          ? params.labAddress
          : ethers.ZeroAddress,
      type: "address",
    },
    { name: "labENS", value: params.labEns ?? "", type: "string" },
    { name: "patientIdHash", value: patientIdHash, type: "bytes32" },
    { name: "timestamp", value: timestamp, type: "uint256" },
  ]);

  const tx = await eas.attest({
    schema: schemaUid,
    data: {
      recipient: ethers.ZeroAddress,
      expirationTime: 0n,
      revocable: false,
      data: encodedData,
    },
  });

  return tx.wait();
}
