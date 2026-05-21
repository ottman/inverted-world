import { NextResponse } from "next/server"
import { getYouTubeLiveStatus } from "@/lib/youtube-live"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const revalidate = 60

export async function GET() {
  const status = await getYouTubeLiveStatus()

  return NextResponse.json(status, {
    headers: {
      "cache-control": "s-maxage=60, stale-while-revalidate=120",
    },
  })
}
