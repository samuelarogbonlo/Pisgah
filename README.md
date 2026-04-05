# Pisgah

Verified diagnostic workflows from lab to delivery, on-chain.

**Live:** [pisgah.vercel.app](https://pisgah.vercel.app)

## What it does

Pisgah coordinates the entire diagnostic journey. A doctor orders a test, a lab uploads results, an AI assistant drafts a clinical summary, the doctor reviews and prescribes, a pharmacy dispatches, a rider delivers, and the patient confirms receipt. Every step is recorded on-chain. Every facility has a verifiable ENS identity. Patient access is protected by World ID.

## Features

- Self-service hospital onboarding with auto-provisioned ENS names and wallets
- Six staff roles with email-based invites and role-locked workspaces
- Configurable test catalog with pricing
- AI clinical drafts powered by a human-backed AgentKit assistant
- Two-step World ID verification for patients (results and delivery code are gated separately)
- Prescription dispatch and rider delivery with one-time code verification
- Three on-chain attestations per order (lab result, prescription, delivery)
- Public facility verification page at /verify/{ensName}
- Agent identity card showing ENS name, wallet, and AgentBook verification status

## Tooling

| Tool | What it does |
|------|-------------|
| Dynamic JS SDK | Provider login, staff invites, role-based access |
| MiniKit | Patient wallet auth inside World App |
| World ID | Identity verification before viewing results and delivery codes |
| AgentKit | Human-backed AI assistant with signed draft requests |
| ENS + NameStone | Verifiable facility and agent identity subnames |
| EAS on World Chain | On-chain attestations (hashes only, no medical data) |
| Claude Sonnet | AI-generated clinical summaries |
| Next.js 16 | Full-stack framework |
| Neon Postgres + Drizzle | Database and ORM |
| Vercel | Deployment |

For detailed integration architecture and security notes, see [INTEGRATIONS.md](INTEGRATIONS.md).

## What's next

- **Payments:** World Pay for in-app payments that auto-advance the workflow, plus Paystack and OPay for local options
- **Practitioner registry:** A verified, World ID-backed registry of doctors, lab techs, and pharmacists exposed as a public API, so other platforms can check if a practitioner is real and fight quackery
- **Portable patient records:** An API that lets patients carry their diagnostic history across hospitals, with AI flagging longitudinal health trends
- **Guardian access:** Verified family members can act on behalf of minors, elderly, or critically ill patients with clear on-chain boundaries
- **Push notifications:** Real-time updates in World App when results are ready, medication is dispatched, or delivery is confirmed

## Try it out

- **Provider dashboard:** [pisgah.vercel.app](https://pisgah.vercel.app)
- **Verify a facility:** [pisgah.vercel.app/verify/penthouse-clinic.pisgah.eth](https://pisgah.vercel.app/verify/penthouse-clinic.pisgah.eth)

## Contributing

Contributions are welcome. Fork the repo, create a branch, and open a pull request. For major changes, open an issue first to discuss what you'd like to change.
