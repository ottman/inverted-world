import {
  channelProfile,
  featuredVideos,
  researchDocuments,
  topics,
  type ChannelVideo,
  type MediaLibraryItem,
} from "@/data/inverted-world"
import { fetchLiveArticlesForTopic } from "@/lib/live-articles"
import { fetchMediaSeedItemsForSync, mediaItemMetadata } from "@/lib/media-library"
import {
  fetchNewsApiEvents,
  fetchInvertedWorldRelevantEvents,
  scoreStrategicValue,
  sortByRecency,
  fetchFringeEvents,
  fetchWeirdEvents,
  fetchComedyEvents,
  fetchPopMusicEvents,
  fetchViralEvents,
  generateStoryNarratives,
  fetchEventCoverage,
  fetchRecursivTopStories,
  fetchRecursivFringeStories,
  fetchRecursivThemedStories,
  THEMED_STORY_SOURCES,
  buildSynthesizedBody,
  isMainstreamAbsent,
  dedupeNearDuplicateStories,
  agentQuotaAvailable,
  mapWithConcurrency,
  NARRATIVE_VERSION,
  TALES_STORY_SOURCE,
  fetchRecursivTalesStories,
  type StoryCluster,
  type StoryVideo,
  type ThemedLane,
} from "@/lib/story-clusters"
import { fetchStoryThumbnail, imageRelevanceTerms, type RightsClearedImage } from "@/lib/openverse"
import { generatedSvgThumbnail } from "@/lib/generated-thumbnail"
import { createRecursivServerClient } from "@/lib/recursiv/client"
import { executeDirectInvertedWorldDatabaseSql, hasDirectInvertedWorldDatabase } from "@/lib/recursiv/database"
import { buildDailyAutopostJobResult } from "@/lib/recursiv/daily-autopost"
import { INVERTED_WORLD_SCHEMA_SQL } from "@/lib/recursiv/schema"
import { extractSourceText } from "@/lib/source-extraction"
import { classifyInvertedWorldTopic, classifyInvertedWorldTopicMatch } from "@/lib/topic-classifier"
import { fetchWorldwireItems } from "@/lib/worldwire-crawler"
import {
  WORLDWIRE_LANES,
  isExternalUrl,
  isGoogleNewsUrl,
  isUsefulWorldwireTitle,
  looksLikeArticleUrl,
  normalizeWorldwireText,
  sourceLabel,
  type WorldwireItem,
} from "@/lib/worldwire"
import { fetchViralXPostsForTopic, type ViralXPost } from "@/lib/x-posts"
import { getYouTubeApiKey } from "@/lib/youtube-config"
import { fetchYouTubePublicChannelVideos } from "@/lib/youtube-public-archive"

type YouTubePlaylistItem = {
  snippet?: {
    title?: string
    description?: string
    publishedAt?: string
    resourceId?: { videoId?: string }
  }
  contentDetails?: { videoId?: string; videoPublishedAt?: string }
}

type YouTubePlaylistResponse = {
  nextPageToken?: string
  items?: YouTubePlaylistItem[]
}

type RecursivServerClient = ReturnType<typeof createRecursivServerClient>["sdk"]
type RecursivDatabaseConfig = ReturnType<typeof createRecursivServerClient>["config"]

type ClaimSourceCandidate = {
  title: string
  url: string
  outlet: string
  sourceKind: string
  stance: string
  biasLane: string
  publishedAt: string
  credibilityScore: number
  excerpt?: string
  extractionProvider?: string
  extractedTitle?: string
  extractedDescription?: string
}

type ClaimDossierDraftRow = {
  id?: string
  slug?: string
  title?: string
  deck?: string
  topic_id?: string
  claim?: string
  summary?: string
  evidence_grade?: string
  confidence_score?: number | string
  x_velocity_score?: number | string
  source_count?: number | string
  x_signal_count?: number | string
  related_video_count?: number | string
  source_links?: unknown
  x_signals?: unknown
  related_videos?: unknown
  weird_read?: string
  skeptical_read?: string
  viral_headlines?: unknown
  metadata?: unknown
}

type GeneratedArticleDraft = {
  title: string
  deck: string
  body: string[]
  mode: "agent" | "fallback"
}

