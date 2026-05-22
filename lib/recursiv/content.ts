import { researchDocuments, topics, type ChannelVideo, type ResearchDocument } from "@/data/inverted-world"
import recursivPublicSnapshot from "@/data/generated/recursiv-public-snapshot.json"
import type { IntelligenceArticle } from "@/data/intelligence-articles"
import type { ViralXPost } from "@/lib/x-posts"
import { queryInvertedWorldDatabase, type RecursivRow } from "@/lib/recursiv/database"

type ChannelItemRow = RecursivRow & {
  source_id?: string
  source_url?: string
  title?: string
  description?: string
  published_at?: string
  topic_id?: string
  thumbnail_url?: string
  embed_url?: string
  kind?: string
  metadata?: unknown
  total_count?: number | string
}

type ArticleDraftRow = RecursivRow & {
  id?: string
  slug?: string
  title?: string
  deck?: string
  topic_id?: string
  body?: unknown
  source_name?: string
  source_url?: string
  heat?: number | string
  thumbnail_prompt?: string
  published_at?: string
  metadata?: unknown
  asset_url?: string
}

type XSignalRow = RecursivRow & {
  x_id?: string
  url?: string
  text?: string
  topic_id?: string
  author_name?: string
  username?: string
  posted_at?: string
  source?: string
  score?: number | string
  metrics?: unknown
}

type ClaimDossierRow = RecursivRow & {
  id?: string
  slug?: string
  title?: string
  deck?: string
  topic_id?: string
  claim?: string
  summary?: string
  status?: string
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
  chat_prompt?: string
  published_at?: string
  generated_at?: string
  metadata?: unknown
}

type FrontPageEditionRow = RecursivRow & {
  id?: string
  slug?: string
  edition_date?: string
  headline?: string
  deck?: string
  status?: string
  lead_dossier_slug?: string
  sections?: unknown
  metrics?: unknown
  generated_at?: string
  published_at?: string
  metadata?: unknown
}

type PipelineRunRow = RecursivRow & {
  id?: string
  job_name?: string
  status?: string
  started_at?: string
  completed_at?: string
  duration_ms?: number | string
  results?: unknown
  error?: string
  metadata?: unknown
}

type ClaimChatMessageRow = RecursivRow & {
  id?: string
  dossier_slug?: string
  conversation_id?: string
  role?: string
  message?: string
  response?: string
  metadata?: unknown
  created_at?: string
}

type SourceDocumentRow = RecursivRow & {
  id?: string
  slug?: string
  title?: string
  source?: string
  url?: string
  host?: string
  kind?: ResearchDocument["kind"]
  topic_ids?: unknown
  status?: string
  metadata?: unknown
}

const DOSSIER_RELATED_VIDEO_TARGET = 6

export type ClaimSourceLink = {
  title: string
  url: string
  outlet?: string
  sourceKind?: string
  stance?: string
  biasLane?: string
  publishedAt?: string
  credibilityScore?: number
  excerpt?: string
  extractionProvider?: string
}

export type ClaimDossier = {
  id: string
  slug: string
  title: string
  deck: string
  topicId: string
  topic: string
  claim: string
  summary: string
  status: string
  evidenceGrade: string
  confidenceScore: number
  xVelocityScore: number
  sourceCount: number
  xSignalCount: number
  relatedVideoCount: number
  sourceLinks: ClaimSourceLink[]
  xSignals: ViralXPost[]
  relatedVideos: ChannelVideo[]
  weirdRead: string
  skepticalRead: string
  viralHeadlines: string[]
  chatPrompt: string
  publishedAt: string
  metadata: Record<string, unknown>
}

export type FrontPageEdition = {
  id: string
  slug: string
  editionDate: string
  headline: string
  deck: string
  status: string
  leadDossierSlug?: string
  sections: Record<string, unknown>
  metrics: Record<string, unknown>
  publishedAt: string
  metadata: Record<string, unknown>
}

export type PipelineRunStatus = {
  id: string
  jobName: string
  status: string
  startedAt: string
  completedAt: string
  durationMs: number
  stepCount: number
  failedStepCount: number
  steps: Array<{ step: string; ok: boolean; durationMs: number; error?: string }>
  error: string
  metadata: Record<string, unknown>
}

export type ClaimChatMessage = {
  id: string
  dossierSlug: string
  conversationId: string
  role: string
  message: string
  response: string
  createdAt: string
  metadata: Record<string, unknown>
}

export type SourceDocument = {
  id: string
  title: string
  source: string
  url: string
  host: string
  kind: ResearchDocument["kind"]
  topicIds: string[]
  topics: string[]
  status: string
  metadata: Record<string, unknown>
}

export type SourceDocumentsResult = {
  sourceMode: "recursiv-database" | "recursiv-snapshot" | "static"
  documents: SourceDocument[]
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

function safeDate(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10)
}

function topicTitle(topicId?: string) {
  return topics.find((topic) => topic.id === topicId)?.title.toUpperCase() || "INVERTED WORLD"
}

function topicDisplayTitle(topicId?: string) {
  return topics.find((topic) => topic.id === topicId)?.title || "Inverted World"
}

