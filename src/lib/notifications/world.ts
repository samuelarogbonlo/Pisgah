const NOTIFICATION_API = "https://developer.world.org/api/v2/minikit/send-notification";

export async function sendWorldNotification(params: {
  walletAddress: string;
  title: string;
  message: string;
  path?: string;
}) {
  const apiKey = process.env.WORLD_API_KEY;
  const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID;
  if (!apiKey || !appId) {
    console.warn("[world/notify] WORLD_API_KEY or WORLD_APP_ID not configured");
    return;
  }

  const miniAppPath = params.path
    ? `worldapp://mini-app?app_id=${appId}&path=${encodeURIComponent(params.path)}`
    : undefined;

  try {
    const res = await fetch(NOTIFICATION_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        wallet_addresses: [params.walletAddress],
        title: params.title,
        message: params.message,
        ...(miniAppPath && { mini_app_path: miniAppPath }),
      }),
    });

    if (!res.ok) {
      console.error("[world/notify] API error:", res.status, await res.text());
      return;
    }

    const data = await res.json();
    console.log("[world/notify] sent:", data);
  } catch (error) {
    console.error("[world/notify] failed:", error);
  }
}
