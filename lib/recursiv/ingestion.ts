import { channelProfile, topics, type ChannelVideo } from "@/data/inverted-world"
import { fetchLiveArticlesForTopic } from "@/lib/live-articles"
import { createRecursivServerClient } from "@/lib/recursiv/client"
import { INVERTED_WORLD_SCHEMA_SQL } from "@/lib/recursiv/schema"
import { extractSourceText } from "@/lib/source-extraction"
import { fetchViralXPostsForTopic, type ViralXPost } from "@/lib/x-posts"

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

const TOPIC_KEYWORDS: Array<{ topicId: string; words: string[] }> = [
  { topicId: "uap-disclosure", words: ["ufo", "uap", "alien", "retrieval", "aaro", "pentagon", "disclosure"] },
  { topicId: "secret-programs", words: ["mkultra", "cia", "fbi", "psyop", "coverup", "classified", "hearing"] },
  { topicId: "epstein-networks", words: ["epstein", "maxwell", "island", "sealed", "client list", "court"] },
  { topicId: "cryptids-paranormal", words: ["cryptid", "bigfoot", "ghost", "paranormal", "haunted", "demon"] },
  { topicId: "ai-technocracy", words: ["ai", "data center", "surveillance", "technocracy", "algorithm", "machine"] },
  { topicId: "space-anomalies", words: ["bermuda", "nasa", "moon", "mars", "meteor", "space", "solar"] },
]

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
}

function classifyTopic(title: string, description = "") {
  const haystack = `${title} ${description}`.toLowerCase()
  const match = TOPIC_KEYWORDS.find((topic) => topic.words.some((word) => haystack.includes(word)))
  return match?.topicId || "secret-programs"
}

function buildVideo(videoId: string, title: string, publishedAt?: string, description?: string): ChannelVideo {
  const normalizedTitle = title.toLowerCase()
  return {
    title: title || "Untitled upload",
    date: publishedAt ? publishedAt.slice(0, 10) : "",
    href: `https://www.youtube.com/watch?v=${videoId}`,
    topicId: classifyTopic(title, description),
    source: "YouTube",
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    description: description?.trim() || undefined,
    kind: normalizedTitle.includes("#shorts") ? "short" : "episode",
  }
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
  const key = process.env.YOUTUBE_API_KEY
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
  return typeof value === "string" ? value.trim() : ""
}

function shorten(value: unknown, maxLength: number) {
  const text = textField(value).replace(/\s+/g, " ")
  if (!text) return ""
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function generatedSvgThumbnail(title: string, slug: string) {
  const words = title.split(/\s+/).filter(Boolean)
  const lineOne = escapeXml(words.slice(0, 5).join(" "))
  const lineTwo = escapeXml(words.slice(5, 10).join(" "))
  const sigil = escapeXml(slug.replace(/^brief-/, "").slice(0, 3).toUpperCase() || "IW")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#050504"/><stop offset=".58" stop-color="#17100a"/><stop offset="1" stop-color="#7f1d1d"/></linearGradient><pattern id="p" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0v64" fill="none" stroke="#f4efe2" stroke-opacity=".08" stroke-width="1"/></pattern></defs><rect width="1024" height="1024" fill="url(#g)"/><rect width="1024" height="1024" fill="url(#p)"/><rect x="72" y="72" width="880" height="880" fill="none" stroke="#df2f2f" stroke-width="10"/><text x="94" y="166" fill="#df2f2f" font-family="Arial, sans-serif" font-size="42" font-weight="700" letter-spacing="8">INVERTED WORLD</text><text x="94" y="456" fill="#fff8e6" font-family="Georgia, serif" font-size="76" font-weight="700">${lineOne}</text><text x="94" y="552" fill="#fff8e6" font-family="Georgia, serif" font-size="76" font-weight="700">${lineTwo}</text><text x="94" y="854" fill="#f4efe2" fill-opacity=".58" font-family="Arial, sans-serif" font-size="36" font-weight="700" letter-spacing="6">${sigil} / SOURCE DOSSIER</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
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
  const title = `${topic.title}: ${row.claim || row.title || topic.signal}`

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
    const title = shorten(parsed.title, 180)
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
): Promise<GeneratedArticleDraft> {
  const fallback = fallbackDossierArticleDraft(row, topic)
  if (!agentId || process.env.ARTICLE_GENERATION_USE_AGENT === "0") return fallback

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
  const { sdk, config } = createRecursivServerClient({ timeout: 120000 })
  await sdk.databases.ensure({ project_id: config.projectId, name: config.databaseName })
  for (const sql of INVERTED_WORLD_SCHEMA_SQL) {
    await sdk.databases.query({ project_id: config.projectId, database_name: config.databaseName, sql })
  }
  return { sdk, config }
}

function getInvertedWorldDatabase() {
  return createRecursivServerClient({ timeout: 120000 })
}

export async function syncYouTubeArchiveToRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
  const fullSync = process.env.YOUTUBE_ARCHIVE_FULL_SYNC === "1"
  const videos = fullSync ? (await fetchYouTubeDataApi()) || (await fetchYouTubeRss()) : await fetchYouTubeRss()

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

  return { synced: videos.length, sourceMode: fullSync && process.env.YOUTUBE_API_KEY ? "youtube-data-api" : "rss" }
}