function cleanDossierTitle(value: string | undefined, topicId: string) {
  const fallback = "Inverted World dossier"
  let title = value?.trim() || fallback
  const topicNames = [
    topicDisplayTitle(topicId),
    ...topics.map((topic) => topic.title),
    "Inverted World",
    "Claim Dossier",
  ].filter(Boolean)

  for (let pass = 0; pass < 3; pass += 1) {
    const before = title
    for (const topicName of topicNames) {
      const pattern = new RegExp(`^${topicName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i")
      title = title.replace(pattern, "").trim()
    }
    if (title === before) break
  }

  return title || fallback
}

function cleanPublicTitle(value: string | undefined, topicId: string, fallback = "Inverted World report") {
  let title = cleanDossierTitle(value, topicId)

  for (const topic of topics) {
    const escaped = topic.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const repeatedPrefix = new RegExp(`^(?:${escaped}\\s*:\\s*)+`, "i")
    title = title.replace(repeatedPrefix, "").trim()
  }

  return title || fallback
}

function cleanPublicText(value: string, topicId: string) {
  let text = value.trim()
  if (!text) return ""
  for (const topic of topics) {
    const escaped = topic.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    text = text.replace(new RegExp(`(?:${escaped}\\s*:\\s*){2,}`, "gi"), `${topic.title}: `)
  }
  return cleanDossierTitle(text, topicId)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[''"]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96)
    .replace(/-+$/g, "")
}

function publicDossierSlug(rowSlug: string | undefined, title: string, topicId: string) {
  const cleanTitle = slugify(title)
  if (cleanTitle) return `${topicId}-${cleanTitle}`
  return rowSlug || "claim-dossier"
}

function publicNewsUrl(rowSlug: string | undefined, title: string, topicId: string) {
  return `/news/${publicDossierSlug(rowSlug, title, topicId)}`
}

function sourceDocumentSlug(document: Pick<ResearchDocument, "source" | "title" | "url">) {
  return slugify(`${document.source}-${document.title}`) || slugify(document.url) || "source-document"
}

function sourceDocumentHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function cleanDossierDeck(value: string | undefined, topicId: string) {
  const fallback = `Latest sourced reporting in ${topicDisplayTitle(topicId)}, with original links, social context, and related Tales archive material beside it.`
  const deck = value?.trim() || fallback
  if (
    /Ground News/i.test(deck) ||
    /source split.*X velocity.*evidence grade/i.test(deck) ||
    /^A sourced .* file with records, social velocity, skeptical reads, and Tales archive context\.?$/i.test(deck) ||
    /dossier for\s+[A-Za-z -]+:/i.test(deck)
  ) {
    return fallback
  }
  return deck
}

function defaultThumbnail(topicId?: string) {
  const topic = topics.find((item) => item.id === topicId)
  return {
    glyph: topic?.title.slice(0, 4).toUpperCase() || "IW",
    sigil: "REC",
    palette: "from-[#050504] via-[#21180d] to-[#df2f2f]",
  }
}

function channelRowToVideo(row: ChannelItemRow): ChannelVideo {
  const metadata = jsonObject(row.metadata)
  const videoId = row.source_id || (typeof metadata.videoId === "string" ? metadata.videoId : undefined)

  return {
    title: row.title || "Untitled upload",
    date: safeDate(row.published_at),
    href: row.source_url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "#"),
    topicId: row.topic_id || "secret-programs",
    source: "YouTube",
    videoId,
    embedUrl: row.embed_url || (videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : undefined),
    thumbnail: row.thumbnail_url || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined),
    description: row.description,
    kind: row.kind === "short" ? "short" : "episode",
  }
}

function articleRowToArticle(row: ArticleDraftRow): IntelligenceArticle {
  const metadata = jsonObject(row.metadata)
  const topicId = row.topic_id || "secret-programs"
  const body = jsonArray(row.body).map(String).map((paragraph) => cleanPublicText(paragraph, topicId)).filter(Boolean)
  const thumbnail = jsonObject(metadata.thumbnail)
  const sourceName = row.source_name || (typeof metadata.sourceName === "string" ? metadata.sourceName : undefined)
  const title = cleanPublicTitle(row.title, topicId, "Untitled Inverted World report")
  const rawSourceUrl = row.source_url || (typeof metadata.sourceUrl === "string" ? metadata.sourceUrl : undefined)
  const storyUrl = publicNewsUrl(row.slug, title, topicId)
  const sourceUrl = !rawSourceUrl || rawSourceUrl.startsWith("/news/") ? storyUrl : rawSourceUrl

  return {
    id: publicDossierSlug(row.slug || row.id, title, topicId),
    title,
    deck: cleanDossierDeck(
      row.deck || `Latest sourced reporting in the ${topicDisplayTitle(topicId)} lane, with original links and archive context attached.`,
      topicId,
    ),
    topicId,
    topic: topicTitle(topicId),
    publishedAt: safeDate(row.published_at) || new Date().toISOString().slice(0, 10),
    heat: Number(row.heat || metadata.heat || 80),
    source: sourceName || "Inverted World Research Desk",
    sourceUrl: sourceUrl || "/archive",
    thumbnail: {
      ...defaultThumbnail(topicId),
      ...(thumbnail as Partial<IntelligenceArticle["thumbnail"]>),
      imageUrl: row.asset_url || (typeof metadata.assetUrl === "string" ? metadata.assetUrl : undefined),
    },
    body: body.length ? body : ["This story is still being written. Start with the source links and related archive material below."],
    thumbnailPrompt:
      cleanPublicText(
        row.thumbnail_prompt ||
          (typeof metadata.thumbnailPrompt === "string" ? metadata.thumbnailPrompt.replace(row.title || "", title) : ""),
        topicId,
      ),
  }
}

function sourceDocumentFromResearchDocument(document: ResearchDocument): SourceDocument {
  return {
    id: sourceDocumentSlug(document),
    title: document.title,
    source: document.source,
    url: document.url,
    host: sourceDocumentHost(document.url),
    kind: document.kind,
    topicIds: document.topicIds,
    topics: document.topicIds.map((id) => topicDisplayTitle(id)),
    status: "active",
    metadata: {},
  }
}

function sourceDocumentRowToDocument(row: SourceDocumentRow): SourceDocument {
  const topicIds = jsonArray(row.topic_ids).map(String).filter(Boolean)
  const title = row.title || "Untitled source"
  const source = row.source || sourceDocumentHost(row.url || "") || "Source"
  const url = row.url || "#"

  return {
    id: row.slug || row.id || sourceDocumentSlug({ source, title, url }),
    title,
    source,
    url,
    host: row.host || sourceDocumentHost(url),
    kind: row.kind || "archive",
    topicIds,
    topics: topicIds.map((id) => topicDisplayTitle(id)),
    status: row.status || "active",
    metadata: jsonObject(row.metadata),
  }
}

function normalizeXSignalSource(source?: string): ViralXPost["source"] {
  if (source === "brave-search" || source === "exa-search" || source === "x-syndication" || source === "x-profile-reader" || source === "seed") return source
  return "x-api"
}

function xRowToPost(row: XSignalRow): ViralXPost {
  const metrics = jsonObject(row.metrics)

  return {
    id: row.x_id || row.url || "x-signal",
    url: row.url || "#",
    text: row.text || "Inverted World X signal",
    topicId: row.topic_id || "secret-programs",
    authorName: row.author_name,
    username: row.username,
    createdAt: row.posted_at,
    source: normalizeXSignalSource(row.source),
    score: Number(row.score || 0),
    metrics: {
      likes: Number(metrics.likes ?? metrics.like_count ?? 0) || undefined,
      reposts: Number(metrics.reposts ?? metrics.retweet_count ?? 0) || undefined,
      replies: Number(metrics.replies ?? metrics.reply_count ?? 0) || undefined,
      quotes: Number(metrics.quotes ?? metrics.quote_count ?? 0) || undefined,
      views: Number(metrics.views ?? metrics.impression_count ?? 0) || undefined,
    },
  }
}

function sourceLinkFromJson(value: unknown): ClaimSourceLink | null {
  const item = jsonObject(value)
  const title = typeof item.title === "string" ? item.title : ""
  const url = typeof item.url === "string" ? item.url : ""
  if (!title || !url) return null

  return {
    title,
    url,
    outlet: typeof item.outlet === "string" ? item.outlet : undefined,
    sourceKind: typeof item.sourceKind === "string" ? item.sourceKind : typeof item.source_kind === "string" ? item.source_kind : undefined,
    stance: typeof item.stance === "string" ? item.stance : undefined,
    biasLane: typeof item.biasLane === "string" ? item.biasLane : typeof item.bias_lane === "string" ? item.bias_lane : undefined,
    publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : typeof item.published_at === "string" ? item.published_at : undefined,
    credibilityScore: Number(item.credibilityScore ?? item.credibility_score ?? 0) || undefined,
    excerpt: typeof item.excerpt === "string" ? item.excerpt : undefined,
    extractionProvider: typeof item.extractionProvider === "string" ? item.extractionProvider : undefined,
  }
}

function postFromJson(value: unknown): ViralXPost | null {
  const item = jsonObject(value)
  const id = typeof item.id === "string" ? item.id : typeof item.x_id === "string" ? item.x_id : ""
  const url = typeof item.url === "string" ? item.url : ""
  const text = typeof item.text === "string" ? item.text : ""
  if (!id || !url || !text) return null

  return {
    id,
    url,
    text,
    topicId: typeof item.topicId === "string" ? item.topicId : typeof item.topic_id === "string" ? item.topic_id : undefined,
    authorName: typeof item.authorName === "string" ? item.authorName : typeof item.author_name === "string" ? item.author_name : undefined,
    username: typeof item.username === "string" ? item.username : undefined,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : typeof item.posted_at === "string" ? item.posted_at : undefined,
    source:
      item.source === "x-api" || item.source === "brave-search" || item.source === "x-syndication" || item.source === "seed"
        ? item.source
        : "x-api",
    score: Number(item.score || 0),
    metrics: jsonObject(item.metrics) as ViralXPost["metrics"],
  }
}

function videoFromJson(value: unknown): ChannelVideo | null {
  const item = jsonObject(value)
  const title = typeof item.title === "string" ? item.title : ""
  const href = typeof item.href === "string" ? item.href : typeof item.source_url === "string" ? item.source_url : ""
  if (!title || !href) return null

  return {
    title,
    date: typeof item.date === "string" ? item.date : typeof item.published_at === "string" ? safeDate(item.published_at) : "",
    href,
    topicId: typeof item.topicId === "string" ? item.topicId : typeof item.topic_id === "string" ? item.topic_id : "secret-programs",
    source: "YouTube",
    videoId: typeof item.videoId === "string" ? item.videoId : typeof item.source_id === "string" ? item.source_id : undefined,
    embedUrl: typeof item.embedUrl === "string" ? item.embedUrl : typeof item.embed_url === "string" ? item.embed_url : undefined,
    thumbnail: typeof item.thumbnail === "string" ? item.thumbnail : typeof item.thumbnail_url === "string" ? item.thumbnail_url : undefined,
    description: typeof item.description === "string" ? item.description : undefined,
    kind: item.kind === "short" ? "short" : "episode",
  }
}

function claimDossierRowToDossier(row: ClaimDossierRow): ClaimDossier {
  const topicId = row.topic_id || "secret-programs"
  const metadata = jsonObject(row.metadata)
  const publishedAt = safeDate(row.published_at || row.generated_at) || new Date().toISOString().slice(0, 10)
  const title = cleanDossierTitle(row.title, topicId)
  const rawSlug = row.slug || row.id || "claim-dossier"

  return {
    id: row.id || row.slug || "claim-dossier",
    slug: publicDossierSlug(rawSlug, title, topicId),
    title,
    deck: cleanDossierDeck(row.deck, topicId),
    topicId,
    topic: topicTitle(topicId),
    claim: cleanDossierTitle(row.claim || title, topicId),
    summary: row.summary || "The research desk has not written a summary yet.",
    status: row.status || "draft",
    evidenceGrade: row.evidence_grade || "developing",
    confidenceScore: Number(row.confidence_score || 0),
    xVelocityScore: Number(row.x_velocity_score || 0),
    sourceCount: Number(row.source_count || 0),
    xSignalCount: Number(row.x_signal_count || 0),
    relatedVideoCount: Number(row.related_video_count || 0),
    sourceLinks: jsonArray(row.source_links).map(sourceLinkFromJson).filter((item): item is ClaimSourceLink => Boolean(item)),
    xSignals: jsonArray(row.x_signals).map(postFromJson).filter((item): item is ViralXPost => Boolean(item)),
    relatedVideos: jsonArray(row.related_videos).map(videoFromJson).filter((item): item is ChannelVideo => Boolean(item)),
    weirdRead: row.weird_read || "The weird read has not been generated yet.",
    skepticalRead: row.skeptical_read || "The skeptical read has not been generated yet.",
    viralHeadlines: jsonArray(row.viral_headlines).map(String).filter(Boolean),
    chatPrompt: row.chat_prompt || "",
    publishedAt,
    metadata: {
      ...metadata,
      rawSlug,
    },
  }
}

function normalizedUrlKey(value?: string) {
  if (!value) return ""
  if (value.startsWith("/news/")) return ""
  try {
    const url = new URL(value)
    return `${url.hostname.replace(/^www\./, "")}${url.pathname}`.toLowerCase()
  } catch {
    return value.toLowerCase().replace(/[?#].*$/, "")
  }
}

function normalizedTextKey(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/^[^:]{2,40}:\s*/, "")
    .replace(/[''"]/g, "")
    .replace(/\b(the|a|an|and|or|after|following|amid|over|into|from|with|to|of|for|on|in|as)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

  return normalized
    .split(/\s+/)
    .map((word) => (word.length > 4 ? word.replace(/s$/, "") : word))
    .slice(0, 10)
    .join(" ")
}

function dossierClusterTextKey(value: string) {
  const normalized = normalizedTextKey(value)
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean))
  if (tokens.has("epstein") && tokens.has("library")) return "epstein-library"
  if (tokens.has("pursue") && tokens.has("protocol")) return "pursue-protocol"
  if (tokens.has("swarm") && (tokens.has("drone") || tokens.has("drones"))) return "swarm-drones"
  if (tokens.has("mkultra") && (tokens.has("gottlieb") || tokens.has("chief"))) return "mkultra-gottlieb"
  if (tokens.has("maven") && tokens.has("mars")) return "maven-mars"
  if ((tokens.has("bfro") || tokens.has("bigfoot")) && (tokens.has("sighting") || tokens.has("database"))) {
    return "bfro-bigfoot"
  }
  return normalized
}

function dossierDedupKey(dossier: ClaimDossier) {
  const textKey = dossierClusterTextKey(dossier.title || dossier.claim)
  if (textKey) return `${dossier.topicId}:text:${textKey}`
  const leadSource = normalizedUrlKey(dossier.sourceLinks[0]?.url)
  if (leadSource) return `${dossier.topicId}:source:${leadSource}`
  return `${dossier.topicId}:title:${normalizedTextKey(dossier.title || dossier.claim)}`
}

function dedupeDossiers(dossiers: ClaimDossier[]) {
  const seen = new Set<string>()
  return dossiers.filter((dossier) => {
    const key = dossierDedupKey(dossier)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function articleDedupKey(article: IntelligenceArticle) {
  const textKey = dossierClusterTextKey(article.title)
  if (textKey) return `${article.topicId}:text:${textKey}`
  const sourceKey = normalizedUrlKey(article.sourceUrl)
  if (sourceKey) return `${article.topicId}:source:${sourceKey}`
  return `${article.topicId}:title:${normalizedTextKey(article.title)}`
}

function dedupeArticles(articles: IntelligenceArticle[]) {
  const seen = new Set<string>()
  return articles.filter((article) => {
    const key = articleDedupKey(article)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function videoKey(video: ChannelVideo) {
  return video.videoId || video.href
}

function dedupeChannelVideos(videos: ChannelVideo[]) {
  const seen = new Set<string>()
  return videos.filter((video) => {
    const key = videoKey(video)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function fetchTopicArchiveVideos(topicId: string, limit = DOSSIER_RELATED_VIDEO_TARGET) {
  const rows = await queryInvertedWorldDatabase<ChannelItemRow>(
    `SELECT
      source_id,
      source_url,
      title,
      description,
      published_at,
      topic_id,
      thumbnail_url,
      embed_url,
      kind,
      metadata
    FROM channel_items
    WHERE source = 'youtube' AND topic_id = $1
    ORDER BY CASE WHEN kind = 'episode' THEN 0 ELSE 1 END, published_at DESC NULLS LAST, created_at DESC
    LIMIT $2`,
    [topicId, Math.max(1, Math.min(limit * 2, 24))],
  )

  return dedupeChannelVideos(rows?.map(channelRowToVideo) ?? []).slice(0, limit)
}

async function hydrateDossierRelatedVideos(dossiers: ClaimDossier[]) {
  const topicIds = Array.from(new Set(dossiers.map((dossier) => dossier.topicId)))
  if (!topicIds.length) return dossiers

  const fallbackPairs = await Promise.all(
    topicIds.map(async (topicId) => [topicId, await fetchTopicArchiveVideos(topicId, 24)] as const),
  )
  const fallbackByTopic = new Map(fallbackPairs)

  return dossiers.map((dossier) => {
    const fallbackVideos = fallbackByTopic.get(dossier.topicId) || []
    const validArchiveKeys = new Set(fallbackVideos.map(videoKey).filter(Boolean))
    const existing = dedupeChannelVideos(dossier.relatedVideos)
      .filter((video) => !video.videoId || validArchiveKeys.has(videoKey(video)))
      .slice(0, DOSSIER_RELATED_VIDEO_TARGET)
    if (existing.length >= DOSSIER_RELATED_VIDEO_TARGET) {
      return {
        ...dossier,
        relatedVideos: existing,
        relatedVideoCount: existing.length,
      }
    }

    const seen = new Set(existing.map(videoKey))
    const fallback = fallbackVideos.filter((video) => {
      const key = videoKey(video)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    const relatedVideos = [...existing, ...fallback].slice(0, DOSSIER_RELATED_VIDEO_TARGET)
    return {
      ...dossier,
      relatedVideos,
      relatedVideoCount: relatedVideos.length,
    }
  })
}

function frontPageEditionRowToEdition(row: FrontPageEditionRow): FrontPageEdition {
  const deck = row.deck || ""

  return {
    id: row.id || row.slug || "front-page-edition",
    slug: row.slug || row.id || "front-page-edition",
    editionDate: safeDate(row.edition_date || row.published_at || row.generated_at),
    headline: row.headline || "Inverted World front page",
    deck: /Recursiv edition|AI briefs|claim dossiers/i.test(deck)
      ? "Today's edition tracks the strongest stories, source links, X signal, and related Tales archive context across the conspiracy-world desk."
      : deck || "The latest Inverted World front page edition.",
    status: row.status || "published",
    leadDossierSlug: row.lead_dossier_slug,
    sections: jsonObject(row.sections),
    metrics: jsonObject(row.metrics),
    publishedAt: safeDate(row.published_at || row.generated_at) || new Date().toISOString().slice(0, 10),
    metadata: jsonObject(row.metadata),
  }
}

function pipelineRunRowToStatus(row: PipelineRunRow): PipelineRunStatus {
  const steps = jsonArray(row.results)
    .map<PipelineRunStatus["steps"][number] | null>((value) => {
      const item = jsonObject(value)
      const step = typeof item.step === "string" ? item.step : ""
      if (!step) return null
      return {
        step,
        ok: Boolean(item.ok),
        durationMs: Number(item.durationMs || item.duration_ms || 0),
        error: typeof item.error === "string" ? item.error : undefined,
      }
    })
    .filter((item): item is PipelineRunStatus["steps"][number] => item !== null)

  const startedAt = row.started_at || ""
  const startedAtMs = startedAt ? new Date(startedAt).getTime() : Number.NaN
  const staleRunning =
    row.status === "running" &&
    (!Number.isFinite(startedAtMs) || Date.now() - startedAtMs > 30 * 60 * 1000)

  return {
    id: row.id || "pipeline-run",
    jobName: row.job_name || "full-pipeline",
    status: staleRunning ? "stale_running" : row.status || "unknown",
    startedAt,
    completedAt: row.completed_at || "",
    durationMs: staleRunning && Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : Number(row.duration_ms || 0),
    stepCount: steps.length,
    failedStepCount: steps.filter((step) => !step.ok).length,
    steps,
    error: staleRunning ? "Pipeline run did not complete within 30 minutes." : row.error || "",
    metadata: jsonObject(row.metadata),
  }
}

function claimChatMessageRowToMessage(row: ClaimChatMessageRow): ClaimChatMessage {
  return {
    id: row.id || "claim-chat-message",
    dossierSlug: row.dossier_slug || "",
    conversationId: row.conversation_id || "",
    role: row.role || "user",
    message: row.message || "",
    response: row.response || "",
    createdAt: row.created_at || "",
    metadata: jsonObject(row.metadata),
  }
}

function filterSourceDocuments(
  documents: SourceDocument[],
  options: { topicId?: string; kind?: string } = {},
) {
  return documents.filter((document) => {
    if (options.topicId && !document.topicIds.includes(options.topicId)) return false
    if (options.kind && document.kind !== options.kind) return false
    return true
  })
}

function staticSourceDocuments(options: { topicId?: string; kind?: string } = {}): SourceDocumentsResult {
  const documents = researchDocuments.map(sourceDocumentFromResearchDocument)
  return {
    sourceMode: "static",
    documents: filterSourceDocuments(documents, options),
  }
}

function snapshotSourceDocuments(options: { topicId?: string; kind?: string } = {}): SourceDocumentsResult | null {
  const rows = Array.isArray(recursivPublicSnapshot.sourceDocuments)
    ? (recursivPublicSnapshot.sourceDocuments as SourceDocumentRow[])
    : []
  if (!rows.length) return null

  return {
    sourceMode: "recursiv-snapshot",
    documents: filterSourceDocuments(rows.map(sourceDocumentRowToDocument), options),
  }
}

export async function fetchSourceDocuments(options: { topicId?: string; kind?: string } = {}): Promise<SourceDocumentsResult> {
  const rows = await queryInvertedWorldDatabase<SourceDocumentRow>(
    `SELECT
      id,
      slug,
      title,
      source,
      url,
      host,
      kind,
      topic_ids,
      status,
      metadata
    FROM source_documents
    WHERE status = 'active'
    ORDER BY kind, title`,
  )

  if (!rows?.length) return snapshotSourceDocuments(options) || staticSourceDocuments(options)

  return {
    sourceMode: "recursiv-database",
    documents: filterSourceDocuments(rows.map(sourceDocumentRowToDocument), options),
  }
}

export async function getRecursivChannelArchive({
  limit = 100,
  offset = 0,
  maxLimit = 100,
}: {
  limit?: number
  offset?: number
  maxLimit?: number
} = {}) {
  const safeMaxLimit = Math.min(Math.max(Math.trunc(maxLimit) || 100, 1), 1000)
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), safeMaxLimit)
  const safeOffset = Math.max(Math.trunc(offset) || 0, 0)
  const rows = await queryInvertedWorldDatabase<ChannelItemRow>(
    `WITH deduped AS (
      SELECT DISTINCT ON (COALESCE(source_id, source_url, id))
        id,
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
        created_at
      FROM channel_items
      WHERE source = 'youtube'
      ORDER BY COALESCE(source_id, source_url, id), published_at DESC NULLS LAST, created_at DESC
    )
    SELECT
      id,
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
      count(*) OVER() AS total_count
    FROM deduped
    ORDER BY published_at DESC NULLS LAST, created_at DESC
    LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset],
  )

  if (!rows?.length) return null

  const totalCount = Number(rows[0].total_count || rows.length)
  return {
    generatedAt: new Date().toISOString(),
    videos: rows.map(channelRowToVideo),
    totalCount,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + safeLimit < totalCount,
  }
}

export async function getRecursivChannelVideo(videoId: string) {
  if (!videoId) return null

  const rows = await queryInvertedWorldDatabase<ChannelItemRow>(
    `SELECT
      source_id,
      source_url,
      title,
      description,
      published_at,
      topic_id,
      thumbnail_url,
      embed_url,
      kind,
      metadata
    FROM channel_items
    WHERE source = 'youtube' AND (source_id = $1 OR source_url = $2)
    LIMIT 1`,
    [videoId, `https://www.youtube.com/watch?v=${videoId}`],
  )

  return rows?.[0] ? channelRowToVideo(rows[0]) : null
}

export async function fetchRecursivPublishedArticles(options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 100), 100))
  const queryLimit = Math.max(limit, Math.min(limit * 4, 200))
  const rows = await queryInvertedWorldDatabase<ArticleDraftRow>(
    `SELECT
      a.id,
      a.slug,
      a.title,
      a.deck,
      a.topic_id,
      a.body,
      a.source_name,
      a.source_url,
      a.heat,
      a.thumbnail_prompt,
      a.published_at,
      a.metadata,
      ga.url AS asset_url
    FROM article_drafts a
    LEFT JOIN generated_assets ga ON ga.id = a.thumbnail_asset_id
    WHERE a.status = 'published'
    ORDER BY a.published_at DESC NULLS LAST, a.generated_at DESC
    LIMIT $1`,
    [queryLimit],
  )

  return rows ? dedupeArticles(rows.map(articleRowToArticle)).slice(0, limit) : null
}

