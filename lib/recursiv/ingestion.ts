import { channelProfile, topics, type ChannelVideo } from "@/data/inverted-world"
import { fetchLiveArticlesForTopic } from "@/lib/live-articles"
import { createRecursivServerClient } from "@/lib/recursiv/client"
import { INVERTED_WORLD_SCHEMA_SQL } from "@/lib/recursiv/schema"
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

export async function generateArticleDraftsInRecursiv() {
  const { sdk, config } = getInvertedWorldDatabase()
  const { data } = await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `SELECT
        c.topic_id,
        c.query,
        c.items,
        c.summary,
        c.captured_at,
        ci.title AS video_title,
        ci.source_url AS video_url
      FROM coverage_snapshots c
      LEFT JOIN LATERAL (
        SELECT title, source_url
        FROM channel_items
        WHERE topic_id = c.topic_id
        ORDER BY published_at DESC NULLS LAST
        LIMIT 1
      ) ci ON true
      WHERE c.captured_at > now() - interval '2 days'
      ORDER BY c.captured_at DESC
      LIMIT 12`,
  })

  let created = 0
  for (const row of data.rows) {
    const topic = topics.find((item) => item.id === row.topic_id)
    if (!topic) continue
    const items = Array.isArray(row.items) ? row.items : []
    const lead = items[0] as { title?: string; source?: string; sourceUrl?: string } | undefined
    const title = `${topic.title}: ${lead?.title || "the live signal map"}`
    const slug = `${topic.id}-${cleanSlug(String(lead?.title || row.captured_at || Date.now()))}`
    const body = [
      `Signal: ${lead?.title || row.summary || topic.signal}`,
      `Record: start with ${lead?.source || "the current source cluster"}${lead?.sourceUrl ? ` at ${lead.sourceUrl}` : ""}, then compare primary documents before publishing a stronger claim.`,
      `Archive lens: ${row.video_title || "the Tales From the Inverted World archive"}${row.video_url ? ` (${row.video_url})` : ""}.`,
      `Weird read: the pattern may matter more than the headline if repeated language, timing, or institutional silence keeps appearing.`,
      `Skeptical read: older claims, weak sourcing, incentive loops, or stale records may explain the heat.`,
      `Next search: ${topic.query} site:.gov OR filetype:pdf.`,
    ]

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
          source_name,
          source_url,
          heat,
          thumbnail_prompt,
          prompt_version,
          metadata,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'draft', $5::jsonb, $6, $7, $8, $9, 'recursiv-v1', $10::jsonb, now())
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          deck = EXCLUDED.deck,
          body = EXCLUDED.body,
          source_name = EXCLUDED.source_name,
          source_url = EXCLUDED.source_url,
          heat = EXCLUDED.heat,
          thumbnail_prompt = EXCLUDED.thumbnail_prompt,
          metadata = EXCLUDED.metadata,
          updated_at = now()`,
      params: [
        slug,
        title,
        `A sourced ${topic.title} brief generated from Recursiv coverage snapshots and the Tales archive.`,
        topic.id,
        JSON.stringify(body),
        lead?.source || "Inverted World Research Desk",
        lead?.sourceUrl || "/archive",
        Math.max(60, items.length * 8),
        `Inverted World thumbnail for "${title}": ${topic.signal}, terminal grid, redacted source trail, amber-black palette, one iconic symbol, no fake documents, no faces.`,
        JSON.stringify({ generatedBy: "recursiv-job", sourceItemCount: items.length }),
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
    sql: `SELECT id, slug, thumbnail_prompt
      FROM article_drafts
      WHERE thumbnail_asset_id IS NULL AND thumbnail_prompt IS NOT NULL AND thumbnail_prompt <> ''
      ORDER BY generated_at DESC
      LIMIT 5`,
  })

  let generated = 0
  for (const row of data.rows) {
    const prompt = String(row.thumbnail_prompt || "")
    if (!prompt) continue
    const image = await sdk.media.generateImage({
      prompt,
      provider: "flux",
      size: "1024x1024",
      style: "vivid",
    })
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
        JSON.stringify({ articleSlug: row.slug }),
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

  return { imagesGenerated: generated }
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
