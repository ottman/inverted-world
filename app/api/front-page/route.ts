import { NextResponse } from "next/server"
import { getLatestRecursivFrontPageEdition } from "@/lib/recursiv/content"

export const dynamic = "force-dynamic"

export async function GET() {
  const edition = await getLatestRecursivFrontPageEdition()

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    edition,
  })
}