export async function fetchRecursivPublishedArticlesForTopic(topicId: string, options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 12), 24))
  const queryLimit = Math.max(limit, Math.min(limit * 4, 100))
  const rows = await queryInvertedWorldDatabase<ArticleDraftRow>(
    `SELECT
      a.id,
      a.slug,
      a.title,
      a.deck,
      a.topic_id,
      a.body,
      a.source_name,
      a.source_url,
      a.heat,
      a.thumbnail_prompt,
      a.published_at,
      a.metadata,
      ga.url AS asset_url
    FROM article_drafts a
    LEFT JOIN generated_assets ga ON ga.id = a.thumbnail_asset_id
    WHERE a.status = 'published' AND a.topic_id = $1
    ORDER BY a.published_at DESC NULLS LAST, a.generated_at DESC
    LIMIT $2`,
    [topicId, queryLimit],
  )

  return rows ? dedupeArticles(rows.map(articleRowToArticle)).slice(0, limit) : null
}

export async function fetchRecursivPublishedArticlesByTopic(options: { limitPerTopic?: number; topicIds?: string[] } = {}) {
  const limitPerTopic = Math.max(1, Math.min(Math.trunc(options.limitPerTopic || 12), 24))
  const queryLimitPerTopic = Math.max(limitPerTopic, Math.min(limitPerTopic * 4, 100))
  const topicIds = (options.topicIds?.length ? options.topicIds : topics.map((topic) => topic.id)).filter(Boolean)
  if (!topicIds.length) return null

  const placeholders = topicIds.map((_, index) => `$${index + 2}`).join(", ")
  const rows = await queryInvertedWorldDatabase<ArticleDraftRow>(
    `WITH ranked AS (
      SELECT
        a.id,
        a.slug,
        a.title,
        a.deck,
        a.topic_id,
        a.body,
        a.source_name,
        a.source_url,
        a.heat,
        a.thumbnail_prompt,
        a.published_at,
        a.metadata,
        ga.url AS asset_url,
        row_number() OVER (
          PARTITION BY a.topic_id
          ORDER BY a.published_at DESC NULLS LAST, a.generated_at DESC
        ) AS topic_rank
      FROM article_drafts a
      LEFT JOIN generated_assets ga ON ga.id = a.thumbnail_asset_id
      WHERE a.status = 'published' AND a.topic_id IN (${placeholders})
    )
    SELECT
      id,
      slug,
      title,
      deck,
      topic_id,
      body,
      source_name,
      source_url,
      heat,
      thumbnail_prompt,
      published_at,
      metadata,
      asset_url
    FROM ranked
    WHERE topic_rank <= $1
    ORDER BY topic_id, topic_rank`,
    [queryLimitPerTopic, ...topicIds],
  )
  if (!rows) return null

  const grouped: Record<string, IntelligenceArticle[]> = Object.fromEntries(topicIds.map((topicId) => [topicId, []]))
  for (const row of rows) {
    const article = articleRowToArticle(row)
    ;(grouped[article.topicId] ||= []).push(article)
  }

  return Object.fromEntries(
    Object.entries(grouped).map(([topicId, articles]) => [topicId, dedupeArticles(articles).slice(0, limitPerTopic)]),
  )
}

