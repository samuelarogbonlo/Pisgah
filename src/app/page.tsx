import { redirect } from "next/navigation";
import { getProviderSession } from "@/lib/auth/session";

export default async function Home() {
  const providerSession = await getProviderSession();
  if (providerSession) {
    redirect("/dashboard");
    return;
  }

  // Don't redirect to /login — render a simple page that detects context
  // World App will load this as the entry point, but claim links load directly
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f3f1] px-6">
      <div className="w-full max-w-md rounded-[10px] border border-black/10 bg-white p-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Pisgah</h1>
        <p className="mt-3 text-sm text-[#6d6d6d]">Verified diagnostic workflows</p>
        <div className="mt-6 space-y-3">
          <a
            href="/login"
            className="block rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white"
          >
            Provider Login
          </a>
          <a
            href="/mini"
            className="block rounded-full border border-black/10 px-5 py-2.5 text-sm font-semibold"
          >
            Patient Access
          </a>
        </div>
      </div>
    </div>
  );
}