type ArticleGenerationOptions = {
  limit?: number
  useAgent?: boolean
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

function buildVideo(videoId: string, title: string, publishedAt?: string, description?: string): ChannelVideo {
  const normalizedTitle = title.toLowerCase()
  return {
    title: title || "Untitled upload",
    date: publishedAt ? publishedAt.slice(0, 10) : "",
    href: `https://www.youtube.com/watch?v=${videoId}`,
    topicId: classifyInvertedWorldTopic(title, description),
    source: "YouTube",
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    description: description?.trim() || undefined,
    kind: normalizedTitle.includes("#shorts") ? "short" : "episode",
  }
}

function dedupeVideos(videos: ChannelVideo[]) {
  const seen = new Set<string>()
  return videos.filter((video) => {
    const key = video.videoId || video.href
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function fetchYouTubeRss() {
  const response = await fetch(channelProfile.youtubeRssUrl, {
    headers: { "user-agent": "InvertedWorldRecursivSync/1.0" },
  })
  if (!response.ok) throw new Error(`YouTube RSS returned ${response.status}`)
  const xml = await response.text()

  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map((entry) => {
      const block = entry[1]
      const title = decodeXml(block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || "")
      const published = block.match(/<published>([^<]+)<\/published>/)?.[1]
      const videoId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
      return videoId ? buildVideo(videoId, title, published) : null
    })
    .filter((item): item is ChannelVideo => Boolean(item))
}

async function fetchYouTubeDataApi() {
  const key = getYouTubeApiKey()
  if (!key) return null

  const videos: ChannelVideo[] = []
  let pageToken = ""
  const maxPages = Number(process.env.YOUTUBE_ARCHIVE_MAX_PAGES || "20")

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems")
    url.searchParams.set("part", "snippet,contentDetails")
    url.searchParams.set("playlistId", channelProfile.youtubeUploadsPlaylistId)
    url.searchParams.set("maxResults", "50")
    url.searchParams.set("key", key)
    if (pageToken) url.searchParams.set("pageToken", pageToken)

    const response = await fetch(url, {
      headers: { "user-agent": "InvertedWorldRecursivSync/1.0" },
    })
    if (!response.ok) throw new Error(`YouTube Data API returned ${response.status}`)

    const data = (await response.json()) as YouTubePlaylistResponse
    for (const item of data.items ?? []) {
      const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId
      if (!videoId) continue
      videos.push(
        buildVideo(
          videoId,
          item.snippet?.title || "Untitled upload",
          item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt,
          item.snippet?.description,
        ),
      )
    }

    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }

  return videos
}

function cleanSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function slugifyPublicTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[''"]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
    .replace(/-+$/g, "")
}

function publicNewsSlug(rawSlug: string, title: string, topicId: string) {
  const titleSlug = slugifyPublicTitle(title)
  if (titleSlug && topicId) return `${topicId}-${titleSlug}`
  return rawSlug.replace(/^brief-/, "") || titleSlug || "story"
}

function publicNewsHref(rawSlug: string, title: string, topicId: string) {
  return `/news/${publicNewsSlug(rawSlug, title, topicId)}`
}

function sourceDocumentSlug(source: string, title: string, url: string) {
  return slugifyPublicTitle(`${source} ${title}`) || slugifyPublicTitle(url) || "source-document"
}

function sourceDocumentHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function normalizedTimestamp(value?: string | Date) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

function asNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function textField(value: unknown) {
  if (value instanceof Date) return value.toISOString()
  return typeof value === "string" ? value.trim() : ""
}

function shorten(value: unknown, maxLength: number) {
  const text = textField(value).replace(/\s+/g, " ")
  if (!text) return ""
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function topicDisplayTitle(topicId?: string) {
  return topics.find((topic) => topic.id === topicId)?.title || "Inverted World"
}

function cleanStoryTitle(value: unknown, topicId?: string, fallback = "Inverted World report") {
  let title = shorten(value, 180) || fallback
  const prefixes = [
    topicDisplayTitle(topicId),
    ...topics.map((topic) => topic.title),
    "Inverted World",
    "Claim Dossier",
    "Source Dossier",
  ].filter(Boolean)

  for (let pass = 0; pass < 4; pass += 1) {
    const before = title
    for (const prefix of prefixes) {
      title = title.replace(new RegExp(`^${escapeRegExp(prefix)}\\s*:\\s*`, "i"), "").trim()
    }
    if (title === before) break
  }

  return title || fallback
}

const FRONT_PAGE_TITLE_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "after",
  "into",
  "over",
  "under",
  "following",
])

function titleWords(value: string) {
  return cleanStoryTitle(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !FRONT_PAGE_TITLE_STOPWORDS.has(word))
}

function isNearDuplicateTitle(value: string, seen: string[]) {
  const words = new Set(titleWords(value))
  if (words.size < 4) return false

  for (const seenTitle of seen) {
    const seenWords = new Set(titleWords(seenTitle))
    if (seenWords.size < 4) continue
    const overlap = [...words].filter((word) => seenWords.has(word)).length
    if (overlap / Math.min(words.size, seenWords.size) >= 0.72) return true
  }

  return false
}

function diversifyFrontPageItems<T extends { title?: string; text?: string; href?: string; slug?: string; topicId?: string }>(
  items: T[],
  limit: number,
  maxPerTopic = 2,
) {
  const seenLinks = new Set<string>()
  const seenTitles: string[] = []
  const topicCounts = new Map<string, number>()
  const primary: T[] = []
  const overflow: T[] = []

  for (const item of items) {
    const linkKey = item.slug || item.href || ""
    const titleKey = item.title || item.text || linkKey
    if (linkKey && seenLinks.has(linkKey)) continue
    if (titleKey && isNearDuplicateTitle(titleKey, seenTitles)) continue
    if (linkKey) seenLinks.add(linkKey)
    if (titleKey) seenTitles.push(titleKey)

    const topic = item.topicId || "all"
    const count = topicCounts.get(topic) || 0
    if (count < maxPerTopic) {
      primary.push(item)
      topicCounts.set(topic, count + 1)
    } else {
      overflow.push(item)
    }
  }

  return [...primary, ...overflow].slice(0, limit)
}

function sourceKind(sourceName: string, sourceUrl = "") {
  const value = `${sourceName} ${sourceUrl}`.toLowerCase()
  if (value.includes(".gov") || value.includes("congress") || value.includes("courtlistener") || value.includes("federal")) {
    return "official"
  }
  if (value.includes("youtube.com") || value.includes("youtu.be")) return "archive"
  if (value.includes("x.com") || value.includes("twitter.com")) return "x"
  return "news"
}

function biasLane(sourceName: string, sourceUrl = "") {
  const value = `${sourceName} ${sourceUrl}`.toLowerCase()
  if (value.includes(".gov") || value.includes("nasa") || value.includes("aaro") || value.includes("courtlistener")) return "official-record"
  if (
    value.includes("ap") ||
    value.includes("reuters") ||
    value.includes("bbc") ||
    value.includes("nytimes") ||
    value.includes("washingtonpost") ||
    value.includes("cnn") ||
    value.includes("npr")
  ) {
    return "mainstream"
  }
  if (value.includes("substack") || value.includes("youtube") || value.includes("x.com") || value.includes("twitter")) return "independent"
  return "open-web"
}

function evidenceGrade(sourceLinks: Array<{ sourceKind: string; biasLane: string }>, xVelocityScore: number) {
  const hasOfficial = sourceLinks.some((source) => source.sourceKind === "official" || source.biasLane === "official-record")
  const hasMultipleLanes = new Set(sourceLinks.map((source) => source.biasLane)).size >= 3
  if (hasOfficial && hasMultipleLanes) return "document-backed"
  if (hasOfficial) return "record-present"
  if (sourceLinks.length >= 4 && xVelocityScore > 500) return "contested-viral"
  if (xVelocityScore > 500) return "viral-unverified"
  return "developing"
}

function confidenceScoreFor(grade: string, sourceCount: number, xSignalCount: number) {
  const base =
    grade === "document-backed"
      ? 82
      : grade === "record-present"
        ? 70
        : grade === "contested-viral"
          ? 58
          : grade === "viral-unverified"
            ? 38
            : 46
  return Math.min(94, base + Math.min(sourceCount, 8) * 2 + Math.min(xSignalCount, 8))
}

function postScore(post: ViralXPost) {
  return (
    (post.score || 0) ||
    (post.metrics?.likes || 0) +
      (post.metrics?.reposts || 0) * 2 +
      (post.metrics?.quotes || 0) * 2 +
      (post.metrics?.replies || 0) * 0.5 +
      (post.metrics?.views || 0) * 0.01
  )
}

async function enrichSourceLinks(sourceLinks: ClaimSourceCandidate[]) {
  const limit = Math.max(0, Math.min(Number(process.env.SOURCE_ENRICHMENT_LIMIT_PER_DOSSIER || "2"), 5))
  if (!limit || (!process.env.FIRECRAWL_API_KEY && !process.env.JINA_API_KEY)) return sourceLinks

  const enriched = await Promise.all(
    sourceLinks.slice(0, limit).map(async (source) => {
      const extraction = await extractSourceText(source.url)
      if (!extraction) return source

      return {
        ...source,
        excerpt: extraction.excerpt,
        extractionProvider: extraction.provider,
        extractedTitle: extraction.title,
        extractedDescription: extraction.description,
      }
    }),
  )

  return [...enriched, ...sourceLinks.slice(limit)]
}

function dossierSourceLines(row: ClaimDossierDraftRow) {
  return jsonArray(row.source_links)
    .map(jsonObject)
    .slice(0, 8)
    .map((source, index) => {
      const label = [source.outlet, source.biasLane || source.bias_lane, source.sourceKind || source.source_kind]
        .map(textField)
        .filter(Boolean)
        .join(" / ")
      const excerpt = shorten(source.excerpt, 360)
      return `${index + 1}. ${textField(source.title)}${label ? ` (${label})` : ""}: ${textField(source.url)}${excerpt ? `\n   Extract: ${excerpt}` : ""}`
    })
    .join("\n")
}

function dossierXLines(row: ClaimDossierDraftRow) {
  return jsonArray(row.x_signals)
    .map(jsonObject)
    .slice(0, 5)
    .map((post, index) => `${index + 1}. @${textField(post.username) || "x"}: ${shorten(post.text, 220)}`)
    .join("\n")
}

function dossierVideoLines(row: ClaimDossierDraftRow) {
  return jsonArray(row.related_videos)
    .map(jsonObject)
    .slice(0, 4)
    .map((video, index) => `${index + 1}. ${textField(video.title)} (${textField(video.href) || textField(video.source_url)})`)
    .join("\n")
}

function fallbackDossierArticleDraft(row: ClaimDossierDraftRow, topic: (typeof topics)[number]): GeneratedArticleDraft {
  const sourceLinks = jsonArray(row.source_links).map(jsonObject)
  const headlines = jsonArray(row.viral_headlines).map(String).filter(Boolean)
  const leadSource = sourceLinks[0]
  const sourceLanes = Array.from(
    new Set(sourceLinks.map((source) => textField(source.biasLane || source.bias_lane)).filter(Boolean)),
  )
  const title = cleanStoryTitle(row.claim || row.title || topic.signal, topic.id)

  return {
    title,
    deck:
      row.deck ||
      `${row.evidence_grade || "Developing"} dossier with ${row.source_count || sourceLinks.length || 0} sources, ${
        row.x_signal_count || 0
      } X signals, and Tales archive context.`,
    mode: "fallback",
    body: [
      `Signal: ${row.summary || row.claim || row.title || topic.signal}`,
      `Documented record: start with ${textField(leadSource.outlet) || "the lead source"}${
        textField(leadSource.url) ? ` at ${textField(leadSource.url)}` : ""
      }. Evidence grade is ${row.evidence_grade || "developing"} with confidence ${asNumber(row.confidence_score)}/100.`,
      `Source split: this dossier currently spans ${sourceLinks.length} links${
        sourceLanes.length ? ` across ${sourceLanes.join(", ")}` : ""
      }. The most important task is separating primary records from commentary and secondhand amplification.`,
      `X velocity: ${row.x_signal_count || 0} stored X signals are attached. Treat social velocity as a lead generator, not a truth verdict.`,
      `Weird read: ${row.weird_read || "repeated timing, omissions, or language drift may be the real signal."}`,
      `Skeptical read: ${row.skeptical_read || "old claims, weak sourcing, incentive loops, or stale documents may explain the heat."}`,
      `Tales context: ${row.related_video_count || 0} related videos are attached from the Tales From The Inverted World archive. Use them as context, not proof.`,
      `Viral frame: ${headlines[0] || "What records show, what X claims, and what is still missing."}`,
    ],
  }
}

function parseAgentArticleDraft(content: string): Omit<GeneratedArticleDraft, "mode"> | null {
  const match = content.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    const title = cleanStoryTitle(parsed.title)
    const deck = shorten(parsed.deck, 320)
    const body = jsonArray(parsed.body)
      .map((item) => shorten(item, 900))
      .filter(Boolean)
      .slice(0, 8)

    if (!title || !deck || body.length < 4) return null
    return { title, deck, body }
  } catch {
    return null
  }
}

async function generateDossierArticleDraft(
  sdk: RecursivServerClient,
  agentId: string | undefined,
  row: ClaimDossierDraftRow,
  topic: (typeof topics)[number],
  options: { useAgent?: boolean } = {},
): Promise<GeneratedArticleDraft> {
  const fallback = fallbackDossierArticleDraft(row, topic)
  const useAgent = options.useAgent ?? process.env.ARTICLE_GENERATION_USE_AGENT !== "0"
  if (!agentId || !useAgent) return fallback

  const prompt = [
    "Write one Inverted World news brief from the supplied claim dossier.",
    "Return only valid JSON with keys: title, deck, body.",
    "body must be 6 to 8 short paragraphs as strings.",
    "Do not invent facts. Separate documented fact, allegation, inference, speculation, and unknowns.",
    "Make the headline viral, but keep the body sober and source-grounded.",
    `Topic: ${topic.title}`,
    `Claim: ${row.claim || row.title}`,
    `Summary: ${row.summary || row.deck || ""}`,
    `Evidence grade: ${row.evidence_grade || "developing"}`,
    `Confidence: ${asNumber(row.confidence_score)}/100`,
    `X velocity score: ${asNumber(row.x_velocity_score)}`,
    `Weird read: ${row.weird_read || ""}`,
    `Skeptical read: ${row.skeptical_read || ""}`,
    `Sources:\n${dossierSourceLines(row) || "No source links attached."}`,
    `X signals:\n${dossierXLines(row) || "No X signals attached."}`,
    `Tales archive:\n${dossierVideoLines(row) || "No related videos attached."}`,
  ].join("\n\n")

  try {
    const response = await sdk.agents.chatStreamText(agentId, {
      message: prompt,
      new_conversation: true,
    })
    const parsed = parseAgentArticleDraft(response.content)
    return parsed ? { ...parsed, mode: "agent" } : fallback
  } catch {
    return fallback
  }
}

export async function ensureInvertedWorldSchema() {
  if (hasDirectInvertedWorldDatabase()) {
    const client = getInvertedWorldDatabase()
    for (const sql of INVERTED_WORLD_SCHEMA_SQL) {
      await executeDirectInvertedWorldDatabaseSql(sql)
    }
    return client
  }

  const { sdk, config } = createRecursivServerClient({ timeout: 120000 })
  await sdk.databases.ensure({ project_id: config.projectId, name: config.databaseName })
  for (const sql of INVERTED_WORLD_SCHEMA_SQL) {
    await sdk.databases.query({ project_id: config.projectId, database_name: config.databaseName, sql })
  }
  return { sdk, config }
}

function getInvertedWorldDatabase() {
  const client = createRecursivServerClient({ timeout: 120000 })
  if (!hasDirectInvertedWorldDatabase()) return client

  const originalQuery = client.sdk.databases.query.bind(client.sdk.databases)
  client.sdk.databases.query = (async (input) => {
    const directResult = await executeDirectInvertedWorldDatabaseSql(input.sql, input.params || [])
    return directResult ? { data: directResult } : originalQuery(input)
  }) as typeof client.sdk.databases.query

  return client
}

export async function syncSourceDocumentsToRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
  let synced = 0

  for (const document of researchDocuments) {
    const slug = sourceDocumentSlug(document.source, document.title, document.url)
    await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `INSERT INTO source_documents (
          slug,
          title,
          source,
          url,
          host,
          kind,
          topic_ids,
          status,
          metadata,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'active', $8::jsonb, now())
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          source = EXCLUDED.source,
          url = EXCLUDED.url,
          host = EXCLUDED.host,
          kind = EXCLUDED.kind,
          topic_ids = EXCLUDED.topic_ids,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata,
          updated_at = now()`,
      params: [
        slug,
        document.title,
        document.source,
        document.url,
        sourceDocumentHost(document.url),
        document.kind,
        JSON.stringify(document.topicIds),
        JSON.stringify({ generatedBy: "inverted-world-static-source-shelf-v1" }),
      ],
    })
    synced += 1
  }

  return {
    synced,
    sourceMode: "static-seed-to-recursiv",
  }
}

// Postgres can abort one of two concurrent upserts with SQLSTATE 40P01 "deadlock detected"
// (e.g. the standalone media-library job overlapping the pipeline's media-library step). A
// deadlock is transient — the loser just needs to retry. Re-run the operation a few times with
// a small backoff; only retry on deadlock, rethrow anything else immediately.
async function runWithDeadlockRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (attempt >= attempts || !/deadlock detected/i.test(message)) throw error
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
    }
  }
}

export async function syncMediaLibraryToRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
  // Sort by slug so every concurrent upsert locks media_items rows in the same order. Without
  // a stable order, an overlapping standalone media-library job and the pipeline's media-library
  // step can lock rows in opposite orders and Postgres aborts one with "deadlock detected".
  const items = (await fetchMediaSeedItemsForSync())
    .map(compactMediaItemForSync)
    .sort((left, right) => left.id.localeCompare(right.id))
  const batchSize = Math.max(1, Math.min(Math.trunc(Number(process.env.MEDIA_LIBRARY_SYNC_BATCH_SIZE || "5")) || 5, 6))
  let synced = 0

  for (let offset = 0; offset < items.length; offset += batchSize) {
    const batch = items.slice(offset, offset + batchSize)
    const values = batch
      .map((_, index) => {
        const base = index * 15
        return `(
          $${base + 1},
          $${base + 2},
          $${base + 3},
          $${base + 4},
          $${base + 5},
          $${base + 6},
          $${base + 7}::jsonb,
          $${base + 8},
          NULLIF($${base + 9}, '')::timestamptz,
          $${base + 10},
          $${base + 11},
          $${base + 12},
          $${base + 13},
          $${base + 14},
          'active',
          $${base + 15}::jsonb,
          now()
        )`
      })
      .join(", ")
    const params = batch.flatMap((item: MediaLibraryItem) => [
      item.id,
      item.title,
      item.source,
      item.url,
      item.kind,
      item.viewer,
      JSON.stringify(item.topicIds),
      item.summary,
      normalizedTimestamp(item.publishedAt),
      item.embedUrl || "",
      item.thumbnailUrl || "",
      item.fileType || "",
      item.agency || "",
      item.collection || "",
      JSON.stringify(mediaItemMetadata(item)),
    ])

    await runWithDeadlockRetry(() =>
      sdk.databases.query({
        project_id: config.projectId,
        database_name: config.databaseName,
        sql: `INSERT INTO media_items (
          slug,
          title,
          source,
          source_url,
          kind,
          viewer,
          topic_ids,
          summary,
          published_at,
          embed_url,
          thumbnail_url,
          file_type,
          agency,
          collection,
          status,
          metadata,
          updated_at
        )
        VALUES ${values}
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          source = EXCLUDED.source,
          source_url = EXCLUDED.source_url,
          kind = EXCLUDED.kind,
          viewer = EXCLUDED.viewer,
          topic_ids = EXCLUDED.topic_ids,
          summary = EXCLUDED.summary,
          published_at = EXCLUDED.published_at,
          embed_url = EXCLUDED.embed_url,
          thumbnail_url = EXCLUDED.thumbnail_url,
          file_type = EXCLUDED.file_type,
          agency = EXCLUDED.agency,
          collection = EXCLUDED.collection,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata,
          updated_at = now()`,
        params,
      }),
    )
    synced += batch.length
  }

  return {
    synced,
    batchSize,
    batches: Math.ceil(items.length / batchSize),
    sourceMode: "static-and-official-media-to-recursiv",
  }
}