export async function syncTopicPulseToRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
  let coverageCount = 0
  let xCount = 0

  for (const topic of topics) {
    const articles = await fetchLiveArticlesForTopic(topic.id, topic.query.replaceAll('"', "")).catch(() => [])
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
    coverageCount += 1

    const posts = await fetchViralXPostsForTopic(topic.id, { limit: 12 }).catch(() => [])
    for (const post of posts) {
      await upsertXSignal(sdk, config.projectId, config.databaseName, post)
      xCount += 1
    }
  }

  return { coverageSnapshots: coverageCount, xSignals: xCount }
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
      fetchLiveArticlesForTopic(topic.id, topic.query.replaceAll('"', "")).catch(() => []),
      fetchViralXPostsForTopic(topic.id, { limit: 12 }).catch(() => []),
      sdk.databases.query({
        project_id: config.projectId,
        database_name: config.databaseName,
        sql: `SELECT source_id, source_url, title, description, published_at, topic_id, thumbnail_url, embed_url, kind
          FROM channel_items
          WHERE source = 'youtube' AND topic_id = $1
          ORDER BY published_at DESC NULLS LAST
          LIMIT 6`,
        params: [topic.id],
      }),
    ])

    const lead = articles[0]
    const videos = (videosResult.data.rows || []).map((row) => ({
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
    })) satisfies ChannelVideo[]

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
        `A Ground News-style dossier for ${topic.title}: source split, X velocity, evidence grade, and Tales archive context.`,
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

