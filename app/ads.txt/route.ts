import { ADSENSE_CLIENT, adsEnabled } from "@/lib/ads"

export const dynamic = "force-static"

// Generated from NEXT_PUBLIC_ADSENSE_CLIENT — no stale publisher id checked into the repo. AdSense
// reads /ads.txt to verify you own the inventory; it's empty until ads are configured.
export function GET() {
  const body = adsEnabled()
    ? `google.com, ${ADSENSE_CLIENT.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`
    : "# ads.txt — set NEXT_PUBLIC_ADSENSE_CLIENT (ca-pub-...) to publish AdSense ownership.\n"
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } })
}
