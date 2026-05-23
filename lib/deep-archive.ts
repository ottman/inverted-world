import { channelProfile, featuredVideos, type ChannelVideo } from "@/data/inverted-world"
import { allowProviderFallbacks, type ProviderFallbackOptions } from "@/lib/provider-fallbacks"
import { getRecursivChannelArchive, getRecursivChannelVideo } from "@/lib/recursiv/content"
import { classifyInvertedWorldTopic } from "@/lib/topic-classifier"
import { getYouTubeApiKey } from "@/lib/youtube-config"
import { fetchYouTubePublicChannelVideos } from "@/lib/youtube-public-archive"

type YouTubePlaylistItem = {
  snippet?: {
    title?: string
    description?: string
    publishedAt?: string
    resourceId?: { videoId?: string }
    thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } }
  }
  contentDetails?: { videoId?: string; videoPublishedAt?: string }
}

type YouTubePlaylistResponse = {
  nextPageToken?: string
  items?: YouTubePlaylistItem[]
}

export type DeepArchiveResponse = {
  generatedAt: string
  sourceMode: "recursiv-database" | "recursiv-snapshot" | "youtube-data-api" | "rss-plus-seed" | "youtube-public-channel" | "seed"
  completeHistoryAvailable: boolean
  videos: ChannelVideo[]
  totalCount: number
  offset: number
  limit: number
  hasMore: boolean
  warnings: string[]
}

const ARCHIVE_TIMEOUT_MS = 8500
const YOUTUBE_ARCHIVE_REVALIDATE_SECONDS = 300

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
    next: { revalidate: YOUTUBE_ARCHIVE_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS),
    headers: { "user-agent": "InvertedWorldArchive/1.0" },
  })
  if (!response.ok) throw new Error(`YouTube RSS returned ${response.status}`)

  const xml = await response.text()
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((entry) => {
    const block = entry[1]
    const title = decodeXml(block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || "")
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1]
    const videoId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    return videoId ? buildVideo(videoId, title, published) : null
  }).filter(Boolean) as ChannelVideo[]
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
      next: { revalidate: YOUTUBE_ARCHIVE_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS),
      headers: { "user-agent": "InvertedWorldArchive/1.0" },
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

export async function getDeepArchive(options: {
  limit?: number
  offset?: number
  maxLimit?: number
} & ProviderFallbackOptions = {}): Promise<DeepArchiveResponse> {
  const { limit = 100, offset = 0, maxLimit = 100 } = options
  const warnings: string[] = []
  const seeded = featuredVideos.filter((video) => video.source === "YouTube" && video.videoId)
  const recursivArchive = await getRecursivChannelArchive({ limit, offset, maxLimit })
  if (recursivArchive?.videos.length) {
    return {
      ...recursivArchive,
      sourceMode: recursivArchive.sourceMode || "recursiv-database",
      completeHistoryAvailable: true,
      warnings,
    }
  }

  const sliceArchive = (
    videos: ChannelVideo[],
    sourceMode: DeepArchiveResponse["sourceMode"],
    completeHistoryAvailable: boolean,
    extraWarnings: string[] = [],
  ): DeepArchiveResponse => {
    const totalCount = videos.length
    const safeMaxLimit = Math.min(Math.max(Math.trunc(maxLimit) || 100, 1), 1000)
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), safeMaxLimit)
    const safeOffset = Math.min(Math.max(Math.trunc(offset) || 0, 0), totalCount)

    return {
      generatedAt: new Date().toISOString(),
      sourceMode,
      completeHistoryAvailable,
      videos: videos.slice(safeOffset, safeOffset + safeLimit),
      totalCount,
      offset: safeOffset,
      limit: safeLimit,
      hasMore: safeOffset + safeLimit < totalCount,
      warnings: extraWarnings,
    }
  }
  if (!allowProviderFallbacks(options)) {
    return sliceArchive(dedupeVideos(seeded), "seed", false, [
      "Provider fallbacks are disabled for public reads; Recursiv archive sync owns YouTube ingestion.",
    ])
  }

  try {
    const apiVideos = await fetchYouTubeDataApi()
    if (apiVideos?.length) {
      return sliceArchive(dedupeVideos([...apiVideos, ...seeded]), "youtube-data-api", true, warnings)
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "YouTube Data API archive failed")
  }

  try {
    const rssVideos = await fetchYouTubeRss()
    return sliceArchive(dedupeVideos([...rssVideos, ...seeded]), "rss-plus-seed", false, [
      ...warnings,
      "Set YOUTUBE_API_KEY or YOUTUBE_DATA_API_KEY to paginate the full channel history.",
    ])
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "YouTube RSS archive failed")
  }

  try {
    const publicVideos = await fetchYouTubePublicChannelVideos({ limit: 60 })
    if (publicVideos.length) {
      return sliceArchive(dedupeVideos([...publicVideos, ...seeded]), "youtube-public-channel", false, [
        ...warnings,
        "Public YouTube channel page fallback is limited to recent uploads. Set YOUTUBE_API_KEY or YOUTUBE_DATA_API_KEY to paginate the complete uploads playlist.",
      ])
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "YouTube public channel archive failed")
  }

  return sliceArchive(dedupeVideos(seeded), "seed", false, [
    ...warnings,
    "Set YOUTUBE_API_KEY or YOUTUBE_DATA_API_KEY to unlock the complete uploads playlist history.",
  ])
}

export async function getArchiveVideo(videoId: string) {
  if (!videoId) return null
  const archive = await getDeepArchive({ limit: 1000, maxLimit: 1000 })
  const archiveVideo = archive.videos.find((video) => video.videoId === videoId)
  if (archiveVideo) return archiveVideo

  return getRecursivChannelVideo(videoId)
}

export async function getRecommendedArchiveVideos(video: ChannelVideo, limit = 8) {
  const archive = await getDeepArchive({ limit: 1000, maxLimit: 1000 })
  const candidates = archive.videos.filter((item) => item.videoId && item.videoId !== video.videoId)
  const sameTopic = candidates.filter((item) => item.topicId === video.topicId)
  const nearbyTopics = candidates.filter((item) => item.topicId !== video.topicId)

  return dedupeVideos([...sameTopic, ...nearbyTopics]).slice(0, Math.max(1, Math.min(limit, 12)))
}
