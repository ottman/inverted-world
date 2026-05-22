import { intelligenceArticles, type IntelligenceArticle } from "@/data/intelligence-articles"
import { featuredVideos, researchDocuments, topics } from "@/data/inverted-world"
import {
  fetchRecursivPublishedArticlesByTopic,
  fetchRecursivPublishedArticles,
  fetchRecursivPublishedArticlesForTopic,
  getRecursivPublishedArticle,
} from "@/lib/recursiv/content"
import { allowProviderFallbacks, type ProviderFallbackOptions } from "@/lib/provider-fallbacks"

const NEWS_TIMEOUT_MS = 6500
const EXA_TIMEOUT_MS = 10000

type ExaSearchResult = {
  id?: string
  title?: string
  url?: string
  publishedDate?: string
  author?: string
  highlights?: string[]
  text?: string
}

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

function cleanNewsTitle(title: string) {
  return normalizeInvertedLabels(title.replace(/\s+-\s+[^-]+$/, "").trim())
}

function normalizeInvertedLabels(value: string) {
  return value
    .replace(/\bthe black vault\b/gi, "the Declassified archive")
    .replace(/\bblack vault\b/gi, "Declassified")
}

function topicSeed(topicId: string, index: number) {
  const topicArticles = intelligenceArticles.filter((article) => article.topicId === topicId)
  return topicArticles[index % Math.max(topicArticles.length, 1)] || intelligenceArticles[index % intelligenceArticles.length]
}

function topicVideo(topicId: string, index: number) {
  const videos = featuredVideos.filter((video) => video.topicId === topicId)
  return videos[index % Math.max(videos.length, 1)]
}

function topicDocument(topicId: string, index: number) {
  const docs = researchDocuments.filter((doc) => doc.topicIds.includes(topicId))
  return docs[index % Math.max(docs.length, 1)]
}

function liveArticleBody({
  title,
  source,
  topicId,
  query,
  index,
}: {
  title: string
  source: string
  topicId: string
  query: string
  index: number
}) {
  const topic = topics.find((item) => item.id === topicId)
  const doc = topicDocument(topicId, index)
  const video = topicVideo(topicId, index)
  const sourceName = doc?.source || "primary records"
  const videoTitle = video?.title || "the channel archive"

  return [
    `Record: ${source} is carrying the live item. The first check is whether the story rests on a named filing, agency page, hearing record, dataset, court exhibit, or only secondhand media language.`,
    `Coverage map: compare the live article against ${sourceName}, GDELT cross-outlet results, archived broadcast coverage, and at least one hostile skeptical read before turning it into a narrative.`,
    `Inverted hook: ${videoTitle} is the closest archive lens. Use it as context, not proof, then separate the episode's claim from today's reporting.`,
    `Weird read: if the language, timing, or omissions repeat across institutions, the anomaly may be in the system around the story rather than the headline itself.`,
    `Skeptical read: old claims can resurface as new signals, and headlines can compress rumor, inference, and documented facts into one viral frame.`,
    `Next search: ${query.replaceAll('"', "")} "${title}" site:.gov OR filetype:pdf. Save the best primary record, the strongest debunk, the most serious unresolved gap, and the outlet split.`,
  ]
}

async function fetchExaArticlesForTopic(topicId: string, query: string) {
  const apiKey = process.env.EXA_API_KEY || process.env.EXA_SEARCH_API_KEY
  if (!apiKey) return []

  const topic = topics.find((item) => item.id === topicId)
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(EXA_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      "user-agent": "InvertedWorldExaResearch/1.0",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: `${query} latest reporting official records primary sources`,
      type: "auto",
      numResults: 12,
      contents: {
        highlights: true,
      },
    }),
  })

  if (!response.ok) return []

  const data = (await response.json()) as { results?: ExaSearchResult[] }
  return (data.results || [])
    .filter((result) => result.title && result.url)
    .slice(0, 12)
    .map((result, index) => {
      const sourceUrl = result.url || "https://exa.ai/"
      const host = sourceUrl.startsWith("http") ? new URL(sourceUrl).hostname.replace(/^www\./, "") : "Exa"
      const title = normalizeInvertedLabels(result.title || `${topic?.title || "Inverted World"} source`)
      const seed = topicSeed(topicId, index)
      const highlight = result.highlights?.find(Boolean)

      return {
        ...seed,
        id: `exa-${topicId}-${result.id || index}`,
        title,
        deck: `${host}. Exa source discovery; verify against primary records, hostile coverage, X velocity, and Tales archive context.`,
        topicId,
        topic: topic?.title.toUpperCase() || seed.topic,
        publishedAt: result.publishedDate || new Date().toISOString(),
        source: normalizeInvertedLabels(result.author || host),
        sourceUrl,
        heat: 110 - index,
        body: [
          highlight
            ? `Signal: ${highlight}`
            : `Signal: Exa surfaced this source for ${topic?.title || "the current Inverted World lane"}.`,
          ...liveArticleBody({
            title,
            source: result.author || host,
            topicId,
            query,
            index,
          }).slice(1),
        ],
        thumbnailPrompt:
          `Inverted World thumbnail for "${title}": ${topic?.title || seed.topic} signal, ` +
          "source graph, X velocity, amber-black palette, no fake documents, no faces.",
      } satisfies IntelligenceArticle
    })
}

function staticArticlesForTopic(topicId: string) {
  return intelligenceArticles.filter((article) => article.topicId === topicId).slice(0, 12)
}

function staticArticleOverride(articleId: string) {
  return intelligenceArticles.find((article) => article.id === articleId)
}