function compactMediaItemForSync(item: MediaLibraryItem): MediaLibraryItem {
  return {
    ...item,
    id: shorten(item.id, 140),
    title: shorten(item.title, 260),
    source: shorten(item.source, 120),
    url: shorten(item.url, 1000),
    topicIds: item.topicIds.slice(0, 8),
    summary: shorten(item.summary, 900),
    embedUrl: shorten(item.embedUrl, 1000) || undefined,
    thumbnailUrl: shorten(item.thumbnailUrl, 1000) || undefined,
    fileType: shorten(item.fileType, 80) || undefined,
    agency: shorten(item.agency, 120) || undefined,
    collection: shorten(item.collection, 140) || undefined,
    extraction: item.extraction
      ? {
          status: item.extraction.status,
          brief: shorten(item.extraction.brief, 900),
          highlights: item.extraction.highlights.map((highlight) => shorten(highlight, 220)).filter(Boolean).slice(0, 8),
          sourceChain: item.extraction.sourceChain
            .map((source) => ({
              label: shorten(source.label, 80),
              value: shorten(source.value, 180),
              url: shorten(source.url, 1000) || undefined,
            }))
            .filter((source) => source.label && source.value)
            .slice(0, 8),
          researchQuestions: item.extraction.researchQuestions
            .map((question) => shorten(question, 220))
            .filter(Boolean)
            .slice(0, 8),
        }
      : undefined,
  }
}

export async function syncYouTubeArchiveToRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
  const fullSync = process.env.YOUTUBE_ARCHIVE_FULL_SYNC === "1"
  const seeded = featuredVideos.filter((video) => video.source === "YouTube" && video.videoId)
  const warnings: string[] = []
  let videos: ChannelVideo[] = []
  let sourceMode = "seed"

  if (fullSync && getYouTubeApiKey()) {
    try {
      const apiVideos = await fetchYouTubeDataApi()
      if (apiVideos?.length) {
        videos = dedupeVideos([...apiVideos, ...seeded])
        sourceMode = "youtube-data-api"
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "YouTube Data API archive failed")
    }
  }

  if (!videos.length) {
    try {
      const rssVideos = await fetchYouTubeRss()
      videos = dedupeVideos([...rssVideos, ...seeded])
      sourceMode = "rss-plus-seed"
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "YouTube RSS archive failed")
    }
  }

  if (!videos.length) {
    try {
      const publicVideos = await fetchYouTubePublicChannelVideos({ limit: 60 })
      if (publicVideos.length) {
        videos = dedupeVideos([...publicVideos, ...seeded])
        sourceMode = "youtube-public-channel"
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "YouTube public channel archive failed")
    }
  }

  if (!videos.length) {
    videos = dedupeVideos(seeded)
  }

  for (const video of videos) {
    await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `INSERT INTO channel_items (
          source,
          source_id,
          source_url,
          title,
          description,
          published_at,
          topic_id,
          thumbnail_url,
          embed_url,
          kind,
          metadata,
          updated_at
        )
        VALUES ('youtube', $1, $2, $3, $4, NULLIF($5, '')::timestamptz, $6, $7, $8, $9, $10::jsonb, now())
        ON CONFLICT (source_url) DO UPDATE SET
          source_id = EXCLUDED.source_id,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          published_at = EXCLUDED.published_at,
          topic_id = EXCLUDED.topic_id,
          thumbnail_url = EXCLUDED.thumbnail_url,
          embed_url = EXCLUDED.embed_url,
          kind = EXCLUDED.kind,
          metadata = EXCLUDED.metadata,
          updated_at = now()`,
      params: [
        video.videoId,
        video.href,
        video.title,
        video.description || "",
        video.date,
        video.topicId,
        video.thumbnail,
        video.embedUrl,
        video.kind || "episode",
        JSON.stringify({ channel: channelProfile.name }),
      ],
    })
  }

  return { synced: videos.length, sourceMode, warnings }
}

export async function reclassifyYouTubeArchiveInRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
  const { data } = await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `SELECT id, title, description, topic_id
      FROM channel_items
      WHERE source = 'youtube'
      ORDER BY published_at DESC NULLS LAST, created_at DESC`,
  })

  const rows = (data.rows || []) as Array<{ id?: string; title?: string; description?: string; topic_id?: string }>
  const before: Record<string, number> = {}
  const after: Record<string, number> = {}
  const changes: Array<{ id: string; topicId: string }> = []

  for (const row of rows) {
    const id = textField(row.id)
    const current = textField(row.topic_id) || "secret-programs"
    const classification = classifyInvertedWorldTopicMatch(textField(row.title), textField(row.description))
    const next =
      classification.matched && (current === "secret-programs" || classification.topicId === "epstein-networks")
        ? classification.topicId
        : current
    before[current] = (before[current] || 0) + 1
    after[next] = (after[next] || 0) + 1
    if (id && next !== current) changes.push({ id, topicId: next })
  }

  for (let offset = 0; offset < changes.length; offset += 50) {
    const chunk = changes.slice(offset, offset + 50)
    const values = chunk.map((_, index) => `($${index * 2 + 1}::text, $${index * 2 + 2}::text)`).join(", ")
    await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `UPDATE channel_items AS item
        SET topic_id = update_values.topic_id, updated_at = now()
        FROM (VALUES ${values}) AS update_values(id, topic_id)
        WHERE item.id = update_values.id`,
      params: chunk.flatMap((change) => [change.id, change.topicId]),
    })
  }

  const deckResult = await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `UPDATE claim_dossiers
      SET deck = CASE topic_id
        WHEN 'uap-disclosure' THEN 'Latest sourced reporting in Skywatch, with original links, social context, and related Tales archive material beside it.'
        WHEN 'secret-programs' THEN 'Latest sourced reporting in Declassified, with original links, social context, and related Tales archive material beside it.'
        WHEN 'epstein-networks' THEN 'Latest sourced reporting in Power Web, with original links, social context, and related Tales archive material beside it.'
        WHEN 'cryptids-paranormal' THEN 'Latest sourced reporting in High Strangeness, with original links, social context, and related Tales archive material beside it.'
        WHEN 'ai-technocracy' THEN 'Latest sourced reporting in Machine State, with original links, social context, and related Tales archive material beside it.'
        WHEN 'space-anomalies' THEN 'Latest sourced reporting in Off-World Signals, with original links, social context, and related Tales archive material beside it.'
        ELSE 'Latest sourced reporting in Inverted World, with original links, social context, and related Tales archive material beside it.'
      END,
      updated_at = now()
      WHERE deck ILIKE '%Ground News%'
        OR (deck ILIKE '%source split%' AND deck ILIKE '%X velocity%' AND deck ILIKE '%evidence grade%')
        OR deck ILIKE 'A sourced % file with records, social velocity, skeptical reads, and Tales archive context%'
      RETURNING id`,
  })

  return {
    scanned: rows.length,
    reclassified: changes.length,
    before,
    after,
    cleanedDossierDecks: deckResult.data.rows?.length || 0,
  }
}

function topicPulseConcurrency() {
  const configured = Math.trunc(Number(process.env.TOPIC_PULSE_CONCURRENCY || ""))
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 4) : 3
}

async function runTopicPulseForTopic(
  sdk: RecursivServerClient,
  config: RecursivDatabaseConfig,
  topic: (typeof topics)[number],
  options: { limit: number; profileReader: boolean },
) {
  const articles = await fetchLiveArticlesForTopic(topic.id, topic.query.replaceAll('"', ""), {
    allowProviderFallbacks: true,
  }).catch(() => [])
  await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `INSERT INTO coverage_snapshots (topic_id, query, source, items, summary, velocity_score, metadata)
        VALUES ($1, $2, 'google-news', $3::jsonb, $4, $5, $6::jsonb)`,
    params: [
      topic.id,
      topic.query,
      JSON.stringify(
        articles.slice(0, 12).map((article) => ({
          title: article.title,
          source: article.source,
          sourceUrl: article.sourceUrl,
          publishedAt: article.publishedAt,
          heat: article.heat,
        })),
      ),
      `Latest ${topic.title} source cluster from Google News and archive context.`,
      articles.reduce((sum, article) => sum + (article.heat || 0), 0),
      JSON.stringify({ topic: topic.title, signal: topic.signal }),
    ],
  })

  const posts = await fetchViralXPostsForTopic(topic.id, {
    limit: options.limit,
    allowProviderFallbacks: true,
    allowProfileReader: options.profileReader,
  }).catch(() => [])
  const hasProfileReaderRows = posts.some((post) => post.source === "x-profile-reader")
  if (options.profileReader && hasProfileReaderRows) await clearXProfileReaderSignals(sdk, config.projectId, config.databaseName, topic.id)
  for (const post of posts) {
    await upsertXSignal(sdk, config.projectId, config.databaseName, post)
  }

  return { topicId: topic.id, coverageSnapshots: 1, xSignals: posts.length }
}

export async function syncTopicPulseToRecursiv(options: { limit?: number; profileReader?: boolean } = {}) {
  const { sdk, config } = getInvertedWorldDatabase()
  const concurrency = topicPulseConcurrency()
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 24), 24))
  const profileReader = options.profileReader === true
  const results: Array<{ topicId: string; coverageSnapshots: number; xSignals: number }> = []

  for (let offset = 0; offset < topics.length; offset += concurrency) {
    const batch = topics.slice(offset, offset + concurrency)
    results.push(...(await Promise.all(batch.map((topic) => runTopicPulseForTopic(sdk, config, topic, { limit, profileReader })))))
  }

  return {
    coverageSnapshots: results.reduce((sum, result) => sum + result.coverageSnapshots, 0),
    xSignals: results.reduce((sum, result) => sum + result.xSignals, 0),
    concurrency,
    limit,
    profileReader,
    topics: results,
  }
}

function groupWorldwireByLane(items: WorldwireItem[]) {
  const grouped = new Map<string, WorldwireItem[]>()
  for (const item of items) {
    const laneId = item.sectionId || "world"
    const current = grouped.get(laneId) || []
    current.push(item)
    grouped.set(laneId, current)
  }
  return grouped
}

function compactWorldwireItem(item: WorldwireItem): WorldwireItem {
  const url = shorten(item.url, 520)
  const title = cleanStoryTitle(item.title, item.sectionId, "Worldwire source")
  return {
    id: shorten(item.id, 140) || `${item.sectionId || "world"}-${slugifyPublicTitle(title || url).slice(0, 48)}`,
    title: shorten(title, 180),
    url,
    source: shorten(item.source, 96) || sourceDocumentHost(url) || item.sectionTitle || "source",
    sectionId: shorten(item.sectionId, 64) || "world",
    sectionTitle: shorten(item.sectionTitle, 80) || "Worldwire",
    score: Math.round(asNumber(item.score)),
    publishedAt: shorten(item.publishedAt, 80) || undefined,
    excerpt: shorten(item.excerpt, 260) || undefined,
    imageUrl: shorten(item.imageUrl, 520) || undefined,
  }
}

// Story clusters: fetch newsapi.ai Events, have the agent write a viral-neutral
// headline + synopsis, store as a coverage_snapshots row (source='top-stories'). Uses the same
// direct-DB writer as the rest of ingestion (the SDK REST query path rejects these params).
const TOP_STORIES_DEFAULT_LIMIT = 160
const TOP_STORIES_MAX_NEW_PER_RUN = 48
const COVERAGE_CONCURRENCY = 5
const IMAGE_CONCURRENCY = 8
const IMAGE_REFRESH_PER_RUN = 40

// Cascade of Openverse search queries for a story, most-specific first.
function imageQueryCascade(story: StoryCluster): Array<string | undefined> {
  return [
    story.imageQuery,
    story.concepts.slice(0, 2).join(" "),
    story.concepts[0],
    story.concepts[1],
    story.title.split(/\s+/).filter((word) => word.length > 3).slice(0, 4).join(" "),
  ]
}

// Prompt for the AI-image fallback — describe the story so the generated picture is on-topic.
function imageAiPrompt(story: StoryCluster): string {
  const subject = story.imageQuery?.trim() || story.headline?.trim() || story.title.trim()
  const context = story.concepts.slice(0, 3).filter(Boolean).join(", ")
  return context ? `${subject}, ${context}` : subject
}

