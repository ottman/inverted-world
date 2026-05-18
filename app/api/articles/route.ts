import { NextResponse } from "next/server"
import { intelligenceArticles, type IntelligenceArticle } from "@/data/intelligence-articles"
import { topics } from "@/data/inverted-world"

export const dynamic = "force-dynamic"

const NEWS_TIMEOUT_MS = 5500

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
}

function stripTags(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
}

function readTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))
  return match ? stripTags(match[1]) : ""
}

function readSource(item: string) {
  const match = item.match(/<source[^>]*url="([^"]+)"[^>]*>([\s\S]*?)<\/source>/i)
  return {
    source: match ? stripTags(match[2]) : "Google News",
    sourceUrl: match ? decodeXml(match[1]) : "https://news.google.com/",
  }
}

async function fetchGoogleNews(topicId: string, query: string) {
  const topic = topics.find((item) => item.id === topicId)
  const topicSeeds = intelligenceArticles.filter((article) => article.topicId === topicId)
  const url = new URL("https://news.google.com/rss/search")
  url.searchParams.set("q", query)
  url.searchParams.set("hl", "en-US")
  url.searchParams.set("gl", "US")
  url.searchParams.set("ceid", "US:en")

  const response = await fetch(url, {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(NEWS_TIMEOUT_MS),
    headers: {
      "user-agent": "InvertedWorldResearch/1.0",
    },
  })
  if (!response.ok) throw new Error(`Google News returned ${response.status}`)

  const xml = await response.text()
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 6).map((match, index) => {
    const item = match[1]
    const title = readTag(item, "title")
    const link = readTag(item, "link")
    const publishedAt = readTag(item, "pubDate")
    const source = readSource(item)
    const seed = topicSeeds[index % Math.max(topicSeeds.length, 1)] || intelligenceArticles[index]

    return {
      ...seed,
      id: `live-${topicId}-${index}`,
      title: title.replace(/\s+-\s+[^-]+$/, ""),
      deck: `${source.source}. Live cross-outlet signal; verify against records before building the narrative.`,
      topicId,
      topic: topic?.title || seed.topic,
      publishedAt: publishedAt || seed.publishedAt,
      source: source.source,
      sourceUrl: link || source.sourceUrl,
      heat: 100 - index,
    } satisfies IntelligenceArticle
  })
}

export async function GET() {
  const warnings: string[] = []
  const liveResults = await Promise.allSettled(
    topics.map((topic) => fetchGoogleNews(topic.id, topic.query.replaceAll('"', ""))),
  )

  const liveArticles = liveResults.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value
    warnings.push(`${topics[index].title}: ${result.reason?.message || "live news lookup failed"}`)
    return []
  })

  const merged = [
    ...liveArticles,
    ...intelligenceArticles.filter((article) => !liveArticles.some((live) => live.title === article.title)),
  ].slice(0, 100)

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: merged.length,
    articles: merged,
    warnings,
  })
}
