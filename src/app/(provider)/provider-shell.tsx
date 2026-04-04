"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type ProviderRole = "doctor" | "accounts" | "lab_tech" | "pharmacist" | "admin";

type ProviderShellSession = {
  name: string;
  role: ProviderRole;
  facilityName: string;
  ensName: string | null;
  verificationStatus: string | null;
};

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  roles: ProviderRole[];
}> = [
  { href: "/dashboard", label: "Overview", roles: ["doctor", "accounts", "lab_tech", "pharmacist", "admin"] },
  { href: "/doctor", label: "Doctor", roles: ["doctor", "admin"] },
  { href: "/patients", label: "Patients", roles: ["doctor", "admin"] },
  { href: "/accounts", label: "Accounts", roles: ["accounts", "admin"] },
  { href: "/lab", label: "Lab", roles: ["lab_tech", "admin"] },
  { href: "/review", label: "Doctor Review", roles: ["doctor", "admin"] },
  { href: "/pharmacy", label: "Pharmacy", roles: ["pharmacist", "admin"] },
  { href: "/admin/staff", label: "Staff", roles: ["admin"] },
  { href: "/settings", label: "Settings", roles: ["admin"] },
];

export function ProviderShell({
  session,
  children,
}: {
  session: ProviderShellSession;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await fetch("/api/provider/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(session.role));
  const roleLabel = session.role.replace("_", " ");

  return (
    <div className="grid min-h-screen grid-cols-[272px_minmax(0,1fr)] bg-[#f3f3f1] max-lg:grid-cols-1">
      <aside className="sticky top-0 flex h-screen flex-col overflow-y-auto border-r border-black/8 bg-white/76 px-3 py-3 backdrop-blur-[14px] max-lg:h-auto max-lg:border-r-0 max-lg:border-b">
        <div className="mb-4 px-1">
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
            {session.facilityName}
          </h1>
          <span className="mt-1.5 block font-mono text-xs text-[#6d6d6d]">
            {session.ensName ?? "ENS pending"}
          </span>
          <span className="mt-2 inline-flex rounded-full border border-black/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#6d6d6d]">
            {session.verificationStatus === "verified" ? "ENS Verified" : "Verification Pending"}
          </span>
        </div>

        <div className="mb-2 rounded-[6px] border border-[#d8d8d2] bg-white/84 p-2">
          <nav className="grid gap-1">
            {visibleItems.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 rounded px-2.5 py-2 text-left transition-colors ${
                    active
                      ? "bg-black text-white"
                      : "text-[#161616] hover:bg-black/4"
                  }`}
                >
                  <span className="text-[14px] font-semibold">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mb-2 rounded-[6px] border border-[#d8d8d2] bg-white/84 p-3">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#6d6d6d]">
            <span className="inline-block h-px w-5 bg-black" />
            Session
          </div>
          <p className="mt-2 text-sm font-semibold text-[#161616]">{session.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#6d6d6d]">
            {roleLabel}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="mt-3 inline-flex rounded-full border border-black bg-black px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-white disabled:opacity-60"
          >
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
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
