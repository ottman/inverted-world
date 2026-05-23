import { NextResponse } from "next/server"
import { topics } from "@/data/inverted-world"
import { fetchViralXPostsForTopic, X_FRESHNESS_WINDOW_HOURS } from "@/lib/x-posts"

export const dynamic = "force-dynamic"
export const revalidate = 300

export async function GET(request: Request, { params }: { params: { topicId: string } }) {
  const topic = topics.find((item) => item.id === params.topicId)
  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") || "18")
  const posts = await fetchViralXPostsForTopic(topic.id, { limit, allowProviderFallbacks: false })

  return NextResponse.json(
    {
      topic,
      generatedAt: new Date().toISOString(),
      freshnessWindowHours: X_FRESHNESS_WINDOW_HOURS,
      posts,
    },
    {
      headers: {
        "cache-control": "s-maxage=300, stale-while-revalidate=300",
      },
    },
  )
}
