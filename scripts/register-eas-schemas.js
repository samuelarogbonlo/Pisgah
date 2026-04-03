require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const { SchemaRegistry } = require('@ethereum-attestation-service/eas-sdk');
const { ethers } = require('ethers');

const SCHEMA_REGISTRY_ADDRESS = '0x4200000000000000000000000000000000000020';
const RPC_URL = process.env.WORLD_CHAIN_SEPOLIA_RPC || 'https://worldchain-sepolia.g.alchemy.com/public';
const ZERO_ADDRESS = ethers.ZeroAddress;

const SCHEMAS = [
  {
    name: 'DIAGNOSTIC_ORDER_SCHEMA_UID',
    schema: 'bytes32 orderHash, address facilityAddress, string facilityENS, bytes32 patientIdHash, string testType, uint256 timestamp',
  },
  {
    name: 'LAB_RESULT_SCHEMA_UID',
    schema: 'bytes32 resultHash, bytes32 orderHash, address labAddress, string labENS, bytes32 patientIdHash, uint256 timestamp',
  },
  {
    name: 'PRESCRIPTION_SCHEMA_UID',
    schema: 'bytes32 prescriptionHash, bytes32 orderHash, address doctorAddress, string facilityENS, bytes32 patientIdHash, uint256 timestamp',
  },
];

// Schema UIDs are deterministic: keccak256(abi.encodePacked(schema, resolverAddress, revocable))
function computeSchemaUID(schema, resolverAddress, revocable) {
  const encoded = ethers.solidityPacked(
    ['string', 'address', 'bool'],
    [schema, resolverAddress, revocable]
  );
  return ethers.keccak256(encoded);
}

async function main() {
  const privateKey = process.env.ATTESTATION_PRIVATE_KEY;
  if (!privateKey) {
    console.error('Missing ATTESTATION_PRIVATE_KEY in .env.local');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL, { name: 'world-chain-sepolia', chainId: 4801 });
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('Wallet address:', wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  const schemaRegistry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
  schemaRegistry.connect(wallet);

  const results = [];

  for (const { name, schema } of SCHEMAS) {
    const uid = computeSchemaUID(schema, ZERO_ADDRESS, false);
    console.log(`Registering: ${name}`);
    console.log(`  Schema: ${schema}`);
    console.log(`  Expected UID: ${uid}`);

    try {
      const tx = await schemaRegistry.register({
        schema,
        resolverAddress: ZERO_ADDRESS,
        revocable: false,
      });

      console.log(`  Waiting for confirmation...`);
      await tx.wait();
      console.log(`  Confirmed!\n`);
      results.push({ name, uid });
    } catch (err) {
      // 0x23369fa6 is the AlreadyExists() custom error selector
      if (err.data === '0x23369fa6' || (err.message && err.message.includes('0x23369fa6'))) {
        console.log(`  Schema already registered, using computed UID.\n`);
        results.push({ name, uid });
      } else {
        console.error(`  Failed to register ${name}:`, err.message);
        process.exit(1);
      }
    }
  }

  console.log('='.repeat(60));
  console.log('Add these to your .env.local:\n');
  for (const { name, uid } of results) {
    console.log(`${name}=${uid}`);
  }
  console.log('\n' + '='.repeat(60));
  console.log('Done! All 3 schemas registered on World Chain Sepolia.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
