# Pisgah — Integration Details

Technical breakdown of how each sponsor technology is used, security implications, and architecture decisions.

## Why this matters

Nigeria processes 150 to 250 million diagnostic tests annually across 34,000+ facilities. 80 to 90 percent of these facilities are paper-based. The patient journey is broken at every step:

- **Mixed-up results kill people.** 10 to 25 percent of lab samples are mislabelled, lost, or transcribed incorrectly. Patients receive wrong diagnoses, wrong medications, wrong blood types. There is no audit trail to catch it.
- **Patients abandon the process.** 20 to 30 percent of outpatients never return for their results because they can't afford another trip, lost wages, or transport costs. Treatable conditions deteriorate into emergencies or death.
- **Prescriptions are easily faked.** Handwritten slips can be photocopied, reused, or handed to unqualified chemists. There is no way to verify if a prescription was really issued by a doctor or if the pharmacy filling it is legitimate.
- **No one can verify who is real.** Patients have no way to check if a facility, doctor, or pharmacy is registered and verified. Quackery thrives because there is no public trust layer.
- **Records don't follow patients.** Switch hospitals and you start from zero. No system connects diagnostic history across facilities.

Each integration in Pisgah directly addresses one or more of these problems:

| Problem | What solves it |
|---------|---------------|
| Mixed-up results, no audit trail | **EAS attestations** create permanent on-chain proof of who uploaded what, when |
| Patients can't verify facilities are real | **ENS subnames** give every facility a public, verifiable identity anyone can check |
| Prescription fraud and reuse | **World ID** gates the delivery code so only the verified patient can reveal it. One-time codes prevent reuse |
| Unauthorized access to medical records | **World ID scoped proofs** mean viewing results and accessing the delivery code require separate verifications |
| No way to trust the AI assistant | **AgentKit** proves a real human backs the assistant and every draft request is cryptographically signed |
| Staff access is uncontrolled | **Dynamic** provides role-based auth so each staff member sees only what their role allows |
| Patients have no digital access to their journey | **MiniKit** lets patients access everything inside World App with wallet-based auth, no passwords |
| Records don't follow patients across facilities | **Portable patient records** (future) will use the diagnostic data already flowing through Pisgah |

---

## Dynamic (Provider Auth)

We use the JavaScript SDK (`@dynamic-labs-sdk/client`), not the React SDK. We built a fully custom email OTP login flow with no pre-built UI widgets. The flow calls `sendEmailOTP` and `verifyOTP` directly, giving us complete control over the auth experience.

On the backend, JWTs are verified against Dynamic's JWKS endpoint using the `jose` library (RS256). The JWT's `sub` claim (Dynamic user ID) is mapped to a `facilityUsers` record in our database, which determines the user's role and facility access.

Six roles are enforced through middleware and server actions: doctor, accounts, lab tech, pharmacist, rider, admin. Each role sees only the routes and data relevant to their job.

**Key files:**
- `src/lib/auth/dynamic-client.ts` — SDK initialization (singleton)
- `src/app/login/login-client.tsx` — Custom email OTP login flow
- `src/lib/auth/dynamic.ts` — JWT verification via JWKS
- `src/app/api/provider/session/route.ts` — Session bootstrap
- `src/app/api/provider/claim-invite/route.ts` — Staff invite claiming

**Security notes:**
- The JS SDK hydrates stale user state from localStorage on init. We call `logout()` immediately after creating the client to clear stale sessions and prevent `verifyOTP` from hitting the wrong API endpoint.
- Provider sessions are signed JWTs (HS256) with 12-hour expiry, stored as httpOnly cookies.

---

## MiniKit (Patient Auth)

Patients access Pisgah through World App as a Mini App. Authentication uses MiniKit's `walletAuth` command, which triggers a SIWE (Sign-In with Ethereum) signature from the patient's World App wallet.

The backend verifies the SIWE message and signature, then creates a patient session (7-day JWT cookie). Patients don't create accounts or passwords — their wallet address is their identity.

Patients reach the app through a claim link sent by email when a doctor creates an order. The link format is `https://world.org/mini-app?app_id={appId}&path=/mini/claim/{token}`, which opens directly in World App.

**Key files:**
- `src/app/(patient)/mini/providers.tsx` — MiniKit provider wrapper
- `src/app/(patient)/mini/claim/[token]/claim-client.tsx` — Wallet auth claim flow
- `src/app/api/auth/wallet-verify/route.ts` — SIWE verification

---

## World ID (Identity Verification)

World ID gates two sensitive moments in the patient journey:

1. **Viewing lab results** — action: `view-result`, scoped to the specific order
2. **Revealing the delivery code** — action: `redeem-prescription`, scoped to the specific prescription

Each action produces its own cryptographic proof with a unique nullifier hash. A proof for `view-result` cannot unlock `redeem-prescription`. This prevents someone with temporary phone access from intercepting medication.

Verification uses `IDKitRequestWidget` from `@worldcoin/idkit`. The backend signs the request context using `WORLD_SIGNING_KEY` (never exposed client-side) and verifies the proof via `POST https://developer.worldcoin.org/api/v4/verify/{rp_id}`.

Verified proofs are stored in a `worldIdVerifications` table with the nullifier hash, action, and linked entity (order or prescription) for replay protection.

