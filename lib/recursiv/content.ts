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
