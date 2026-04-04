"use client";

import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";

const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID;

export function MiniProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MiniKitProvider props={{ appId }}>{children}</MiniKitProvider>;
}