export async function getRecursivPublishedArticle(articleId: string) {
  const rows = await queryInvertedWorldDatabase<ArticleDraftRow>(
    `SELECT
      a.id,
      a.slug,
      a.title,
      a.deck,
      a.topic_id,
      a.body,
      a.source_name,
      a.source_url,
      a.heat,
      a.thumbnail_prompt,
      a.published_at,
      a.metadata,
      ga.url AS asset_url
    FROM article_drafts a
    LEFT JOIN generated_assets ga ON ga.id = a.thumbnail_asset_id
    WHERE a.status = 'published' AND (a.slug = $1 OR a.id = $1)
    LIMIT 1`,
    [articleId],
  )

  if (rows?.[0]) return articleRowToArticle(rows[0])

  const fallbackRows = await queryInvertedWorldDatabase<ArticleDraftRow>(
    `SELECT
      a.id,
      a.slug,
      a.title,
      a.deck,
      a.topic_id,
      a.body,
      a.source_name,
      a.source_url,
      a.heat,
      a.thumbnail_prompt,
      a.published_at,
      a.metadata,
      ga.url AS asset_url
    FROM article_drafts a
    LEFT JOIN generated_assets ga ON ga.id = a.thumbnail_asset_id
    WHERE a.status = 'published'
    ORDER BY a.published_at DESC NULLS LAST, a.generated_at DESC
    LIMIT 100`,
  )

  return fallbackRows?.map(articleRowToArticle).find((article) => article.id === articleId) ?? null
}