// Re-pick images for stories whose current picture isn't clearly relevant to the article (older rows
// stored before relevance scoring, or earlier "dud" photos). A relevance-scored rights-cleared photo
// wins when one clearly matches; otherwise the story gets an AI-generated, on-topic image instead of
// a dud. Bounded per run + marked `imageChecked` so it converges. Both Openverse and the Pollinations
// AI fallback are free + keyless, so this costs no agent quota — only HTTP.
async function refreshLowRelevanceImages(stories: StoryCluster[]): Promise<StoryCluster[]> {
  // Any story whose picture still isn't relevant. We no longer skip `imageChecked` rows: the AI
  // fallback guarantees a refresh reaches relevance>=1, so a re-pick can only improve a stuck dud and
  // never loops. Bounded per run so the hourly cron converges the whole set over a few passes.
  const needs = stories.filter((story) => ((story.image?.relevance) || 0) < 1).slice(0, IMAGE_REFRESH_PER_RUN)
  if (!needs.length) return stories
  const attempted = new Set(needs.map((story) => story.uri))
  const better = new Map<string, RightsClearedImage>()
  await mapWithConcurrency(needs, IMAGE_CONCURRENCY, async (story) => {
    const terms = imageRelevanceTerms([story.title, ...story.concepts])
    const image = await fetchStoryThumbnail(imageQueryCascade(story), terms, imageAiPrompt(story)).catch(() => null)
    if (image && (image.relevance || 0) > ((story.image?.relevance) || 0)) better.set(story.uri, image)
  })
  return stories.map((story) =>
    attempted.has(story.uri) ? { ...story, image: better.get(story.uri) || story.image, imageChecked: true } : story,
  )
}

// A story has a real agent-written body (not the synthesized/summary interim). Used to pick which
// stored stories still need self-healing (an agent rewrite) on a later run once quota is available.
function hasFullStoryBody(story: StoryCluster): boolean {
  // Only a current-prompt agent body counts as done; older agent bodies are re-written by self-heal.
  if (story.bodySource === "agent") return story.narrativeVersion === NARRATIVE_VERSION
  return false
}

// Turn raw newsapi.ai events into full stories: who's covering each (so the narrative can attribute
// facts to named outlets, which we linkify on the detail page), then a viral-neutral headline +
// long synopsis body, then a rights-cleared (CC/PD) Openverse image. Bounded concurrency keeps the
// burst of getEvent / Openverse calls from getting rate-limited (which silently drops coverage).
async function enrichFreshTopStories(events: StoryCluster[]): Promise<StoryCluster[]> {
  if (!events.length) return []
  const withCoverage = await mapWithConcurrency(events, COVERAGE_CONCURRENCY, async (event) => {
    let coveringArticles = await fetchEventCoverage(event.uri).catch(() => [])
    if (!coveringArticles.length) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      coveringArticles = await fetchEventCoverage(event.uri).catch(() => [])
    }
    // When re-processing a story (self-heal) and the re-fetch comes back empty, keep what it had.
    return { ...event, coveringArticles: coveringArticles.length ? coveringArticles : event.coveringArticles || [] }
  })
  const narrated = await generateStoryNarratives(withCoverage)
  return mapWithConcurrency(narrated, IMAGE_CONCURRENCY, async (story) => {
    // A relevance-scored rights-cleared photo when one clearly matches the story's own terms;
    // otherwise an AI-generated, on-topic image — so a story never shows an irrelevant "dud".
    const relevanceTerms = imageRelevanceTerms([story.title, ...story.concepts])
    const image = await fetchStoryThumbnail(imageQueryCascade(story), relevanceTerms, imageAiPrompt(story)).catch(() => null)
    // Keep the better of the fresh pick vs. whatever we already had (don't downgrade on a miss).
    const prior = story.image
    const next = image && (!prior || (image.relevance || 0) >= (prior.relevance || 0)) ? image : prior
    return { ...story, image: next || undefined }
  })
}

const FRINGE_DEFAULT_LIMIT = 36
const FRINGE_MAX_NEW_PER_RUN = 18

// Maintain a ROLLING set of story clusters for one lane. Each run discovers current events, fully
// processes only the ones we don't already have (the expensive coverage + narrative + image step),
// optionally self-heals stale (synthesized) bodies when the agent quota is back, and merges newest-
// first up to `limit` — older stories age off. This is what makes "10x stories, new ones hourly"
// sustainable: a full set means only genuinely-new events get reprocessed per hour. Stored as a
// coverage_snapshots row keyed by `source` via the direct-DB writer.
async function runRollingStorySync(opts: {
  source: string
  lane: StoryCluster["lane"]
  defaultLimit: number
  defaultMaxNew: number
  limit?: number
  maxNew?: number
  rebuild?: boolean
  summaryText: string
  generatedBy: string
  existingFetcher: (limit: number) => Promise<StoryCluster[]>
  discover: (discoveryLimit: number) => Promise<StoryCluster[]>
  postFilter?: (story: StoryCluster) => boolean
  // Strategic selection: when set, the per-run agent budget (maxNew) is spent on the highest-scoring
  // candidates instead of the most recent — so tokens go to the most viral / on-brand stories.
  prioritize?: (story: StoryCluster) => number
}) {
  const limit = Math.max(1, Math.min(opts.limit ?? opts.defaultLimit, 250))
  const maxNew = Math.max(1, Math.min(opts.maxNew ?? (opts.rebuild ? limit : opts.defaultMaxNew), limit))

  // rebuild=true ignores the existing set and reprocesses everything fresh (one-time clean backfill);
  // the hourly cron omits it so it only pays for genuinely-new events.
  const existing = opts.rebuild ? [] : await opts.existingFetcher(limit).catch(() => [])
  const existingByUri = new Map(existing.map((story) => [story.uri, story]))

  // Shallow scan once the set is full (cheap discovery of what's new); deep scan while backfilling.
  const discoveryLimit = existing.length >= limit ? Math.min(limit, 100) : limit
  const candidates = await opts.discover(discoveryLimit)
  if (!candidates.length && !existing.length) return { stored: 0, reason: "no-events" as const }

  // Process genuinely-new events first; then, with whatever per-run budget is left, self-heal
  // existing stories still carrying a synthesized/summary body (e.g. a previous run hit the agent's
  // daily quota). Skip the repair pass entirely when the agent quota is spent — re-fetching their
  // coverage would just spend newsapi tokens for a body the agent can't rewrite yet.
  const newEvents = candidates.filter((event) => !existingByUri.has(event.uri))
  const staleStories = existing.filter((story) => !hasFullStoryBody(story))
  const repairTargets = staleStories.length && (await agentQuotaAvailable()) ? staleStories : []
  // Strategic selection: spend the agent budget on the highest-value candidates first (most viral /
  // on-brand), not the most recent. New events always win the budget over repairs; both are ranked.
  const rankByValue = (rows: StoryCluster[]) =>
    opts.prioritize ? [...rows].sort((left, right) => opts.prioritize!(right) - opts.prioritize!(left)) : rows
  const toProcess = [...rankByValue(newEvents), ...rankByValue(repairTargets)].slice(0, maxNew)
  const processed = (await enrichFreshTopStories(toProcess)).map((story) => ({ ...story, lane: opts.lane }))
  const processedByUri = new Map(processed.map((story) => [story.uri, story]))

  // For any kept (not-reprocessed) story that doesn't have a real agent body yet, (re)synthesize a
  // complete article from its stored coverage — free, no network — so stories never render as a stub
  // that "cuts off" a few lines in, even while the agent quota is spent.
  const candidateByUri = new Map(candidates.map((event) => [event.uri, event]))
  const normalizeBody = (story: StoryCluster): StoryCluster =>
    story.bodySource === "agent"
      ? story
      : { ...story, body: buildSynthesizedBody(story), bodySource: "synth" as const }

  // Stamp `addedAt` (real recency) so genuinely-new stories surface at the top instead of being
  // buried under stories that Event Registry dated to a FUTURE event date. New events get the run
  // timestamp; kept stories preserve their prior addedAt; legacy rows without one are backfilled from
  // their (future-clamped) event day so they slot in sensibly the first time.
  const runStamp = new Date().toISOString()
  const todayKey = runStamp.slice(0, 10)
  const clampDay = (story: StoryCluster) => {
    const day = (story.eventDate || "").slice(0, 10)
    return day && day <= todayKey ? day : todayKey
  }
  const newEventUris = new Set(newEvents.map((event) => event.uri))
  const stampAddedAt = (story: StoryCluster): StoryCluster => {
    if (story.addedAt) return story
    const priorAddedAt = existingByUri.get(story.uri)?.addedAt
    if (priorAddedAt) return { ...story, addedAt: priorAddedAt }
    const addedAt = newEventUris.has(story.uri) ? runStamp : `${clampDay(story)}T00:00:00.000Z`
    return { ...story, addedAt }
  }

  // Merge: a freshly-processed story always wins over its prior version; keep the freshest up to the
  // rolling limit and drop the oldest beyond it. Final display order is newest-added first.
  const merged: StoryCluster[] = []
  const seen = new Set<string>()
  for (const story of [...processed, ...existing]) {
    if (!story?.uri || seen.has(story.uri)) continue
    seen.add(story.uri)
    merged.push(stampAddedAt(processedByUri.get(story.uri) || normalizeBody({ ...story, lane: opts.lane })))
  }
  // Lane-specific gate (e.g. the fringe lane drops anything the mainstream picked up), applied after
  // coverage is known. Then collapse duplicate clusters of the same real-world story (newsapi emits
  // several per story), keep the freshest up to the rolling limit, and converge images.
  const filtered = opts.postFilter ? merged.filter(opts.postFilter) : merged
  const sorted = sortByRecency(filtered)
  // Backfill categories from the freshly-discovered events (free) so stored stories pick them up
  // without a costly per-story re-fetch.
  const ranked = dedupeNearDuplicateStories(sorted)
    .slice(0, limit)
    .map((story) => {
      const category = candidateByUri.get(story.uri)?.category || story.category
      return category === story.category ? story : { ...story, category }
    })
  const stories = await refreshLowRelevanceImages(ranked)
  const totalCoverage = stories.reduce((sum, story) => sum + (story.articleCount || 0), 0)

  const newThisRun = processed.filter((story) => newEventUris.has(story.uri)).length
  const healedThisRun = processed.length - newThisRun
  const fullBodies = stories.filter(hasFullStoryBody).length

  const { sdk, config } = getInvertedWorldDatabase()
  await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `INSERT INTO coverage_snapshots (topic_id, query, source, items, summary, velocity_score, metadata)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb)`,
    params: [
      opts.source,
      opts.source,
      opts.source,
      JSON.stringify(stories),
      opts.summaryText,
      String(Number.isFinite(totalCoverage) ? totalCoverage : 0),
      JSON.stringify({ generatedBy: opts.generatedBy, storyCount: stories.length, newThisRun, healedThisRun, fullBodies }),
    ],
  })
  return { stored: stories.length, newThisRun, healedThisRun, fullBodies, totalCoverage }
}

// Mainstream "What everyone's talking about" — rolling 160, hourly.
export async function syncTopStoriesToRecursiv(options: { limit?: number; sinceDays?: number; maxNew?: number; rebuild?: boolean } = {}) {
  return runRollingStorySync({
    source: "top-stories",
    lane: "top",
    defaultLimit: TOP_STORIES_DEFAULT_LIMIT,
    defaultMaxNew: TOP_STORIES_MAX_NEW_PER_RUN,
    limit: options.limit,
    maxNew: options.maxNew,
    rebuild: options.rebuild,
    summaryText: "Top story clusters across the spectrum (newsapi.ai Events).",
    generatedBy: "newsapi-ai-events-v3-strategic",
    existingFetcher: (limit) => fetchRecursivTopStories({ limit }),
    // Bias the candidate pool toward Inverted World: the broad "top news" pull PLUS an on-brand,
    // socially-viral pull (UAP/cover-up/surveillance/… concepts), merged + de-duped.
    discover: async (discoveryLimit) => {
      const [broad, onBrand] = await Promise.all([
        fetchNewsApiEvents({ limit: discoveryLimit, sinceDays: options.sinceDays ?? 2 }),
        fetchInvertedWorldRelevantEvents({ limit: 40, sinceDays: options.sinceDays ?? 3 }).catch(() => [] as StoryCluster[]),
      ])
      const seen = new Set(broad.map((story) => story.uri))
      return [...broad, ...onBrand.filter((story) => !seen.has(story.uri))]
    },
    // Spend the hourly agent budget on the most viral × most on-brand candidates first.
    prioritize: scoreStrategicValue,
  })
}

// Under-covered "What nobody's talking about" — rolling fringe/anomaly set, hourly.
export async function syncUnderCoveredStoriesToRecursiv(options: { limit?: number; sinceDays?: number; maxNew?: number; rebuild?: boolean } = {}) {
  return runRollingStorySync({
    source: "fringe-stories",
    lane: "fringe",
    defaultLimit: FRINGE_DEFAULT_LIMIT,
    defaultMaxNew: FRINGE_MAX_NEW_PER_RUN,
    limit: options.limit,
    maxNew: options.maxNew,
    rebuild: options.rebuild,
    summaryText: "Stories the mainstream isn't covering (newsapi.ai Events).",
    generatedBy: "newsapi-ai-mainstream-absent-v2-rolling",
    existingFetcher: (limit) => fetchRecursivFringeStories({ limit }),
    discover: (discoveryLimit) => fetchFringeEvents({ limit: discoveryLimit, sinceDays: options.sinceDays ?? 10 }),
    // The defining gate: keep only stories big legacy outlets are essentially absent from.
    postFilter: (story) => isMainstreamAbsent(story, 1),
  })
}