function applyStaticArticleOverrides(articles: IntelligenceArticle[]) {
  return articles.map((article) => staticArticleOverride(article.id) || article)
}

export async function fetchLiveArticlesByTopic(options: { limitPerTopic?: number } & ProviderFallbackOptions = {}) {
  const limitPerTopic = Math.max(1, Math.min(Math.trunc(options.limitPerTopic || 12), 24))
  const topicIds = topics.map((topic) => topic.id)
  const recursivByTopic = await fetchRecursivPublishedArticlesByTopic({ limitPerTopic, topicIds })
  const hasRecursivRows = Object.values(recursivByTopic || {}).some((items) => items.length > 0)

  if (hasRecursivRows || !allowProviderFallbacks(options)) {
    return Object.fromEntries(
      topicIds.map((topicId) => {
        const recursivItems = recursivByTopic?.[topicId] || []
        return [
          topicId,
          recursivItems.length
            ? applyStaticArticleOverrides(recursivItems).slice(0, limitPerTopic)
            : staticArticlesForTopic(topicId).slice(0, limitPerTopic),
        ]
      }),
    )
  }

  const liveResults = await Promise.allSettled(
    topics.map((topic) => fetchLiveArticlesForTopic(topic.id, topic.query.replaceAll('"', ""), options)),
  )

  return Object.fromEntries(
    topics.map((topic, index) => [
      topic.id,
      liveResults[index].status === "fulfilled"
        ? liveResults[index].value.slice(0, limitPerTopic)
        : staticArticlesForTopic(topic.id).slice(0, limitPerTopic),
    ]),
  )
}

export async function fetchLiveArticlesForTopic(topicId: string, query: string, options: ProviderFallbackOptions = {}) {
  const recursivArticles = await fetchRecursivPublishedArticlesForTopic(topicId, { limit: 12 })
  if (recursivArticles?.length) return applyStaticArticleOverrides(recursivArticles)
  if (!allowProviderFallbacks(options)) return staticArticlesForTopic(topicId)

  const exaArticles = await fetchExaArticlesForTopic(topicId, query).catch(() => [])
  if (exaArticles.length) return exaArticles

  const topic = topics.find((item) => item.id === topicId)
  const url = new URL("https://news.google.com/rss/search")
  url.searchParams.set("q", query)
  url.searchParams.set("hl", "en-US")
  url.searchParams.set("gl", "US")
  url.searchParams.set("ceid", "US:en")

  const response = await fetch(url, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(NEWS_TIMEOUT_MS),
    headers: {
      "user-agent": "InvertedWorldResearch/1.0",
    },
  })
  if (!response.ok) throw new Error(`Google News returned ${response.status}`)

  const xml = await response.text()
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 12).map((match, index) => {
    const item = match[1]
    const rawTitle = readTag(item, "title")
    const title = cleanNewsTitle(rawTitle)
    const link = readTag(item, "link")
    const publishedAt = readTag(item, "pubDate")
    const source = readSource(item)
    const sourceName = normalizeInvertedLabels(source.source)
    const seed = topicSeed(topicId, index)
    const articleTitle = title || normalizeInvertedLabels(seed.title)

    return {
      ...seed,
      id: `live-${topicId}-${index}`,
      title: articleTitle,
      deck: `${sourceName}. Live coverage cluster; source it against primary records, archive context, and a skeptical counterread before publishing.`,
      topicId,
      topic: topic?.title.toUpperCase() || seed.topic,
      publishedAt: publishedAt || seed.publishedAt,
      source: sourceName,
      sourceUrl: link || source.sourceUrl,
      heat: 100 - index,
      body: liveArticleBody({
        title: articleTitle,
        source: sourceName,
        topicId,
        query,
        index,
      }),
      thumbnailPrompt:
        `Inverted World thumbnail for "${articleTitle}": ${topic?.title || seed.topic} signal, ` +
        "terminal grid, redacted source trail, amber-black palette, one iconic symbol, no fake documents, no faces.",
    } satisfies IntelligenceArticle
  })
}

export async function fetchLiveArticles(options: ProviderFallbackOptions = {}) {
  const recursivArticles = await fetchRecursivPublishedArticles({ limit: 100 })
  if (recursivArticles?.length) return { articles: applyStaticArticleOverrides(recursivArticles), warnings: [] }
  if (!allowProviderFallbacks(options)) {
    return {
      articles: intelligenceArticles.slice(0, 100),
      warnings: ["Provider fallbacks are disabled for public reads; Recursiv jobs own live ingestion."],
    }
  }

  const warnings: string[] = []
  const liveResults = await Promise.allSettled(
    topics.map((topic) => fetchLiveArticlesForTopic(topic.id, topic.query.replaceAll('"', ""), options)),
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

  return { articles: merged, warnings }
}

export async function getArticleById(articleId: string) {
  const staticArticle = staticArticleOverride(articleId)
  if (staticArticle) return staticArticle

  const recursivArticle = await getRecursivPublishedArticle(articleId)
  if (recursivArticle) return recursivArticle

  const liveMatch = articleId.match(/^live-(.+)-(\d+)$/)
  if (!liveMatch) return null

  const [, topicId, rawIndex] = liveMatch
  const topic = topics.find((item) => item.id === topicId)
  if (!topic) return null

  try {
    const liveArticles = await fetchLiveArticlesForTopic(topic.id, topic.query.replaceAll('"', ""), { allowProviderFallbacks: true })
    return liveArticles[Number(rawIndex)] ?? null
  } catch {
    return null
  }
}