export async function generateArticleDraftsInRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
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
    params: [Math.max(1, Math.min(Number(process.env.ARTICLE_GENERATION_LIMIT || "6"), 12))],
  })

  let created = 0
  for (const row of data.rows as ClaimDossierDraftRow[]) {
    const topic = topics.find((item) => item.id === row.topic_id)
    if (!topic) continue

    const draft = await generateDossierArticleDraft(sdk, config.agentId, row, topic)
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

  return { draftsUpserted: created }
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

export async function publishFrontPageEditionInRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
  const [articlesResult, dossiersResult, xSignalsResult, videosResult, countsResult] = await Promise.all([
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
        WHERE a.status = 'published'
        ORDER BY a.heat DESC NULLS LAST, a.published_at DESC NULLS LAST
        LIMIT 12`,
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
        WHERE status = 'published'
        ORDER BY x_velocity_score DESC NULLS LAST, published_at DESC NULLS LAST, updated_at DESC
        LIMIT 12`,
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
        WHERE source = 'youtube'
        ORDER BY published_at DESC NULLS LAST
        LIMIT 8`,
    }),
    sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `SELECT 'channel_items' AS name, count(*)::int AS count FROM channel_items
        UNION ALL SELECT 'coverage_snapshots', count(*)::int FROM coverage_snapshots
        UNION ALL SELECT 'x_signals', count(*)::int FROM x_signals
        UNION ALL SELECT 'article_drafts', count(*)::int FROM article_drafts
        UNION ALL SELECT 'generated_assets', count(*)::int FROM generated_assets
        UNION ALL SELECT 'claim_dossiers', count(*)::int FROM claim_dossiers
        UNION ALL SELECT 'claim_sources', count(*)::int FROM claim_sources`,
    }),
  ])

  const articles = articlesResult.data.rows.map((row) => {
    const item = jsonObject(row)
    return {
      title: textField(item.title),
      href: textField(item.source_url) || `/news/${textField(item.slug).replace(/^brief-/, "")}`,
      topicId: textField(item.topic_id),
      source: textField(item.source_name) || "Inverted World",
      heat: asNumber(item.heat),
      imageUrl: textField(item.asset_url),
      publishedAt: textField(item.published_at),
    }
  })
  const dossiers = dossiersResult.data.rows.map((row) => {
    const item = jsonObject(row)
    return {
      title: textField(item.title),
      href: `/news/${textField(item.slug)}`,
      slug: textField(item.slug),
      topicId: textField(item.topic_id),
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
      text: shorten(item.text, 260),
      topicId: textField(item.topic_id),
      score: asNumber(item.score),
      postedAt: textField(item.posted_at),
    }
  })
  const archiveVideos = videosResult.data.rows.map((row) => {
    const item = jsonObject(row)
    return {
      title: textField(item.title),
      href: textField(item.source_id) ? `/archive/${textField(item.source_id)}` : textField(item.source_url),
      topicId: textField(item.topic_id),
      thumbnail: textField(item.thumbnail_url),
      publishedAt: textField(item.published_at),
    }
  })

  const countMetrics = Object.fromEntries(
    countsResult.data.rows.map((row) => {
      const item = jsonObject(row)
      return [textField(item.name), asNumber(item.count)]
    }),
  )
  const leadDossier = dossiers[0]
  const leadArticle = articles[0]
  const editionDate = new Date().toISOString().slice(0, 10)
  const slug = `front-page-${editionDate}`
  const headline = leadArticle?.title || leadDossier?.title || "Inverted World front page"
  const deck = `Today's Recursiv edition: ${articles.length} AI briefs, ${dossiers.length} claim dossiers, ${xSignals.length} X signals, and ${archiveVideos.length} Tales archive links.`
  const sections = {
    leadDossier,
    leadArticle,
    articles,
    dossiers,
    xSignals,
    archiveVideos,
  }
  const metrics = {
    ...countMetrics,
    articleCount: articles.length,
    dossierCount: dossiers.length,
    xSignalCount: xSignals.length,
    archiveVideoCount: archiveVideos.length,
    generatedAssetCount: countMetrics.generated_assets || 0,
  }

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
      VALUES ($1, $2::date, $3, $4, 'published', $5, $6::jsonb, $7::jsonb, now(), $8::jsonb, now())
      ON CONFLICT (slug) DO UPDATE SET
        edition_date = EXCLUDED.edition_date,
        headline = EXCLUDED.headline,
        deck = EXCLUDED.deck,
        status = EXCLUDED.status,
        lead_dossier_slug = EXCLUDED.lead_dossier_slug,
        sections = EXCLUDED.sections,
        metrics = EXCLUDED.metrics,
        published_at = EXCLUDED.published_at,
        metadata = EXCLUDED.metadata,
        updated_at = now()`,
    params: [
      slug,
      editionDate,
      headline,
      deck,
      leadDossier?.slug || "",
      JSON.stringify(sections),
      JSON.stringify(metrics),
      JSON.stringify({ generatedBy: "recursiv-front-page-edition-v1" }),
    ],
  })

  return {
    editionSlug: slug,
    headline,
    articleCount: articles.length,
    dossierCount: dossiers.length,
    xSignalCount: xSignals.length,
    archiveVideoCount: archiveVideos.length,
  }
}