// ── Themed sets: Weird / Comedy / Pop & Music / Viral ────────────────────────────────────────────
const THEMED_DEFAULT_LIMIT = 30
const THEMED_MAX_NEW_PER_RUN = 18

const THEMED_DISCOVER: Record<ThemedLane, (limit: number, sinceDays?: number) => Promise<StoryCluster[]>> = {
  weird: (limit, sinceDays) => fetchWeirdEvents({ limit, sinceDays }),
  comedy: (limit, sinceDays) => fetchComedyEvents({ limit, sinceDays }),
  pop: (limit, sinceDays) => fetchPopMusicEvents({ limit, sinceDays }),
  viral: (limit, sinceDays) => fetchViralEvents({ limit, sinceDays }),
}

const THEMED_SUMMARY: Record<ThemedLane, string> = {
  weird: "Weird, strange and unexplained stories (newsapi.ai Events).",
  comedy: "Comedy and satire stories (newsapi.ai Events).",
  pop: "Pop culture and music stories (newsapi.ai Events).",
  viral: "Viral, most-shared stories (newsapi.ai Events).",
}

export async function syncThemedStoriesToRecursiv(
  lane: ThemedLane,
  options: { limit?: number; sinceDays?: number; maxNew?: number; rebuild?: boolean } = {},
) {
  return runRollingStorySync({
    source: THEMED_STORY_SOURCES[lane],
    lane,
    defaultLimit: THEMED_DEFAULT_LIMIT,
    defaultMaxNew: THEMED_MAX_NEW_PER_RUN,
    limit: options.limit,
    maxNew: options.maxNew,
    rebuild: options.rebuild,
    summaryText: THEMED_SUMMARY[lane],
    generatedBy: `newsapi-ai-themed-${lane}-v1-rolling`,
    existingFetcher: (limit) => fetchRecursivThemedStories(lane, { limit }),
    discover: (discoveryLimit) => THEMED_DISCOVER[lane](discoveryLimit, options.sinceDays),
  })
}

// Run all four themed sets in one job (one cron). Sequential to keep newsapi/agent load bounded.
export async function syncAllThemedStoriesToRecursiv(options: { rebuild?: boolean; maxNew?: number } = {}) {
  const lanes: ThemedLane[] = ["weird", "comedy", "pop", "viral"]
  const results: Record<string, unknown> = {}
  for (const lane of lanes) {
    results[lane] = await syncThemedStoriesToRecursiv(lane, { rebuild: options.rebuild, maxNew: options.maxNew }).catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }))
  }
  return results
}

// Re-image an already-stored set IN PLACE: re-pick a relevant rights-cleared photo (or an AI image)
// for every story whose current picture isn't relevant, then write the set back. Spends NO newsapi
// quota — it reads the stored snapshot and only hits Openverse + the free Pollinations AI fallback —
// so it can fix every "dud" thumbnail immediately, without waiting for the hourly cron to converge.
async function reimageStoredSet(
  source: string,
  fetcher: () => Promise<StoryCluster[]>,
  summaryText: string,
  generatedBy: string,
): Promise<{ source: string; stored: number; refreshed: number }> {
  const stories = await fetcher().catch(() => [] as StoryCluster[])
  if (!stories.length) return { source, stored: 0, refreshed: 0 }
  const duds = stories.filter((story) => ((story.image?.relevance) || 0) < 1)
  const better = new Map<string, RightsClearedImage>()
  await mapWithConcurrency(duds, IMAGE_CONCURRENCY, async (story) => {
    const terms = imageRelevanceTerms([story.title, ...story.concepts])
    const image = await fetchStoryThumbnail(imageQueryCascade(story), terms, imageAiPrompt(story)).catch(() => null)
    if (image && (image.relevance || 0) > ((story.image?.relevance) || 0)) better.set(story.uri, image)
  })
  const updated = stories.map((story) =>
    better.has(story.uri) ? { ...story, image: better.get(story.uri), imageChecked: true } : story,
  )
  const totalCoverage = updated.reduce((sum, story) => sum + (story.articleCount || 0), 0)
  const { sdk, config } = getInvertedWorldDatabase()
  await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `INSERT INTO coverage_snapshots (topic_id, query, source, items, summary, velocity_score, metadata)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb)`,
    params: [
      source,
      source,
      source,
      JSON.stringify(updated),
      summaryText,
      String(Number.isFinite(totalCoverage) ? totalCoverage : 0),
      JSON.stringify({ generatedBy, storyCount: updated.length, reimaged: better.size }),
    ],
  })
  return { source, stored: updated.length, refreshed: better.size }
}

// One-shot re-image of every stored set (top, fringe, and the four themed lanes). Free — no newsapi.
export async function reimageAllStoredSets(): Promise<Record<string, unknown>> {
  const lanes: ThemedLane[] = ["weird", "comedy", "pop", "viral"]
  const jobs: Array<{ source: string; fetcher: () => Promise<StoryCluster[]>; summary: string; by: string }> = [
    { source: "top-stories", fetcher: () => fetchRecursivTopStories({ limit: 250 }), summary: "Top story clusters across the spectrum (newsapi.ai Events).", by: "reimage-top" },
    { source: "fringe-stories", fetcher: () => fetchRecursivFringeStories({ limit: 120 }), summary: "Under-covered / blackout stories (newsapi.ai Events).", by: "reimage-fringe" },
    ...lanes.map((lane) => ({
      source: THEMED_STORY_SOURCES[lane],
      fetcher: () => fetchRecursivThemedStories(lane, { limit: 120 }),
      summary: THEMED_SUMMARY[lane],
      by: `reimage-${lane}`,
    })),
  ]
  const results: Record<string, unknown> = {}
  for (const job of jobs) {
    results[job.source] = await reimageStoredSet(job.source, job.fetcher, job.summary, job.by).catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }))
  }
  return results
}

// ── Evergreen "Inverted World tales" ───────────────────────────────────────────────────────────
// Authored by THIS session's subagents (Claude) — NOT the rate-limited Recursiv chat agent — then
// enriched here with a viral YouTube clip (validated via keyless oEmbed) + a relevant/AI image, and
// stored as the evergreen "tales-stories" source that /news merges into the main feed.
export type TaleArticleInput = {
  slug: string
  category: string
  headline: string
  synopsis: string
  body: string
  concepts: string[]
  imageQuery?: string
  videoCandidates?: string[] // candidate YouTube video ids, most-relevant first
  videoQuery?: string // fallback "watch on YouTube" search query
  primarySources?: Array<{ title?: string; url: string; outlet?: string }>
}

const TALES_ENRICH_CONCURRENCY = 6

