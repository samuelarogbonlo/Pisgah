# Pisgah

Verified diagnostic workflows from lab to delivery, on-chain.

**Live:** [pisgah.vercel.app](https://pisgah.vercel.app)

## What it does

Pisgah coordinates the entire diagnostic journey: doctor orders a test, lab uploads results, AI drafts a clinical summary, doctor reviews and prescribes, pharmacy dispatches, rider delivers, patient confirms. Every step is attested on World Chain. Every facility has a verifiable ENS identity. Patient access is gated by World ID.

## Tech stack

- **Framework:** Next.js 16, TypeScript, Tailwind CSS
- **Database:** Neon Postgres, Drizzle ORM
- **Auth:** Dynamic JavaScript SDK (providers), MiniKit walletAuth (patients)
- **Identity:** World ID verification, ENS subnames via NameStone
- **AI:** Claude Sonnet via Vercel AI SDK, AgentKit verified assistant
- **On-chain:** EAS attestations on World Chain Sepolia
- **Deploy:** Vercel

## Sponsor integrations

| Sponsor | Usage |
|---------|-------|
| Dynamic | Custom email OTP auth, JWT verification, role-based access |
| World (MiniKit) | Patient wallet auth inside World App |
| World (World ID) | Identity verification for viewing results and redeeming prescriptions |
| World (AgentKit) | Human-backed AI assistant registered in AgentBook |
| World (EAS) | On-chain attestations for lab results, prescriptions, deliveries |
| ENS | Facility and agent identity subnames under pisgah.eth |

## Try it out

- **Provider dashboard:** [pisgah.vercel.app](https://pisgah.vercel.app)
- **Verify a facility:** [pisgah.vercel.app/verify/penthouse-clinic.pisgah.eth](https://pisgah.vercel.app/verify/penthouse-clinic.pisgah.eth)

## Contributing

Contributions are welcome. Fork the repo, create a branch, and open a pull request. For major changes, open an issue first to discuss what you'd like to change.