**Key files:**
- `src/app/(patient)/mini/patient-mini-client.tsx` — Verification UI gates
- `src/app/api/world/verify-result-access/route.ts` — Result verification endpoint
- `src/app/api/world/verify-prescription-redemption/route.ts` — Prescription verification endpoint
- `src/lib/world/idkit.ts` — Request signing and proof verification

---

## AgentKit (AI Clinic Assistant)

The AI assistant is not a generic wrapper around an LLM. It is a real AgentKit agent with its own Ethereum wallet registered in AgentBook on World Chain. A verified human (the hospital admin) backed it during registration by scanning a QR code with World App and proving their World ID.

**How it works on every draft request:**

1. The agent wallet signs a CAIP-122 (SIWE) message with a fresh nonce
2. The signature is base64-encoded into an AgentKit header
3. The server parses the header, validates the message structure, and verifies the signature
4. The server calls `AgentBook.lookupHuman(agentAddress)` on World Chain to confirm a real human backs this agent
5. If all checks pass, the server calls Claude Sonnet to generate a clinical draft
6. If any check fails, no draft is generated (fail-closed)

The agent also has its own ENS identity (`assistant.{clinic}.pisgah.eth`) with text records:
- `pisgah.agent.type`: clinic-assistant
- `pisgah.agent.role`: draft-summaries, route-followups
- `pisgah.agent.facility`: {clinic}.pisgah.eth
- `pisgah.agent.verified`: true
- `pisgah.agent.supervised_by`: Hospital Admin

Per-hospital agent private keys are encrypted with AES-256-GCM using the server's session secret before storage. No plaintext keys in the database.

**Key files:**
- `src/lib/agent/signer.ts` — CAIP-122 message signing and AgentBook verification
- `src/lib/agent/generate-verified-draft.ts` — Full verification pipeline + Claude draft generation
- `src/lib/ai/generate-draft.ts` — Claude Sonnet API call
- `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt for agent keys

---

## ENS (Facility and Agent Identity)

Every facility and agent in the Pisgah network has a verifiable ENS subname under `pisgah.eth` on Ethereum mainnet. Names are provisioned gaslessly via NameStone's off-chain resolver (CCIP-Read / ERC-3668).

**During hospital onboarding, the system automatically:**
1. Generates a wallet for each facility (clinic, lab, pharmacy)
2. Provisions an ENS subname via NameStone SDK (`ns.setName`)
3. Sets text records with facility metadata (type, state, LGA, verification status)
4. Provisions an agent subname (`assistant.{clinic}.pisgah.eth`) with agent-specific text records
5. Stores the agent private key encrypted in the database

**Resolution** uses the NameStone public API (`namestone.xyz/api/public_v1/get-names`) instead of on-chain RPC calls. We switched to this approach after hitting persistent rate limits (HTTP 429) on the default Ethereum public RPC when resolving via viem's CCIP-Read.

**Public verification** — anyone can visit `/verify/{ensName}` to inspect a facility's ENS identity, type, location, wallet address, and verification status without logging in. This turns ENS into a public trust layer for healthcare.

**Key files:**
- `src/lib/ens/provision.ts` — Facility and agent ENS provisioning via NameStone
- `src/lib/ens/verify-agent.ts` — Agent ENS verification via NameStone public API
- `src/lib/ens/runtime.ts` — ENS metadata resolution (NameStone public API for pisgah.eth, on-chain fallback for others)
- `src/app/verify/[ensName]/page.tsx` — Public facility verification page

---

## EAS — Ethereum Attestation Service (On-Chain Provenance)

Three attestation schemas are registered on World Chain Sepolia (EAS predeploy at `0x4200000000000000000000000000000000000021`):

**Lab Result Provenance:**
```
bytes32 resultHash, bytes32 orderHash, address labAddress, string labENS, bytes32 patientIdHash, uint256 timestamp
```

**Prescription Issuance:**
```
bytes32 prescriptionHash, bytes32 orderHash, address doctorAddress, string facilityENS, bytes32 patientIdHash, uint256 timestamp
```

**Delivery Confirmation:**
```
bytes32 orderHash, address facilityAddress, string facilityENS, bytes32 patientIdHash, string testType, uint256 timestamp
```

All sensitive data (result content, patient ID, order ID) is hashed with keccak256 before being included in the attestation. No medical data is stored on-chain.

Attestations are fired asynchronously using Next.js `after()` so they don't block the UI response. The returned attestation UID is stored in the database and displayed in the app as a clickable link to `worldchain-sepolia.easscan.org/attestation/view/{UID}`.

**Key files:**
- `src/lib/attestations/eas.ts` — `attestLabResult`, `attestPrescription`, `attestDelivery`

**Schema UIDs (World Chain Sepolia):**
- Diagnostic Order: `0x13d80fccb2fbac2bca1a4923356c4239b5a26e5cb09840dcb53fb415ea1f39c1`
- Lab Result: `0xf8d8d49670ee8e679b9c67f50846c46146f4ab90ade599e5d8f02ded24ac7dc8`
- Prescription: `0x54d114146b14294d1044196d698ecf4bf80c1882d02d7e1f1b0323632e1cffda`
