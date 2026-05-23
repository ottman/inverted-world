import { NextResponse } from "next/server"
import { fetchLiveArticles } from "@/lib/live-articles"
import { fetchRecursivPublishedArticlesWithSource } from "@/lib/recursiv/content"

export const dynamic = "force-dynamic"

export async function GET() {
  const recursivResult = await fetchRecursivPublishedArticlesWithSource({ limit: 100 })
  if (recursivResult?.articles.length) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      sourceMode: recursivResult.sourceMode,
      count: recursivResult.articles.length,
      articles: recursivResult.articles,
      warnings: [],
    })
  }

  const { articles, warnings } = await fetchLiveArticles({ allowProviderFallbacks: false })

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sourceMode: "static",
    count: articles.length,
    articles,
    warnings,
  })
}