// Validate a YouTube video id via the keyless oEmbed endpoint: returns real title/author/thumbnail
// when the clip exists AND is embeddable, else null. No API key, no search-quota cost.
async function validateYouTubeVideo(id: string, query?: string): Promise<StoryVideo | null> {
  const clean = (id || "").trim()
  if (!/^[A-Za-z0-9_-]{11}$/.test(clean)) return null
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${clean}`)}&format=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "InvertedWorld/1.0" } }).catch(() => null)
  if (!res || !res.ok) return null
  const data = (await res.json().catch(() => null)) as { title?: string; author_name?: string; thumbnail_url?: string } | null
  if (!data || !data.title) return null
  return { id: clean, title: data.title, author: data.author_name, thumbnail: data.thumbnail_url, query }
}

async function firstValidVideo(candidates: string[] | undefined, query?: string): Promise<StoryVideo | undefined> {
  for (const id of candidates || []) {
    const v = await validateYouTubeVideo(id, query)
    if (v) return v
  }
  return undefined
}

function talesHostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "source"
  }
}

function slugifyTale(slug: string, fallback: string): string {
  const base = (slug || fallback || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72)
  return base || "tale"
}

// Build StoryClusters from generated tale articles: validate a viral video (oEmbed), fetch a relevant
// or AI image, attach proof links as coveringArticles, then store the evergreen tales-stories set.
// Default merge mode keeps existing tales + adds/replaces by uri; rebuild replaces the whole set.
export async function buildTalesStoriesToRecursiv(
  articles: TaleArticleInput[],
  options: { rebuild?: boolean; eventDate?: string } = {},
): Promise<{ stored: number; added: number; withVideo: number; withImage: number }> {
  const eventDate = options.eventDate || new Date().toISOString().slice(0, 10)
  const existing = options.rebuild ? [] : await fetchRecursivTalesStories({ limit: 400 }).catch(() => [] as StoryCluster[])
  const existingByUri = new Map(existing.map((story) => [story.uri, story]))

  const built = await mapWithConcurrency(
    articles.filter((article) => article && article.headline && article.body),
    TALES_ENRICH_CONCURRENCY,
    async (article) => {
      const slug = slugifyTale(article.slug, article.headline)
      const uri = `tale-${slug}`
      const concepts = (article.concepts || []).map((concept) => (concept || "").trim()).filter(Boolean).slice(0, 8)
      const sources = (article.primarySources || []).filter((source) => source && typeof source.url === "string" && /^https?:\/\//.test(source.url))
      const coveringArticles = sources.slice(0, 10).map((source) => ({
        outlet: (source.outlet || talesHostLabel(source.url)).slice(0, 48),
        headline: (source.title || source.outlet || talesHostLabel(source.url)).slice(0, 160),
        url: source.url,
      }))
      const [video, image] = await Promise.all([
        firstValidVideo(article.videoCandidates, article.videoQuery),
        fetchStoryThumbnail(
          [article.imageQuery, concepts.slice(0, 2).join(" "), concepts[0], article.headline.split(/\s+/).slice(0, 5).join(" ")],
          imageRelevanceTerms([article.headline, ...concepts]),
          article.imageQuery || `${article.headline}, ${concepts.slice(0, 3).join(", ")}`,
        ).catch(() => null),
      ])
      const story: StoryCluster = {
        uri,
        title: article.headline,
        summary: article.synopsis,
        headline: article.headline,
        synopsis: article.synopsis,
        body: article.body,
        bodySource: "agent",
        narrativeVersion: NARRATIVE_VERSION,
        concepts,
        category: (article.category || "Tales").trim(),
        articleCount: coveringArticles.length,
        coveringArticles,
        eventDate,
        lane: "tales",
        evergreen: true,
        imageQuery: article.imageQuery,
        image: image || undefined,
        imageChecked: true,
        video,
      }
      return story
    },
  )

  // Merge: this batch wins over existing by uri; keep prior tales not in this batch.
  const merged = new Map<string, StoryCluster>(existingByUri)
  let added = 0
  for (const story of built) {
    if (!merged.has(story.uri)) added += 1
    merged.set(story.uri, story)
  }
  const stories = [...merged.values()]
  const withVideo = stories.filter((story) => story.video?.id).length
  const withImage = stories.filter((story) => story.image?.url).length

  const { sdk, config } = getInvertedWorldDatabase()
  await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `INSERT INTO coverage_snapshots (topic_id, query, source, items, summary, velocity_score, metadata)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb)`,
    params: [
      TALES_STORY_SOURCE,
      TALES_STORY_SOURCE,
      TALES_STORY_SOURCE,
      JSON.stringify(stories),
      "Evergreen Inverted World tales (UAP, cryptids, declassified, ancient mysteries, the paranormal).",
      String(stories.length),
      JSON.stringify({ generatedBy: "tales-subagents-v1", storyCount: stories.length, added, withVideo, withImage }),
    ],
  })
  return { stored: stories.length, added, withVideo, withImage }
}

export async function syncWorldwireCoverageToRecursiv(options: { limitPerLane?: number } = {}) {
  const { sdk, config } = getInvertedWorldDatabase()
  const limitPerLane = Math.max(1, Math.min(Math.trunc(options.limitPerLane || 12), 24))
  const items = (await fetchWorldwireItems())
    .map(compactWorldwireItem)
    .filter((item) => item.title && item.url && item.url.startsWith("http"))
  const grouped = groupWorldwireByLane(items)
  const lanes: Array<{ laneId: string; title: string; query: string; items: WorldwireItem[] }> = WORLDWIRE_LANES.map((lane) => ({
    laneId: lane.id,
    title: lane.title,
    query: lane.query,
    items: (grouped.get(lane.id) || [])
      .sort((left, right) => right.score - left.score)
      .slice(0, limitPerLane),
  })).filter((lane) => lane.items.length > 0)

  if (lanes.length) {
    for (const lane of lanes) {
      const sourceHosts = Array.from(new Set(lane.items.map((item) => item.source).filter(Boolean))).slice(0, 12)
      const velocityScore = Math.round(lane.items.reduce((sum, item) => sum + (item.score || 0), 0))
      const safeVelocityScore = Number.isFinite(velocityScore) ? velocityScore : 0
      await sdk.databases.query({
        project_id: config.projectId,
        database_name: config.databaseName,
        sql: `INSERT INTO coverage_snapshots (
          topic_id,
          query,
          source,
          items,
          summary,
          velocity_score,
          metadata
        )
        VALUES ($1, $2, 'worldwire', $3::jsonb, $4, $5, $6::jsonb)`,
        params: [
          lane.laneId,
          lane.query,
          JSON.stringify(lane.items),
          `${lane.title} worldwire snapshot from Recursiv crawler output.`,
          String(safeVelocityScore),
          JSON.stringify({
            generatedBy: "recursiv-worldwire-crawler-v1",
            laneTitle: lane.title,
            itemCount: lane.items.length,
            sourceHosts,
          }),
        ],
      })
    }
  }

  return {
    snapshots: lanes.length,
    crawledItems: items.length,
    storedItems: lanes.reduce((sum, lane) => sum + lane.items.length, 0),
    limitPerLane,
    lanes: lanes.map((lane) => ({ id: lane.laneId, title: lane.title, items: lane.items.length })),
  }
}

async function clearXProfileReaderSignals(sdk: RecursivServerClient, projectId: string, databaseName: string, topicId: string) {
  await sdk.databases.query({
    project_id: projectId,
    database_name: databaseName,
    sql: "DELETE FROM x_signals WHERE topic_id = $1 AND source = 'x-profile-reader'",
    params: [topicId],
  })
}

async function upsertXSignal(sdk: RecursivServerClient, projectId: string, databaseName: string, post: ViralXPost) {
  await sdk.databases.query({
    project_id: projectId,
    database_name: databaseName,
    sql: `INSERT INTO x_signals (
        topic_id,
        x_id,
        url,
        username,
        author_name,
        text,
        posted_at,
        source,
        score,
        metrics
      )
      VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, '')::timestamptz, $8, $9, $10::jsonb)
      ON CONFLICT (x_id) DO UPDATE SET
        topic_id = EXCLUDED.topic_id,
        url = EXCLUDED.url,
        username = EXCLUDED.username,
        author_name = EXCLUDED.author_name,
        text = EXCLUDED.text,
        posted_at = EXCLUDED.posted_at,
        source = EXCLUDED.source,
        score = EXCLUDED.score,
        metrics = EXCLUDED.metrics,
        captured_at = now()`,
    params: [
      post.topicId || "secret-programs",
      post.id,
      post.url,
      post.username || "",
      post.authorName || "",
      post.text,
      post.createdAt || "",
      post.source || "x-api",
      post.score || 0,
      JSON.stringify(post.metrics || {}),
    ],
  })
}

export async function generateClaimDossiersInRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
  let dossiersUpserted = 0
  let sourcesUpserted = 0

  for (const topic of topics) {
    const [articles, posts, videosResult] = await Promise.all([
      fetchLiveArticlesForTopic(topic.id, topic.query.replaceAll('"', ""), { allowProviderFallbacks: true }).catch(() => []),
      fetchViralXPostsForTopic(topic.id, { limit: 12, allowProviderFallbacks: true }).catch(() => []),
      sdk.databases.query({
        project_id: config.projectId,
        database_name: config.databaseName,
        sql: `SELECT source_id, source_url, title, description, published_at, topic_id, thumbnail_url, embed_url, kind
          FROM channel_items
          WHERE source = 'youtube' AND topic_id = $1
          ORDER BY published_at DESC NULLS LAST
          LIMIT 12`,
        params: [topic.id],
      }),
    ])

    const lead = articles[0]
    const videos = dedupeVideos(
      (videosResult.data.rows || []).map((row) => ({
        title: String(row.title || "Tales From the Inverted World"),
        date: row.published_at ? String(row.published_at).slice(0, 10) : "",
        href: String(row.source_url || "#"),
        topicId: String(row.topic_id || topic.id),
        source: "YouTube",
        videoId: typeof row.source_id === "string" ? row.source_id : undefined,
        embedUrl: typeof row.embed_url === "string" ? row.embed_url : undefined,
        thumbnail: typeof row.thumbnail_url === "string" ? row.thumbnail_url : undefined,
        description: typeof row.description === "string" ? row.description : undefined,
        kind: row.kind === "short" ? "short" : "episode",
      })),
    ).slice(0, 6) satisfies ChannelVideo[]

    const xVelocityScore = Math.round(posts.reduce((sum, post) => sum + postScore(post), 0))
    const sourceLinks = await enrichSourceLinks(articles.slice(0, 10).map((article, index) => {
      const kind = sourceKind(article.source, article.sourceUrl)
      const lane = biasLane(article.source, article.sourceUrl)
      return {
        title: article.title,
        url: article.sourceUrl,
        outlet: article.source,
        sourceKind: kind,
        stance: index === 0 ? "lead" : "context",
        biasLane: lane,
        publishedAt: article.publishedAt,
        credibilityScore: kind === "official" ? 92 : lane === "mainstream" ? 72 : lane === "independent" ? 64 : 58,
      }
    }))
    const grade = evidenceGrade(sourceLinks, xVelocityScore)
    const confidenceScore = confidenceScoreFor(grade, sourceLinks.length, posts.length)
    const title = `${topic.title}: ${lead?.title || topic.signal}`
    const slug = `${topic.id}-${cleanSlug(lead?.title || topic.signal || title)}`
    const claim = lead?.title || `${topic.signal} is generating new coverage and archive relevance.`
    const viralHeadlines = [
      `${topic.title}: what they are not saying about ${lead?.title || "the latest signal"}`,
      `X is moving this ${topic.title} story before the institutions catch up`,
      `The weird read and skeptical read on ${lead?.title || topic.signal}`,
      `What records show, what X claims, and what is still missing`,
    ]
    const summary = [
      lead ? `${lead.source} is carrying the lead item: ${lead.title}.` : `${topic.title} has a fresh signal cluster but no single lead article yet.`,
      `${sourceLinks.length} source links, ${posts.length} X signals, and ${videos.length} Tales archive items are attached to this dossier.`,
      `Evidence grade is ${grade}; this is an editorial assessment of source strength, not a final truth verdict.`,
    ].join(" ")
    const weirdRead = `The weird read: repeated timing, institutional silence, or language drift around ${topic.title.toLowerCase()} may be the actual signal. Watch for documents that appear only after the narrative has already moved.`
    const skepticalRead = `The skeptical read: viral heat can come from old claims, weak sourcing, or incentive loops. Treat X velocity as a lead generator, then demand primary records before upgrading the claim.`
    const chatPrompt = `You are the Inverted World dossier analyst. Answer from this dossier only. Separate documented fact, allegation, inference, speculation, and unknowns. Dossier: ${title}. Claim: ${claim}. Evidence grade: ${grade}. Summary: ${summary}`

    const dossierResult = await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `INSERT INTO claim_dossiers (
          slug,
          title,
          deck,
          topic_id,
          claim,
          summary,
          status,
          evidence_grade,
          confidence_score,
          x_velocity_score,
          source_count,
          x_signal_count,
          related_video_count,
          source_links,
          x_signals,
          related_videos,
          weird_read,
          skeptical_read,
          viral_headlines,
          chat_prompt,
          published_at,
          metadata,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'published', $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17, $18::jsonb, $19, now(), $20::jsonb, now())
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          deck = EXCLUDED.deck,
          claim = EXCLUDED.claim,
          summary = EXCLUDED.summary,
          status = EXCLUDED.status,
          evidence_grade = EXCLUDED.evidence_grade,
          confidence_score = EXCLUDED.confidence_score,
          x_velocity_score = EXCLUDED.x_velocity_score,
          source_count = EXCLUDED.source_count,
          x_signal_count = EXCLUDED.x_signal_count,
          related_video_count = EXCLUDED.related_video_count,
          source_links = EXCLUDED.source_links,
          x_signals = EXCLUDED.x_signals,
          related_videos = EXCLUDED.related_videos,
          weird_read = EXCLUDED.weird_read,
          skeptical_read = EXCLUDED.skeptical_read,
          viral_headlines = EXCLUDED.viral_headlines,
          chat_prompt = EXCLUDED.chat_prompt,
          published_at = COALESCE(claim_dossiers.published_at, EXCLUDED.published_at),
          metadata = EXCLUDED.metadata,
          updated_at = now()
        RETURNING id`,
      params: [
        slug,
        title,
        `Latest sourced reporting in ${topic.title}, with original links, social context, and related Tales archive material beside it.`,
        topic.id,
        claim,
        summary,
        grade,
        confidenceScore,
        xVelocityScore,
        sourceLinks.length,
        posts.length,
        videos.length,
        JSON.stringify(sourceLinks),
        JSON.stringify(posts.slice(0, 12)),
        JSON.stringify(videos),
        weirdRead,
        skepticalRead,
        JSON.stringify(viralHeadlines),
        chatPrompt,
        JSON.stringify({ generatedBy: "recursiv-claim-dossier-v1", leadSource: lead?.source || null }),
      ],
    })

    const dossierId = dossierResult.data.rows[0]?.id
    if (dossierId) {
      await sdk.databases.query({
        project_id: config.projectId,
        database_name: config.databaseName,
        sql: "DELETE FROM claim_sources WHERE dossier_id = $1",
        params: [dossierId],
      })
      for (const source of sourceLinks) {
        await sdk.databases.query({
          project_id: config.projectId,
          database_name: config.databaseName,
          sql: `INSERT INTO claim_sources (
              dossier_id,
              source_kind,
              title,
              url,
              outlet,
              stance,
              bias_lane,
              published_at,
              credibility_score,
              metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::timestamptz, $9, $10::jsonb)
            ON CONFLICT (dossier_id, url) DO UPDATE SET
              source_kind = EXCLUDED.source_kind,
              title = EXCLUDED.title,
              outlet = EXCLUDED.outlet,
              stance = EXCLUDED.stance,
              bias_lane = EXCLUDED.bias_lane,
              published_at = EXCLUDED.published_at,
              credibility_score = EXCLUDED.credibility_score,
              metadata = EXCLUDED.metadata`,
          params: [
            dossierId,
            source.sourceKind,
            source.title,
            source.url,
            source.outlet || "",
            source.stance || "context",
            source.biasLane || "open-web",
            source.publishedAt || "",
            source.credibilityScore || 0,
            JSON.stringify({
              topic: topic.title,
              excerpt: source.excerpt || null,
              extractionProvider: source.extractionProvider || null,
              extractedTitle: source.extractedTitle || null,
              extractedDescription: source.extractedDescription || null,
            }),
          ],
        })
        sourcesUpserted += 1
      }
    }

    dossiersUpserted += 1
  }

  return { dossiersUpserted, sourcesUpserted }
}

function normalizeArticleGenerationLimit(value?: number) {
  return Math.max(1, Math.min(Math.trunc(Number(value || process.env.ARTICLE_GENERATION_LIMIT || "6")) || 6, 12))
}

export async function generateArticleDraftsInRecursiv(options: ArticleGenerationOptions = {}) {
  const { sdk, config } = getInvertedWorldDatabase()
  const limit = normalizeArticleGenerationLimit(options.limit)
  const useAgent = options.useAgent ?? process.env.ARTICLE_GENERATION_USE_AGENT !== "0"
  const { data } = await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `SELECT
        id,
        slug,
        title,
        deck,
        topic_id,
        claim,
        summary,
        evidence_grade,
        confidence_score,
        x_velocity_score,
        source_count,
        x_signal_count,
        related_video_count,
        source_links,
        x_signals,
        related_videos,
        weird_read,
        skeptical_read,
        viral_headlines,
        metadata
      FROM claim_dossiers
      WHERE status = 'published'
      ORDER BY x_velocity_score DESC NULLS LAST, updated_at DESC
      LIMIT $1`,
    params: [limit],
  })

  let created = 0
  for (const row of data.rows as ClaimDossierDraftRow[]) {
    const topic = topics.find((item) => item.id === row.topic_id)
    if (!topic) continue

    const draft = await generateDossierArticleDraft(sdk, config.agentId, row, topic, { useAgent })
    const sourceLinks = jsonArray(row.source_links).map(jsonObject)
    const leadSource = sourceLinks[0] || {}
    const dossierSlug = row.slug || cleanSlug(row.title || row.claim || topic.title)
    const slug = `brief-${dossierSlug}`
    const heat = Math.min(100, Math.round(asNumber(row.confidence_score) + Math.min(asNumber(row.x_velocity_score) / 90, 24)))

    await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `INSERT INTO article_drafts (
          slug,
          title,
          deck,
          topic_id,
          status,
          body,
          source_ids,
          source_name,
          source_url,
          heat,
          thumbnail_prompt,
          model,
          prompt_version,
          metadata,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'draft', $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, 'dossier-article-v2', $12::jsonb, now())
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          deck = EXCLUDED.deck,
          topic_id = EXCLUDED.topic_id,
          status = CASE WHEN article_drafts.status = 'published' THEN article_drafts.status ELSE EXCLUDED.status END,
          body = EXCLUDED.body,
          source_ids = EXCLUDED.source_ids,
          source_name = EXCLUDED.source_name,
          source_url = EXCLUDED.source_url,
          heat = EXCLUDED.heat,
          thumbnail_prompt = EXCLUDED.thumbnail_prompt,
          model = EXCLUDED.model,
          prompt_version = EXCLUDED.prompt_version,
          metadata = EXCLUDED.metadata,
          updated_at = now()`,
      params: [
        slug,
        draft.title,
        draft.deck,
        topic.id,
        JSON.stringify(draft.body),
        JSON.stringify([row.id, ...sourceLinks.slice(0, 8).map((source) => textField(source.url)).filter(Boolean)].filter(Boolean)),
        String(leadSource.outlet || leadSource.sourceKind || "Inverted World Dossier"),
        `/news/${dossierSlug}`,
        heat,
        `Inverted World thumbnail for "${draft.title}": ${topic.signal}, source graph, X velocity, evidence grade ${row.evidence_grade || "developing"}, amber-black editorial palette, no fake documents, no faces.`,
        draft.mode === "agent" ? "recursiv-agent" : "deterministic-dossier-writer",
        JSON.stringify({
          generatedBy: draft.mode === "agent" ? "recursiv-agent-dossier-article-v2" : "recursiv-dossier-article-v2",
          dossierId: row.id || null,
          dossierSlug,
          evidenceGrade: row.evidence_grade || "developing",
          confidenceScore: asNumber(row.confidence_score),
          xVelocityScore: asNumber(row.x_velocity_score),
          sourceCount: asNumber(row.source_count),
          xSignalCount: asNumber(row.x_signal_count),
          sourceLinks: sourceLinks.slice(0, 8).map((source) => ({
            title: textField(source.title),
            url: textField(source.url),
            outlet: textField(source.outlet),
            biasLane: textField(source.biasLane || source.bias_lane),
            sourceKind: textField(source.sourceKind || source.source_kind),
          })),
        }),
      ],
    })
    created += 1
  }

  return { draftsUpserted: created, limit, useAgent }
}

export async function generateImagesForDraftsInRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
  const { data } = await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `SELECT id, slug, title, thumbnail_prompt
      FROM article_drafts
      WHERE thumbnail_asset_id IS NULL AND thumbnail_prompt IS NOT NULL AND thumbnail_prompt <> ''
      ORDER BY generated_at DESC
      LIMIT 5`,
  })

  let generated = 0
  let fallbackImages = 0
  for (const row of data.rows) {
    const prompt = String(row.thumbnail_prompt || "")
    if (!prompt) continue
    let image: { data: { provider: string; url: string } }
    try {
      image = await sdk.media.generateImage({
        prompt,
        provider: "flux",
        size: "1024x1024",
        style: "vivid",
      })
    } catch {
      fallbackImages += 1
      image = {
        data: {
          provider: "inverted-world-svg-fallback",
          url: generatedSvgThumbnail(String(row.title || row.slug || "Inverted World brief"), String(row.slug || "brief")),
        },
      }
    }
    const asset = await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `INSERT INTO generated_assets (asset_type, prompt, provider, url, status, metadata)
        VALUES ('article-thumbnail', $1, $2, $3, 'generated', $4::jsonb)
        RETURNING id`,
      params: [
        prompt,
        image.data.provider,
        image.data.url,
        JSON.stringify({ articleSlug: row.slug, fallback: image.data.provider === "inverted-world-svg-fallback" }),
      ],
    })
    const assetId = asset.data.rows[0]?.id
    if (assetId) {
      await sdk.databases.query({
        project_id: config.projectId,
        database_name: config.databaseName,
        sql: "UPDATE article_drafts SET thumbnail_asset_id = $1, updated_at = now() WHERE id = $2",
        params: [assetId, row.id],
      })
    }
    generated += 1
  }

  return { imagesGenerated: generated, fallbackImages }
}

export async function publishReadyDraftsInRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
  const { data } = await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `UPDATE article_drafts
      SET status = 'published', published_at = COALESCE(published_at, now()), updated_at = now()
      WHERE status = 'draft'
        AND jsonb_array_length(body) >= 4
      RETURNING id, slug, title`,
  })

  return { published: data.rows.length, articles: data.rows }
}

type FrontPageWorldwireItem = {
  title: string
  href: string
  topicId: string
  source: string
  heat: number
  publishedAt: string
  excerpt: string
}

function worldwireItemTime(item: Pick<FrontPageWorldwireItem, "publishedAt">) {
  const time = item.publishedAt ? new Date(item.publishedAt).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function isFreshWorldwireItem(item: Pick<FrontPageWorldwireItem, "publishedAt">) {
  const time = worldwireItemTime(item)
  const freshWindowHours = Math.max(6, Math.trunc(Number(process.env.FRONT_PAGE_FRESH_NEWS_WINDOW_HOURS || "36")) || 36)
  return Boolean(time && Date.now() - time <= freshWindowHours * 60 * 60 * 1000)
}

function worldwireRowsToFrontPageItems(rows: Record<string, unknown>[]) {
  const items: FrontPageWorldwireItem[] = []

  for (const row of rows) {
    const laneId = textField(row.topic_id) || "front-page"
    const laneTitle = WORLDWIRE_LANES.find((lane) => lane.id === laneId)?.title || "Worldwire"
    const rowScore = asNumber(row.velocity_score) || 100

    jsonArray(row.items).forEach((value, index) => {
      const item = jsonObject(value)
      const title = cleanStoryTitle(normalizeWorldwireText(textField(item.title)), laneId, "")
      const href = textField(item.url)
      if (!title || !isUsefulWorldwireTitle(title) || !isExternalUrl(href) || isGoogleNewsUrl(href) || !looksLikeArticleUrl(href)) return

      items.push({
        title,
        href,
        topicId: textField(item.sectionId) || textField(item.section_id) || laneId,
        source: sourceLabel(textField(item.source) || laneTitle, href),
        heat: asNumber(item.score) || rowScore - index,
        publishedAt: textField(item.publishedAt) || textField(item.published_at) || textField(row.captured_at),
        excerpt: shorten(textField(item.excerpt) || textField(row.summary), 220),
      })
    })
  }

  const freshItems = items.filter(isFreshWorldwireItem)
  return (freshItems.length >= 8 ? freshItems : items)
    .sort((left, right) => {
      const time = worldwireItemTime(right) - worldwireItemTime(left)
      if (time) return time
      return right.heat - left.heat
    })
}

export async function publishFrontPageEditionInRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
  const countTables = [
    "channel_items",
    "coverage_snapshots",
    "x_signals",
    "article_drafts",
    "generated_assets",
    "claim_dossiers",
    "claim_sources",
    "source_documents",
    "media_items",
  ]
  const [articlesResult, dossiersResult, xSignalsResult, videosResult, worldwireResult, countResults] = await Promise.all([
    sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `SELECT
          a.slug,
          a.title,
          a.deck,
          a.topic_id,
          a.source_name,
          a.source_url,
          a.heat,
          a.published_at,
          ga.url AS asset_url
        FROM article_drafts a
        LEFT JOIN generated_assets ga ON ga.id = a.thumbnail_asset_id
        WHERE a.status = $1
        ORDER BY
          CASE WHEN a.published_at > now() - interval '48 hours' THEN 0 ELSE 1 END,
          a.heat DESC NULLS LAST,
          a.published_at DESC NULLS LAST
        LIMIT $2`,
      params: ["published", 12],
    }),
    sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `SELECT
          slug,
          title,
          deck,
          topic_id,
          evidence_grade,
          confidence_score,
          x_velocity_score,
          source_count,
          x_signal_count,
          related_video_count,
          published_at
        FROM claim_dossiers
        WHERE status = $1
        ORDER BY
          CASE WHEN published_at > now() - interval '48 hours' THEN 0 ELSE 1 END,
          x_velocity_score DESC NULLS LAST,
          published_at DESC NULLS LAST,
          updated_at DESC
        LIMIT $2`,
      params: ["published", 12],
    }),
    sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `SELECT
          x_id,
          url,
          username,
          author_name,
          text,
          topic_id,
          score,
          posted_at
        FROM x_signals
        ORDER BY score DESC NULLS LAST, posted_at DESC NULLS LAST, captured_at DESC
        LIMIT 18`,
    }),
    sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `SELECT
          source_id,
          source_url,
          title,
          topic_id,
          thumbnail_url,
          published_at
        FROM channel_items
        WHERE source = $1
        ORDER BY published_at DESC NULLS LAST
        LIMIT $2`,
      params: ["youtube", 8],
    }),
    sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `WITH ranked AS (
          SELECT
            topic_id,
            captured_at,
            items,
            summary,
            velocity_score,
            metadata,
            row_number() OVER (
              PARTITION BY topic_id
              ORDER BY captured_at DESC, created_at DESC
            ) AS lane_rank
          FROM coverage_snapshots
          WHERE source = 'worldwire'
        )
        SELECT
          topic_id,
          captured_at,
          items,
          summary,
          velocity_score,
          metadata
        FROM ranked
        WHERE lane_rank = 1
        ORDER BY
          CASE WHEN topic_id = 'front-page' THEN 0 ELSE 1 END,
          captured_at DESC
        LIMIT 18`,
    }),
    Promise.all(
      countTables.map((table) =>
        sdk.databases.query({
          project_id: config.projectId,
          database_name: config.databaseName,
          sql: `SELECT count(*)::int AS count FROM ${table}`,
        }),
      ),
    ),
  ])

  const articles = articlesResult.data.rows.map((row) => {
    const item = jsonObject(row)
    const topicId = textField(item.topic_id)
    const title = cleanStoryTitle(item.title, topicId)
    return {
      title,
      href: publicNewsHref(textField(item.slug), title, topicId),
      topicId,
      source: shorten(item.source_name, 80) || "Inverted World",
      heat: asNumber(item.heat),
      publishedAt: textField(item.published_at),
    }
  })
  const dossiers = dossiersResult.data.rows.map((row) => {
    const item = jsonObject(row)
    const topicId = textField(item.topic_id)
    const title = cleanStoryTitle(item.title, topicId)
    const slug = publicNewsSlug(textField(item.slug), title, topicId)
    return {
      title,
      href: `/news/${slug}`,
      slug,
      topicId,
      evidenceGrade: textField(item.evidence_grade),
      confidenceScore: asNumber(item.confidence_score),
      xVelocityScore: asNumber(item.x_velocity_score),
      sourceCount: asNumber(item.source_count),
      xSignalCount: asNumber(item.x_signal_count),
      relatedVideoCount: asNumber(item.related_video_count),
      publishedAt: textField(item.published_at),
    }
  })
  const xSignals = xSignalsResult.data.rows.map((row) => {
    const item = jsonObject(row)
    return {
      id: textField(item.x_id),
      href: textField(item.url),
      username: textField(item.username),
      authorName: textField(item.author_name),
      text: shorten(item.text, 140),
      topicId: textField(item.topic_id),
      score: asNumber(item.score),
      postedAt: textField(item.posted_at),
    }
  })
  const archiveVideos = videosResult.data.rows.map((row) => {
    const item = jsonObject(row)
    return {
      title: shorten(item.title, 140),
      href: textField(item.source_id) ? `/archive/${textField(item.source_id)}` : textField(item.source_url),
      topicId: textField(item.topic_id),
      publishedAt: textField(item.published_at),
    }
  })

  const countMetrics = Object.fromEntries(
    countTables.map((table, index) => [table, asNumber(countResults[index]?.data.rows[0]?.count)]),
  )
  const editionDate = new Date().toISOString().slice(0, 10)
  const slug = `front-page-${editionDate}`
  const worldwire = worldwireRowsToFrontPageItems(worldwireResult.data.rows)
  const editionWorldwire = diversifyFrontPageItems(worldwire, 10, 3)
  const editionArticles = diversifyFrontPageItems(articles, 5, 2)
  const editionDossiers = diversifyFrontPageItems(dossiers, 6, 2)
  const editionSignals = diversifyFrontPageItems(xSignals, 5, 2)
  const editionVideos = diversifyFrontPageItems(archiveVideos, 4, 2)
  const headline = cleanStoryTitle(
    editionWorldwire[0]?.title || editionArticles[0]?.title || editionDossiers[0]?.title || "Inverted World front page",
    editionWorldwire[0]?.topicId || editionArticles[0]?.topicId || editionDossiers[0]?.topicId,
    "Inverted World front page",
  )
  const deck = `Today's edition tracks ${worldwire.length} live source links, ${articles.length} stories, ${xSignals.length} X signals, and ${archiveVideos.length} Tales archive links across the conspiracy-world desk.`
  const sections = {
    leadWorldwire: editionWorldwire[0],
    worldwire: editionWorldwire,
    leadDossier: editionDossiers[0],
    leadArticle: editionArticles[0],
    articles: editionArticles,
    dossiers: editionDossiers,
    xSignals: editionSignals,
    archiveVideos: editionVideos,
  }
  const metrics = {
    ...countMetrics,
    articleCount: articles.length,
    dossierCount: dossiers.length,
    xSignalCount: xSignals.length,
    archiveVideoCount: archiveVideos.length,
    worldwireCount: worldwire.length,
    generatedAssetCount: countMetrics.generated_assets || 0,
  }

  await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: "DELETE FROM front_page_editions WHERE slug = $1",
    params: [slug],
  })

  await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `INSERT INTO front_page_editions (
        slug,
        edition_date,
        headline,
        deck,
        status,
        lead_dossier_slug,
        sections,
        metrics,
        published_at,
        metadata,
        updated_at
      )
      VALUES (
        $1,
        $2::date,
        $3,
        $4,
        $5,
        $6,
        jsonb_build_object(
          'leadWorldwire', $7::jsonb,
          'worldwire', $8::jsonb,
          'leadDossier', $9::jsonb,
          'leadArticle', $10::jsonb,
          'articles', $11::jsonb,
          'dossiers', $12::jsonb,
          'xSignals', $13::jsonb,
          'archiveVideos', $14::jsonb
        ),
        $15::jsonb,
        now(),
        $16::jsonb,
        now()
      )`,
    params: [
      slug,
      editionDate,
      headline,
      deck,
      "published",
      editionDossiers[0]?.slug || "",
      JSON.stringify(sections.leadWorldwire || null),
      JSON.stringify(sections.worldwire),
      JSON.stringify(sections.leadDossier || null),
      JSON.stringify(sections.leadArticle || null),
      JSON.stringify(sections.articles),
      JSON.stringify(sections.dossiers),
      JSON.stringify(sections.xSignals),
      JSON.stringify(sections.archiveVideos),
      JSON.stringify(metrics),
      JSON.stringify({ generatedBy: "recursiv-front-page-edition-v2", boundedParams: true }),
    ],
  })

  return {
    editionSlug: slug,
    headline,
    worldwireCount: worldwire.length,
    articleCount: articles.length,
    dossierCount: dossiers.length,
    xSignalCount: xSignals.length,
    archiveVideoCount: archiveVideos.length,
  }
}

