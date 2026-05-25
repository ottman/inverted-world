import { NextResponse } from "next/server"
import { INVERTED_WORLD_RELEASE } from "@/lib/release"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    {
      ...INVERTED_WORLD_RELEASE,
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  )
}
