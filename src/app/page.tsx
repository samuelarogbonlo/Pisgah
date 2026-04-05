import { redirect } from "next/navigation";
import { getProviderSession } from "@/lib/auth/session";
import LandingPage from "@/components/landing-page";

export default async function Home() {
  const providerSession = await getProviderSession();
  if (providerSession) {
    redirect("/dashboard");
    return;
  }

  return <LandingPage />;
}
