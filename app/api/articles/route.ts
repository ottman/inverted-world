import { NextResponse } from "next/server"
import { fetchLiveArticles } from "@/lib/live-articles"

export const dynamic = "force-dynamic"

export async function GET() {
  const { articles, warnings } = await fetchLiveArticles({ allowProviderFallbacks: false })

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: articles.length,
    articles,
    warnings,
  })
}