export async function fetchRecursivXSignalsForTopic(topicId: string, options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 18), 48))
  const rows = await queryInvertedWorldDatabase<XSignalRow>(
    `SELECT
      x_id,
      url,
      text,
      topic_id,
      author_name,
      username,
      posted_at,
      source,
      score,
      metrics
    FROM x_signals
    WHERE topic_id = $1
    ORDER BY score DESC NULLS LAST, posted_at DESC NULLS LAST, captured_at DESC
    LIMIT $2`,
    [topicId, limit],
  )

  return rows?.map(xRowToPost) ?? null
}

export async function fetchRecursivXSignalsByTopic(options: { limitPerTopic?: number; topicIds?: string[] } = {}) {
  const limitPerTopic = Math.max(1, Math.min(Math.trunc(options.limitPerTopic || 18), 48))
  const topicIds = (options.topicIds?.length ? options.topicIds : topics.map((topic) => topic.id)).filter(Boolean)
  if (!topicIds.length) return null

  const placeholders = topicIds.map((_, index) => `$${index + 2}`).join(", ")
  const rows = await queryInvertedWorldDatabase<XSignalRow>(
    `WITH ranked AS (
      SELECT
        x_id,
        url,
        text,
        topic_id,
        author_name,
        username,
        posted_at,
        source,
        score,
        metrics,
        row_number() OVER (
          PARTITION BY topic_id
          ORDER BY score DESC NULLS LAST, posted_at DESC NULLS LAST, captured_at DESC
        ) AS topic_rank
      FROM x_signals
      WHERE topic_id IN (${placeholders})
    )
    SELECT
      x_id,
      url,
      text,
      topic_id,
      author_name,
      username,
      posted_at,
      source,
      score,
      metrics
    FROM ranked
    WHERE topic_rank <= $1
    ORDER BY topic_id, topic_rank`,
    [limitPerTopic, ...topicIds],
  )
  if (!rows) return null

  const grouped: Record<string, ViralXPost[]> = Object.fromEntries(topicIds.map((topicId) => [topicId, []]))
  for (const row of rows) {
    const post = xRowToPost(row)
    ;(grouped[post.topicId || "secret-programs"] ||= []).push(post)
  }

  return grouped
}

