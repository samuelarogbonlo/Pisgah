import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Fingerprint,
  Brain,
  Globe,
  Users,
  Building2,
  ChevronRight,
} from "lucide-react";

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b border-black/[0.06] bg-white/92 px-6 backdrop-blur-md md:px-12">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-base font-bold tracking-[0.12em] uppercase">
          Pisgah
        </Link>
        <ul className="hidden items-center gap-7 md:flex">
          <li>
            <a href="#how" className="text-[13px] text-neutral-500 transition-colors hover:text-black">
              How it works
            </a>
          </li>
          <li>
            <a href="#features" className="text-[13px] text-neutral-500 transition-colors hover:text-black">
              Features
            </a>
          </li>
          <li>
            <a href="#verification" className="text-[13px] text-neutral-500 transition-colors hover:text-black">
              Verification
            </a>
          </li>
        </ul>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="hidden text-[13px] text-neutral-500 transition-colors hover:text-black sm:block px-4 py-2"
        >
          Sign in
        </Link>
        <Link
          href="/login"
          className="rounded-md bg-black px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
        >
          Onboard hospital
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-3xl px-6 pt-36 pb-20 text-center md:pt-44 md:pb-28">
      <span className="mb-8 inline-block rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-medium tracking-wide uppercase text-neutral-500">
        Built on World Chain
      </span>
      <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-[56px]">
        Verified diagnostics for paper-first clinics
      </h1>
      <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-neutral-500 md:text-lg">
        Every test, every result, every prescription &mdash; cryptographically verified
        and tracked from order to delivery. No paper trail lost again.
      </p>
      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-md bg-black px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          Onboard your hospital
          <ArrowRight className="h-4 w-4" />
        </Link>
        <a
          href="#how"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-200 px-7 py-3 text-sm font-medium text-black transition-colors hover:border-black"
        >
          See how it works
        </a>
      </div>
    </section>
  );
}

