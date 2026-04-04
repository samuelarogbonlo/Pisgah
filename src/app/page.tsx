import { redirect } from "next/navigation";
import { getProviderSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getProviderSession();
  redirect(session ? "/dashboard" : "/login");
}