export async function fetchRecursivClaimDossiers(options: { limit?: number; topicId?: string } = {}) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 24), 50))
  const queryLimit = Math.max(limit, Math.min(limit * 4, 100))
  const where = options.topicId ? "WHERE status = 'published' AND topic_id = $2" : "WHERE status = 'published'"
  const params = options.topicId ? [queryLimit, options.topicId] : [queryLimit]
  const rows = await queryInvertedWorldDatabase<ClaimDossierRow>(
    `SELECT
      id,
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
      generated_at,
      metadata
    FROM claim_dossiers
    ${where}
    ORDER BY x_velocity_score DESC NULLS LAST, published_at DESC NULLS LAST, updated_at DESC
    LIMIT $1`,
    params,
  )

  if (!rows?.length) return null

  const dossiers = dedupeDossiers(rows.map(claimDossierRowToDossier))
  const hydrated = await hydrateDossierRelatedVideos(dossiers)
  return hydrated.slice(0, limit)
}

export async function getRecursivClaimDossier(slug: string) {
  const dossiers = await fetchRecursivClaimDossiers({ limit: 50 })
  const listedDossier = dossiers?.find((dossier) => dossier.slug === slug)
  if (listedDossier) return listedDossier

  const rows = await queryInvertedWorldDatabase<ClaimDossierRow>(
    `SELECT
      id,
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
      generated_at,
      metadata
    FROM claim_dossiers
    WHERE status = 'published' AND slug = $1
    LIMIT 1`,
    [slug],
  )

  if (!rows?.[0]) return null

  const [dossier] = await hydrateDossierRelatedVideos([claimDossierRowToDossier(rows[0])])
  return dossier
}

