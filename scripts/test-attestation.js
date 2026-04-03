require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const { EAS, SchemaEncoder } = require('@ethereum-attestation-service/eas-sdk');
const { ethers } = require('ethers');

const EAS_ADDRESS = '0x4200000000000000000000000000000000000021';
const RPC_URL = process.env.WORLD_CHAIN_SEPOLIA_RPC || 'https://worldchain-sepolia.g.alchemy.com/public';

async function main() {
  const privateKey = process.env.ATTESTATION_PRIVATE_KEY;
  const schemaUID = process.env.DIAGNOSTIC_ORDER_SCHEMA_UID;

  if (!privateKey || !schemaUID) {
    console.error('Missing ATTESTATION_PRIVATE_KEY or DIAGNOSTIC_ORDER_SCHEMA_UID in .env.local');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL, { name: 'world-chain-sepolia', chainId: 4801 });
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('Wallet:', wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  const eas = new EAS(EAS_ADDRESS);
  eas.connect(wallet);

  const schemaEncoder = new SchemaEncoder(
    'bytes32 orderHash, address facilityAddress, string facilityENS, bytes32 patientIdHash, string testType, uint256 timestamp'
  );

  const encodedData = schemaEncoder.encodeData([
    { name: 'orderHash', value: ethers.keccak256(ethers.toUtf8Bytes('test-order-001')), type: 'bytes32' },
    { name: 'facilityAddress', value: '0x0000000000000000000000000000000000000001', type: 'address' },
    { name: 'facilityENS', value: 'stlukes.pisgah.eth', type: 'string' },
    { name: 'patientIdHash', value: ethers.keccak256(ethers.toUtf8Bytes('test-patient-amara')), type: 'bytes32' },
    { name: 'testType', value: 'Complete Blood Count (CBC)', type: 'string' },
    { name: 'timestamp', value: BigInt(Math.floor(Date.now() / 1000)), type: 'uint256' },
  ]);

  console.log('Issuing test attestation...');
  const tx = await eas.attest({
    schema: schemaUID,
    data: {
      recipient: ethers.ZeroAddress,
      expirationTime: 0n,
      revocable: false,
      data: encodedData,
    },
  });

  console.log('Waiting for confirmation...');
  const uid = await tx.wait();
  console.log(`\nAttestation UID: ${uid}`);
  console.log(`Verify on Worldscan: https://sepolia.worldscan.org/attestation/${uid}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
