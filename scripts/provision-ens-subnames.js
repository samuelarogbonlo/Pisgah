require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const NameStone = require('@namestone/namestone-sdk').default || require('@namestone/namestone-sdk');
const { privateKeyToAccount } = require('viem/accounts');

const DOMAIN = 'pisgah.eth';

function getAgentAddress() {
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key) {
    console.warn('AGENT_PRIVATE_KEY not found, using placeholder for assistant.stlukes');
    return '0x0000000000000000000000000000000000000004';
  }
  const account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`);
  return account.address;
}

const SUBNAMES = [
  {
    name: 'stlukes',
    address: '0x0000000000000000000000000000000000000001',
    text_records: {
      description: "St. Luke's Clinic, Victoria Island Lagos",
      'pisgah.facility.type': 'clinic',
      'pisgah.facility.capabilities': 'general-practice,outpatient-diagnostics',
      'pisgah.facility.hours': 'Mon-Fri 08:00-18:00, Sat 09:00-13:00',
      'pisgah.facility.state': 'Lagos',
      'pisgah.facility.lga': 'Eti-Osa',
      'pisgah.facility.license': 'FMOH-CLI-2026-5678',
      'pisgah.facility.verified': 'true',
    },
  },
  {
    name: 'sunshinelab',
    address: '0x0000000000000000000000000000000000000002',
    text_records: {
      description: 'Sunshine Diagnostics Lab, Ikeja Lagos',
      'pisgah.facility.type': 'laboratory',
      'pisgah.facility.capabilities': 'blood-work,urinalysis,malaria-rdts,liver-function,renal-function',
      'pisgah.facility.hours': 'Mon-Fri 07:00-19:00, Sat 08:00-14:00',
      'pisgah.facility.state': 'Lagos',
      'pisgah.facility.lga': 'Ikeja',
      'pisgah.facility.license': 'FMOH-LAB-2026-1234',
      'pisgah.facility.verified': 'true',
    },
  },
  {
    name: 'greenleaf',
    address: '0x0000000000000000000000000000000000000003',
    text_records: {
      description: 'GreenLeaf Pharmacy, Lekki Lagos',
      'pisgah.facility.type': 'pharmacy',
      'pisgah.facility.capabilities': 'prescription-dispensing,otc,delivery',
      'pisgah.facility.hours': 'Mon-Sat 08:00-21:00, Sun 10:00-16:00',
      'pisgah.facility.state': 'Lagos',
      'pisgah.facility.lga': 'Eti-Osa',
      'pisgah.facility.license': 'PCN-PHARM-2026-9012',
      'pisgah.facility.verified': 'true',
    },
  },
  {
    name: 'assistant.stlukes',
    address: null, // set dynamically below
    text_records: {
      description: "Pisgah Clinic Assistant for St. Luke's Clinic",
      'pisgah.agent.type': 'clinic-assistant',
      'pisgah.agent.role': 'draft-summaries,route-followups',
      'pisgah.agent.facility': 'stlukes.pisgah.eth',
      'pisgah.agent.supervised_by': 'Dr. Adeyemi',
      'pisgah.agent.verified': 'true',
    },
  },
];

async function main() {
  const apiKey = process.env.NAMESTONE_API_KEY;
  if (!apiKey) {
    console.error('Missing NAMESTONE_API_KEY in .env.local');
    process.exit(1);
  }

  const agentAddress = getAgentAddress();
  SUBNAMES[3].address = agentAddress;

  console.log(`Agent wallet address: ${agentAddress}`);
  console.log(`Provisioning ${SUBNAMES.length} subnames under ${DOMAIN}\n`);

  const ns = new NameStone(apiKey);

  for (const { name, address, text_records } of SUBNAMES) {
    const fullName = `${name}.${DOMAIN}`;
    console.log(`Provisioning: ${fullName}`);
    console.log(`  Address: ${address}`);

    try {
      await ns.setName({
        name,
        domain: DOMAIN,
        address,
        text_records,
      });
      console.log(`  ✓ Success\n`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message || JSON.stringify(err)}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log('ENS subnames provisioned:');
  for (const { name } of SUBNAMES) {
    console.log(`  ${name}.${DOMAIN}`);
  }
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
