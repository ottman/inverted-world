import { NextRequest, NextResponse } from "next/server"
import { intelligenceArticles } from "@/data/intelligence-articles"
import { topics } from "@/data/inverted-world"

export const dynamic = "force-dynamic"

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return bearer === secret || request.nextUrl.searchParams.get("secret") === secret
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  const issueDate = new Date().toISOString().slice(0, 10)
  const leadArticles = topics.flatMap((topic) =>
    intelligenceArticles
      .filter((article) => article.topicId === topic.id)
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 3),
  )

  return NextResponse.json({
    issueDate,
    product: "inverted-world",
    status: "ready-for-autopost",
    cadence: "daily",
    articles: leadArticles.map((article, index) => ({
      rank: index + 1,
      id: article.id,
      title: article.title,
      deck: article.deck,
      topic: article.topic,
      source: article.source,
      sourceUrl: article.sourceUrl,
      imagePrompt: article.thumbnailPrompt,
      xHook: `${article.title}.\n\nWhat is documented, what is alleged, and what still does not add up:`,
      sourcePack: article.body,
    })),
    distribution: {
      publishTargets: ["site", "x-thread", "newsletter", "short-form-script"],
      nextIntegrations: ["X_API_BEARER_TOKEN", "XAI_API_KEY", "YOUTUBE_API_KEY", "IMAGE_GENERATION_API_KEY"],
    },
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
