"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", count: 6 },
  { href: "/doctor", label: "Doctor", count: 2 },
  { href: "/patients", label: "Patients" },
  { href: "/accounts", label: "Accounts", count: 5 },
  { href: "/lab", label: "Lab", count: 4 },
  { href: "/review", label: "Doctor Review", count: 1 },
  { href: "/mini", label: "Patient UI" },
  { href: "/pharmacy", label: "Pharmacy", count: 2 },
];

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="grid min-h-screen grid-cols-[272px_minmax(0,1fr)] bg-[#f3f3f1] max-lg:grid-cols-1">
      <aside className="sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-black/8 bg-white/76 px-3 py-3 backdrop-blur-[14px] max-lg:h-auto max-lg:border-r-0 max-lg:border-b">
        <div className="mb-4 flex items-center gap-2.5 px-1">
          <div className="grid h-10 w-10 place-items-center rounded-full border border-black bg-white text-[13px]">
            P
          </div>
          <div>
            <div className="text-[14px] font-bold uppercase tracking-[0.08em]">
              Pisgah
            </div>
            <div className="text-xs text-[#6d6d6d]">Diagnostic workflow</div>
          </div>
        </div>

        <div className="mb-2 rounded-[6px] border border-[#d8d8d2] bg-white/84 p-3">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#6d6d6d]">
            <span className="inline-block h-px w-5 bg-black" />
            Current Context
          </div>
          <h1 className="mt-2.5 text-2xl font-bold leading-none tracking-tight">
            St. Luke&apos;s Clinic
          </h1>
          <span className="mt-1.5 block font-mono text-xs text-[#6d6d6d]">
            stlukes.pisgah.eth
          </span>
        </div>

        <div className="mb-2 rounded-[6px] border border-[#d8d8d2] bg-white/84 p-2">
          <nav className="grid gap-1">
            {NAV_ITEMS.map(({ href, label, count }) => {
              const active = pathname === href;

              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center justify-between gap-2.5 rounded px-2.5 py-2 text-left transition-colors ${
                    active
                      ? "bg-black text-white"
                      : "text-[#161616] hover:bg-black/4"
                  }`}
                >
                  <span className="text-[14px] font-semibold">{label}</span>
                  {count !== undefined ? (
                    <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#e53e3e] px-1.5 text-[11px] font-semibold text-white">
                      {count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto rounded-[6px] border border-[#d8d8d2] bg-white/84 p-3">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#6d6d6d]">
            <span className="inline-block h-px w-5 bg-black" />
            Product Rule
          </div>
          <p className="mt-2.5 text-xs leading-[1.65] text-[#6d6d6d]">
            Automate coordination, not medical judgment.
          </p>
        </div>
      </aside>

      <main className="overflow-y-auto px-5 py-4 max-lg:px-4 max-lg:py-3">
        {children}
      </main>
    </div>
  );
}