type PipelineStep = {
  step: string
  ok: boolean
  durationMs: number
  result?: unknown
  error?: string
}

export type FullPipelineMode = "scheduled" | "all"

const PIPELINE_STALE_AFTER_MINUTES = Math.max(
  1,
  Math.trunc(Number(process.env.RECURSIV_PIPELINE_STALE_AFTER_MINUTES || "30")) || 30,
)
const PIPELINE_STALE_CLEANUP_TIMEOUT_MS = Math.max(
  1000,
  Math.trunc(Number(process.env.RECURSIV_PIPELINE_STALE_CLEANUP_TIMEOUT_MS || "15000")) || 15000,
)

function normalizePipelineMode(mode?: string | null): FullPipelineMode {
  return mode === "all" ? "all" : "scheduled"
}

function normalizeStaleAfterMinutes(value?: number) {
  return Math.max(1, Math.trunc(Number(value || PIPELINE_STALE_AFTER_MINUTES)) || PIPELINE_STALE_AFTER_MINUTES)
}

async function runPipelineStep(step: string, fn: () => Promise<unknown>): Promise<PipelineStep> {
  const started = Date.now()
  try {
    const result = await fn()
    return {
      step,
      ok: true,
      durationMs: Date.now() - started,
      result,
    }
  } catch (error) {
    return {
      step,
      ok: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function markStalePipelineRuns(
  sdk: RecursivServerClient,
  config: RecursivDatabaseConfig,
  jobName: string,
  staleAfterMinutes = PIPELINE_STALE_AFTER_MINUTES,
) {
  const staleMinutes = normalizeStaleAfterMinutes(staleAfterMinutes)
  const staleMessage = `Pipeline run did not complete within ${staleMinutes} minutes.`
  const { data } = await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `UPDATE pipeline_runs
      SET status = $1,
        completed_at = COALESCE(completed_at, now()),
        duration_ms = GREATEST(duration_ms, FLOOR(EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::int),
        error = COALESCE(NULLIF(error, ''), $2),
        metadata = metadata || $3::jsonb,
        updated_at = now()
      WHERE job_name = $4
        AND status = $5
        AND started_at < now() - ($6::int * interval '1 minute')
      RETURNING id`,
    params: [
      "stale_running",
      staleMessage,
      JSON.stringify({
        staleMarkedAt: new Date().toISOString(),
        staleAfterMinutes: staleMinutes,
      }),
      jobName,
      "running",
      staleMinutes,
    ],
  })

  return {
    staleRunCount: data.rows.length,
    staleRunIds: data.rows.map((row) => textField((row as { id?: unknown }).id)).filter(Boolean),
  }
}

async function markStalePipelineRunsForPipelineStart(
  sdk: RecursivServerClient,
  config: RecursivDatabaseConfig,
  jobName: string,
  staleAfterMinutes?: number,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      markStalePipelineRuns(sdk, config, jobName, staleAfterMinutes),
      new Promise<{ staleRunCount: number; staleRunIds: string[]; warning: string }>((resolve) => {
        timeout = setTimeout(
          () =>
            resolve({
              staleRunCount: 0,
              staleRunIds: [],
              warning: `Skipped stale-run cleanup after ${PIPELINE_STALE_CLEANUP_TIMEOUT_MS}ms so the pipeline could start.`,
            }),
          PIPELINE_STALE_CLEANUP_TIMEOUT_MS,
        )
      }),
    ])
  } catch (error) {
    return {
      staleRunCount: 0,
      staleRunIds: [],
      warning: `Skipped stale-run cleanup: ${error instanceof Error ? error.message : String(error)}`,
    }
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function markStalePipelineRunsInRecursiv(options: { jobName?: string; staleAfterMinutes?: number } = {}) {
  const { sdk, config } = getInvertedWorldDatabase()
  return markStalePipelineRuns(
    sdk,
    config,
    options.jobName || "full-pipeline",
    options.staleAfterMinutes,
  )
}

async function persistPipelineProgress(
  sdk: RecursivServerClient,
  config: RecursivDatabaseConfig,
  runId: string,
  started: number,
  steps: PipelineStep[],
  currentStep = "",
) {
  if (!runId) return
  const lastStep = steps.at(-1)
  await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `UPDATE pipeline_runs
      SET duration_ms = $1,
        results = $2::jsonb,
        metadata = metadata || $3::jsonb,
        updated_at = now()
      WHERE id = $4`,
    params: [
      Date.now() - started,
      JSON.stringify(steps),
      JSON.stringify({
        progressUpdatedAt: new Date().toISOString(),
        currentStep,
        lastCompletedStep: lastStep?.step || "",
        lastCompletedStepOk: lastStep?.ok ?? null,
      }),
      runId,
    ],
  })
}