export async function getLatestRecursivFrontPageEdition() {
  const rows = await queryInvertedWorldDatabase<FrontPageEditionRow>(
    `SELECT
      id,
      slug,
      edition_date,
      headline,
      deck,
      status,
      lead_dossier_slug,
      sections,
      metrics,
      generated_at,
      published_at,
      metadata
    FROM front_page_editions
    WHERE status = 'published'
    ORDER BY edition_date DESC, published_at DESC NULLS LAST, generated_at DESC
    LIMIT 1`,
  )

  return rows?.[0] ? frontPageEditionRowToEdition(rows[0]) : null
}

export async function fetchRecursivPipelineRuns(options: { limit?: number; jobName?: string } = {}) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 5), 20))
  const where = options.jobName ? "WHERE job_name = $2" : ""
  const params = options.jobName ? [limit, options.jobName] : [limit]
  const rows = await queryInvertedWorldDatabase<PipelineRunRow>(
    `SELECT
      id,
      job_name,
      status,
      started_at,
      completed_at,
      duration_ms,
      results,
      error,
      metadata
    FROM pipeline_runs
    ${where}
    ORDER BY started_at DESC
    LIMIT $1`,
    params,
  )

  return rows?.map(pipelineRunRowToStatus) ?? null
}

export async function getLatestRecursivPipelineRun(jobName = "full-pipeline") {
  const runs = await fetchRecursivPipelineRuns({ limit: 5, jobName })
  return runs?.[0] ?? null
}

export async function fetchRecursivDossierChatMessages(slug: string, options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 8), 25))
  const rows = await queryInvertedWorldDatabase<ClaimChatMessageRow>(
    `SELECT
      id,
      dossier_slug,
      conversation_id,
      role,
      message,
      response,
      metadata,
      created_at
    FROM claim_chat_messages
    WHERE dossier_slug = $1
    ORDER BY created_at DESC
    LIMIT $2`,
    [slug, limit],
  )

  return rows?.map(claimChatMessageRowToMessage).reverse() ?? null
}