function TrustBar() {
  const logos = ["World ID", "EAS", "ENS", "AgentKit", "Claude AI"];
  return (
    <div className="border-y border-neutral-200 py-14 text-center">
      <p className="mb-6 text-xs font-medium tracking-[0.08em] uppercase text-neutral-400">
        Powered by
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 px-6 md:gap-12">
        {logos.map((name) => (
          <span
            key={name}
            className="text-sm font-semibold tracking-wide text-neutral-400"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

const steps = [
  {
    num: "01",
    title: "Order created",
    desc: "Doctor creates a diagnostic order. Patient claims via World App with World ID verification.",
  },
  {
    num: "02",
    title: "Lab processes",
    desc: "Lab receives the order, collects sample, and uploads results. Result attested on-chain via EAS.",
  },
  {
    num: "03",
    title: "AI-assisted review",
    desc: "Claude analyzes results and drafts clinical summary. Doctor reviews, approves, and prescribes.",
  },
  {
    num: "04",
    title: "Verified delivery",
    desc: "Pharmacy prepares medication. Rider delivers with code verification. Delivery attested on-chain.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-5xl border-t border-neutral-200 px-6 py-20 md:py-28">
      <p className="text-xs font-medium tracking-[0.1em] uppercase text-neutral-500">
        How it works
      </p>
      <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
        Four steps. Fully verified.
      </h2>
      <p className="mt-4 max-w-md text-base text-neutral-500 leading-relaxed">
        From the moment a doctor creates an order to the moment a patient receives their medication,
        every step is recorded on-chain.
      </p>
      <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div key={s.num}>
            <span className="text-5xl font-bold leading-none text-neutral-200">
              {s.num}
            </span>
            <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const workflowNodes = [
  "Order",
  "Payment",
  "Lab",
  "AI Draft",
  "Doctor Review",
  "Prescription",
  "Delivery",
];

function WorkflowVisual() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
      <p className="text-xs font-medium tracking-[0.1em] uppercase text-neutral-500">
        The diagnostic journey
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
        Complete audit trail
      </h2>
      {/* Desktop: horizontal */}
      <div className="mt-14 hidden items-center justify-center md:flex">
        {workflowNodes.map((node, i) => (
          <div key={node} className="flex items-center">
            <span
              className={`rounded-md border px-5 py-3 text-[13px] font-medium whitespace-nowrap ${
                node === "AI Draft"
                  ? "border-black bg-black text-white"
                  : "border-neutral-200 bg-white text-black"
              }`}
            >
              {node}
            </span>
            {i < workflowNodes.length - 1 && (
              <ChevronRight className="mx-1 h-4 w-4 shrink-0 text-neutral-400" />
            )}
          </div>
        ))}
      </div>
      {/* Mobile / Tablet: vertical */}
      <div className="mt-14 flex flex-col items-center gap-2 md:hidden">
        {workflowNodes.map((node, i) => (
          <div key={node} className="flex flex-col items-center">
            <span
              className={`w-48 rounded-md border px-5 py-3 text-[13px] font-medium ${
                node === "AI Draft"
                  ? "border-black bg-black text-white"
                  : "border-neutral-200 bg-white text-black"
              }`}
            >
              {node}
            </span>
            {i < workflowNodes.length - 1 && (
              <ChevronRight className="my-1 h-4 w-4 rotate-90 text-neutral-400" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

const features = [
  {
    icon: Shield,
    title: "On-chain attestations",
    desc: "Lab results, prescriptions, and deliveries attested on World Chain via Ethereum Attestation Service.",
  },
  {
    icon: Fingerprint,
    title: "World ID verification",
    desc: "Patients verify identity through World ID to claim results and redeem prescriptions. No shared passwords.",
  },
  {
    icon: Brain,
    title: "AI clinical drafts",
    desc: "Claude analyzes raw lab results and generates structured clinical summaries for doctor review.",
  },
  {
    icon: Globe,
    title: "ENS facility naming",
    desc: "Every clinic, lab, and pharmacy gets a verifiable ENS subname under pisgah.eth.",
  },
  {
    icon: Users,
    title: "Role-based workflows",
    desc: "Doctors, lab techs, pharmacists, riders, and admins each see exactly what they need.",
  },
  {
    icon: Building2,
    title: "Multi-hospital tenancy",
    desc: "Onboard multiple hospitals, each with isolated data, staff, and agent credentials.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-5xl border-t border-neutral-200 px-6 py-20 md:py-28">
      <p className="text-xs font-medium tracking-[0.1em] uppercase text-neutral-500">
        Features
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
        Everything a clinic needs
      </h2>
      <p className="mt-4 max-w-md text-base text-neutral-500 leading-relaxed">
        Purpose-built for healthcare providers transitioning from paper to verified digital workflows.
      </p>
      <div className="mt-14 grid grid-cols-1 divide-y divide-neutral-200 border border-neutral-200 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="border-b border-neutral-200 p-8 last:border-b-0 sm:border-r sm:border-b sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-child(n+4)]:border-b-0 sm:[&:nth-child(n+5)]:border-b-0"
          >
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200">
              <f.icon className="h-5 w-5 text-black" />
            </div>
            <h3 className="text-base font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const stats = [
  { num: "11", label: "Workflow states tracked" },
  { num: "6", label: "Staff roles supported" },
  { num: "3", label: "On-chain attestation types" },
  { num: "100%", label: "Verifiable audit trail" },
];

function Stats() {
  return (
    <section id="verification" className="mx-auto max-w-5xl border-t border-neutral-200 px-6 py-20 md:py-28">
      <div className="grid grid-cols-2 gap-10 text-center lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-4xl font-bold leading-none tracking-tight md:text-5xl">
              {s.num}
            </div>
            <div className="mt-2 text-sm text-neutral-500">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Quote() {
  return (
    <section className="mx-auto max-w-5xl border-t border-neutral-200 px-6 py-20 text-center md:py-28">
      <blockquote className="mx-auto max-w-2xl text-2xl font-normal leading-snug tracking-tight md:text-[28px] md:leading-[1.5]">
        &ldquo;We went from losing paper records weekly to having every diagnostic journey
        cryptographically verified. The trust it builds with patients is invaluable.&rdquo;
      </blockquote>
      <p className="mt-6 text-sm text-neutral-500">
        <strong className="text-black">Dr. Adeyemi</strong> &mdash; Medical Director, Lagos
      </p>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-5xl border-t border-neutral-200 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-3xl rounded-xl bg-black px-8 py-16 text-center text-white md:px-16 md:py-20">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Ready to go verified?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base text-neutral-400 leading-relaxed">
          Onboard your hospital in minutes. No hardware required &mdash; just your team
          and an internet connection.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-white px-7 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          Onboard your hospital
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-5xl border-t border-neutral-200 px-6 pt-16 pb-12">
      <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="text-base font-bold tracking-[0.12em] uppercase">Pisgah</div>
          <p className="mt-3 max-w-[240px] text-sm leading-relaxed text-neutral-500">
            Verified diagnostic workflows for paper-first clinics in emerging markets.
          </p>
        </div>
        <div>
          <h4 className="mb-4 text-xs font-medium tracking-[0.08em] uppercase text-neutral-400">
            Product
          </h4>
          <ul className="space-y-2.5">
            <li><a href="#features" className="text-sm text-neutral-600 transition-colors hover:text-black">Features</a></li>
            <li><a href="#how" className="text-sm text-neutral-600 transition-colors hover:text-black">How it works</a></li>
            <li><a href="#" className="text-sm text-neutral-600 transition-colors hover:text-black">Security</a></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-xs font-medium tracking-[0.08em] uppercase text-neutral-400">
            Developers
          </h4>
          <ul className="space-y-2.5">
            <li><a href="#" className="text-sm text-neutral-600 transition-colors hover:text-black">Documentation</a></li>
            <li><a href="#" className="text-sm text-neutral-600 transition-colors hover:text-black">API Reference</a></li>
            <li><a href="#" className="text-sm text-neutral-600 transition-colors hover:text-black">GitHub</a></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 text-xs font-medium tracking-[0.08em] uppercase text-neutral-400">
            Company
          </h4>
          <ul className="space-y-2.5">
            <li><a href="#" className="text-sm text-neutral-600 transition-colors hover:text-black">About</a></li>
            <li><a href="#" className="text-sm text-neutral-600 transition-colors hover:text-black">Blog</a></li>
            <li><a href="#" className="text-sm text-neutral-600 transition-colors hover:text-black">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-6 sm:flex-row">
        <p className="text-[13px] text-neutral-400">&copy; 2026 Pisgah. All rights reserved.</p>
        <div className="flex gap-6">
          <a href="#" className="text-[13px] text-neutral-400 transition-colors hover:text-black">Privacy</a>
          <a href="#" className="text-[13px] text-neutral-400 transition-colors hover:text-black">Terms</a>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-black">
      <Nav />
      <Hero />
      <TrustBar />
      <HowItWorks />
      <WorkflowVisual />
      <Features />
      <Stats />
      <Quote />
      <CTA />
      <Footer />
    </div>
  );
}
