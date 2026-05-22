import { topics, type ChannelVideo } from "@/data/inverted-world"
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

function cleanDossierDeck(value: string | undefined, topicId: string) {
  const fallback = `A sourced ${topicDisplayTitle(topicId)} file with records, social velocity, skeptical reads, and Tales archive context.`
  const deck = value?.trim() || fallback
  if (
    /Ground News/i.test(deck) ||
    /source split.*X velocity.*evidence grade/i.test(deck) ||
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
  const body = jsonArray(row.body).map(String).filter(Boolean)
  const thumbnail = jsonObject(metadata.thumbnail)
  const sourceName = row.source_name || (typeof metadata.sourceName === "string" ? metadata.sourceName : undefined)
  const sourceUrl = row.source_url || (typeof metadata.sourceUrl === "string" ? metadata.sourceUrl : undefined)

  return {
    id: row.slug || row.id || "recursiv-article",
    title: row.title || "Untitled Inverted World report",
    deck: row.deck || "Published from the Recursiv research desk.",
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
    body: body.length ? body : ["The Recursiv research desk has published this item without a rendered body yet."],
    thumbnailPrompt: row.thumbnail_prompt || (typeof metadata.thumbnailPrompt === "string" ? metadata.thumbnailPrompt : ""),
  }
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
    source: row.source === "brave-search" || row.source === "x-syndication" || row.source === "seed" ? row.source : "x-api",
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

  return {
    id: row.id || row.slug || "claim-dossier",
    slug: row.slug || row.id || "claim-dossier",
    title: row.title || "Inverted World dossier",
    deck: cleanDossierDeck(row.deck, topicId),
    topicId,
    topic: topicTitle(topicId),
    claim: row.claim || row.title || "The live claim is still being mapped.",
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
    metadata,
  }
}

function normalizedUrlKey(value?: string) {
  if (!value) return ""
  try {
    const url = new URL(value)
    return `${url.hostname.replace(/^www\./, "")}${url.pathname}`.toLowerCase()
  } catch {
    return value.toLowerCase().replace(/[?#].*$/, "")
  }
}

function normalizedTextKey(value: string) {
  return value
    .toLowerCase()
    .replace(/^[^:]{2,40}:\s*/, "")
    .replace(/[''"]/g, "")
    .replace(/\b(the|a|an|and|or|after|following|amid|over|into|from|with|to|of|for|on|in|as)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 10)
    .join(" ")
}

function dossierDedupKey(dossier: ClaimDossier) {
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

function videoKey(video: ChannelVideo) {
  return video.videoId || video.href
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
    [topicId, Math.max(1, Math.min(limit, 12))],
  )

  return rows?.map(channelRowToVideo) ?? []
}

async function hydrateDossierRelatedVideos(dossiers: ClaimDossier[]) {
  const sparseTopicIds = Array.from(
    new Set(
      dossiers
        .filter((dossier) => dossier.relatedVideos.length < DOSSIER_RELATED_VIDEO_TARGET)
        .map((dossier) => dossier.topicId),
    ),
  )
  if (!sparseTopicIds.length) return dossiers

  const fallbackPairs = await Promise.all(
    sparseTopicIds.map(async (topicId) => [topicId, await fetchTopicArchiveVideos(topicId)] as const),
  )
  const fallbackByTopic = new Map(fallbackPairs)

  return dossiers.map((dossier) => {
    if (dossier.relatedVideos.length >= DOSSIER_RELATED_VIDEO_TARGET) return dossier

    const seen = new Set(dossier.relatedVideos.map(videoKey))
    const fallback = (fallbackByTopic.get(dossier.topicId) || []).filter((video) => {
      const key = videoKey(video)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    const relatedVideos = [...dossier.relatedVideos, ...fallback].slice(0, DOSSIER_RELATED_VIDEO_TARGET)
    return {
      ...dossier,
      relatedVideos,
      relatedVideoCount: Math.max(dossier.relatedVideoCount, relatedVideos.length),
    }
  })
}

function frontPageEditionRowToEdition(row: FrontPageEditionRow): FrontPageEdition {
  return {
    id: row.id || row.slug || "front-page-edition",
    slug: row.slug || row.id || "front-page-edition",
    editionDate: safeDate(row.edition_date || row.published_at || row.generated_at),
    headline: row.headline || "Inverted World front page",
    deck: row.deck || "The latest Recursiv-generated front page edition.",
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
    `SELECT
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
    FROM channel_items
    WHERE source = 'youtube'
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

export async function fetchRecursivPublishedArticles(options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 100), 100))
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
    [limit],
  )

  return rows?.map(articleRowToArticle) ?? null
}

export async function fetchRecursivPublishedArticlesForTopic(topicId: string, options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 12), 24))
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
    [topicId, limit],
  )

  return rows?.map(articleRowToArticle) ?? null
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

  return rows?.[0] ? articleRowToArticle(rows[0]) : null
}

export async function fetchRecursivXSignalsForTopic(topicId: string, options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 12), 24))
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
    `SELECT /* pipeline-runs:${Date.now()} */
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
