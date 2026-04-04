import { redirect } from "next/navigation";
import { getProviderSession } from "@/lib/auth/session";
import { ProviderProviders } from "../(provider)/providers";
import { LoginClient } from "./login-client";

export default async function LoginPage() {
  if (!process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID) {
    return (
      <div className="min-h-screen bg-[#f3f3f1] px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-[10px] border border-red-200 bg-white p-8">
          <p className="text-[10px] uppercase tracking-[0.24em] text-red-700">
            Dynamic Setup
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#161616]">
            Dynamic is not configured
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#6d6d6d]">
            Add <span className="font-mono">NEXT_PUBLIC_DYNAMIC_ENV_ID</span> to
            your environment before testing provider login.
          </p>
        </div>
      </div>
    );
  }

  const session = await getProviderSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <ProviderProviders>
      <LoginClient />
    </ProviderProviders>
  );
}