export async function runFullPipelineInRecursiv(options: { mode?: string | null; staleAfterMinutes?: number; profileReader?: boolean } = {}) {
  const { sdk, config } = getInvertedWorldDatabase()
  const started = Date.now()
  const mode = normalizePipelineMode(options.mode)
  const profileReader = options.profileReader !== false
  const run = await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `INSERT INTO pipeline_runs (job_name, status, metadata)
      VALUES ($1, $2, $3::jsonb)
      RETURNING id`,
    params: [
      "full-pipeline",
      "running",
      JSON.stringify({
        generatedBy: "recursiv-full-pipeline-v1",
        mode,
        profileReader,
        siteUrl: process.env.INVERTED_WORLD_SITE_URL || "https://invertedworld.on.recursiv.io",
        staleCleanup: {
          staleRunCount: 0,
          staleRunIds: [],
          status: "pending",
        },
      }),
    ],
  })
  const runId = String(run.data.rows[0]?.id || "")
  void markStalePipelineRunsForPipelineStart(sdk, config, "full-pipeline", options.staleAfterMinutes)
    .then((staleCleanup) =>
      runId
        ? sdk.databases.query({
            project_id: config.projectId,
            database_name: config.databaseName,
            sql: `UPDATE pipeline_runs
              SET metadata = metadata || $1::jsonb,
                updated_at = now()
              WHERE id = $2`,
            params: [JSON.stringify({ staleCleanup }), runId],
          })
        : undefined,
    )
    .catch(() => undefined)
  const steps: PipelineStep[] = []

  const allStepDefinitions: Array<[string, () => Promise<unknown>]> = [
    ["source-documents", syncSourceDocumentsToRecursiv],
    ["media-library", syncMediaLibraryToRecursiv],
    ["youtube-archive-sync", syncYouTubeArchiveToRecursiv],
    ["topic-pulse", () => syncTopicPulseToRecursiv({ profileReader })],
    ["worldwire", syncWorldwireCoverageToRecursiv],
    ["top-stories", () => syncTopStoriesToRecursiv()],
    ["under-covered-stories", () => syncUnderCoveredStoriesToRecursiv()],
    ["claim-dossiers", generateClaimDossiersInRecursiv],
    ["article-generation", generateArticleDraftsInRecursiv],
    ["image-generation", generateImagesForDraftsInRecursiv],
    ["publishing", publishReadyDraftsInRecursiv],
    ["front-page-edition", publishFrontPageEditionInRecursiv],
    ["daily-autopost", buildDailyAutopostJobResult],
  ]
  const scheduledStepDefinitions: Array<[string, () => Promise<unknown>]> = [
    ["source-documents", syncSourceDocumentsToRecursiv],
    ["media-library", syncMediaLibraryToRecursiv],
    ["youtube-archive-sync", syncYouTubeArchiveToRecursiv],
    ["topic-pulse", () => syncTopicPulseToRecursiv({ profileReader })],
    ["worldwire", syncWorldwireCoverageToRecursiv],
    // top-stories runs on its own dedicated hourly cron (inverted-world-top-stories), so it is
    // intentionally omitted here to avoid the heavy 10x generation running twice per window.
    ["publishing", publishReadyDraftsInRecursiv],
    ["front-page-edition", publishFrontPageEditionInRecursiv],
    ["daily-autopost", buildDailyAutopostJobResult],
  ]
  const stepDefinitions = mode === "all" ? allStepDefinitions : scheduledStepDefinitions
  const skippedSteps = mode === "all" ? [] : allStepDefinitions.map(([step]) => step).filter((step) => !stepDefinitions.some(([activeStep]) => activeStep === step))

  for (const [step, fn] of stepDefinitions) {
    await persistPipelineProgress(sdk, config, runId, started, steps, step).catch(() => undefined)
    steps.push(await runPipelineStep(step, fn))
    await persistPipelineProgress(sdk, config, runId, started, steps).catch(() => undefined)
  }

  const status = steps.every((step) => step.ok) ? "succeeded" : "partial_failure"
  const durationMs = Date.now() - started
  const failedSteps = steps.filter((step) => !step.ok)

  if (runId) {
    await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `UPDATE pipeline_runs
        SET status = $1,
          completed_at = now(),
          duration_ms = $2,
          results = $3::jsonb,
          error = $4,
          updated_at = now()
        WHERE id = $5`,
      params: [
        status,
        durationMs,
        JSON.stringify(steps),
        failedSteps.map((step) => `${step.step}: ${step.error}`).join("\n"),
        runId,
      ],
    })
  }

  return {
    runId,
    status,
    durationMs,
    staleCleanup: { status: "background" },
    mode,
    skippedSteps,
    steps,
  }
}
