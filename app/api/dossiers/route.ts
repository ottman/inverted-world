import { NextResponse } from "next/server"
import { fetchRecursivClaimDossiers } from "@/lib/recursiv/content"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") || "24")
  const topicId = url.searchParams.get("topicId") || undefined
  const dossiers = (await fetchRecursivClaimDossiers({ limit, topicId })) || []

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: dossiers.length,
    dossiers,
  })
}
