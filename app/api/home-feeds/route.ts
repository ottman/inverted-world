import { NextResponse } from "next/server"
import { fetchLiveArticlesByTopic } from "@/lib/live-articles"
import { maybeStartNewsRefresh } from "@/lib/recursiv/news-refresh"
import { fetchViralXPostsByTopic } from "@/lib/x-posts"

export const dynamic = "force-dynamic"

export async function GET() {
  const refreshKickoff = maybeStartNewsRefresh("home-feeds-api").catch(() => null)
  const [topicFeeds, topicXPosts] = await Promise.all([
    fetchLiveArticlesByTopic({ allowProviderFallbacks: false, limitPerTopic: 12 }).catch(() => ({})),
    fetchViralXPostsByTopic({ allowProviderFallbacks: false, limitPerTopic: 18 }).catch(() => ({})),
  ])
  void refreshKickoff

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      topicFeeds,
      topicXPosts,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  )
}
