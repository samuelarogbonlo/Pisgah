import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";

const EAS_ADDRESS = "0x4200000000000000000000000000000000000021";
const LAB_RESULT_SCHEMA =
  "bytes32 resultHash, bytes32 orderHash, address labAddress, string labENS, bytes32 patientIdHash, uint256 timestamp";
const PRESCRIPTION_SCHEMA =
  "bytes32 prescriptionHash, bytes32 orderHash, address doctorAddress, string facilityENS, bytes32 patientIdHash, uint256 timestamp";
const DIAGNOSTIC_ORDER_SCHEMA =
  "bytes32 orderHash, address facilityAddress, string facilityENS, bytes32 patientIdHash, string testType, uint256 timestamp";

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

export async function attestPrescription(params: {
  orderId: string;
  patientId: string;
  prescriptionItems: unknown;
  doctorAddress: string | null | undefined;
  facilityEns: string | null | undefined;
}): Promise<string> {
  const schemaUid = process.env.PRESCRIPTION_SCHEMA_UID;
  if (!schemaUid) {
    throw new Error("Missing PRESCRIPTION_SCHEMA_UID");
  }

  const wallet = getAttestationWallet();
  const eas = new EAS(EAS_ADDRESS);
  eas.connect(wallet);

  const encoder = new SchemaEncoder(PRESCRIPTION_SCHEMA);
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const prescriptionHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(params.prescriptionItems)),
  );
  const orderHash = ethers.keccak256(ethers.toUtf8Bytes(params.orderId));
  const patientIdHash = ethers.keccak256(ethers.toUtf8Bytes(params.patientId));

  const encodedData = encoder.encodeData([
    { name: "prescriptionHash", value: prescriptionHash, type: "bytes32" },
    { name: "orderHash", value: orderHash, type: "bytes32" },
    {
      name: "doctorAddress",
      value:
        params.doctorAddress && ethers.isAddress(params.doctorAddress)
          ? params.doctorAddress
          : ethers.ZeroAddress,
      type: "address",
    },
    { name: "facilityENS", value: params.facilityEns ?? "", type: "string" },
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

export async function attestDelivery(params: {
  orderId: string;
  patientId: string;
  pharmacyAddress: string | null | undefined;
  pharmacyEns: string | null | undefined;
}): Promise<string> {
  const schemaUid = process.env.DIAGNOSTIC_ORDER_SCHEMA_UID;
  if (!schemaUid) {
    throw new Error("Missing DIAGNOSTIC_ORDER_SCHEMA_UID");
  }

  const wallet = getAttestationWallet();
  const eas = new EAS(EAS_ADDRESS);
  eas.connect(wallet);

  const encoder = new SchemaEncoder(DIAGNOSTIC_ORDER_SCHEMA);
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const orderHash = ethers.keccak256(ethers.toUtf8Bytes(params.orderId));
  const patientIdHash = ethers.keccak256(ethers.toUtf8Bytes(params.patientId));

  const encodedData = encoder.encodeData([
    { name: "orderHash", value: orderHash, type: "bytes32" },
    {
      name: "facilityAddress",
      value:
        params.pharmacyAddress && ethers.isAddress(params.pharmacyAddress)
          ? params.pharmacyAddress
          : ethers.ZeroAddress,
      type: "address",
    },
    { name: "facilityENS", value: params.pharmacyEns ?? "", type: "string" },
    { name: "patientIdHash", value: patientIdHash, type: "bytes32" },
    { name: "testType", value: "delivery-confirmation", type: "string" },
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
