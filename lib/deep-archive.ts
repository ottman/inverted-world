import { channelProfile, featuredVideos, type ChannelVideo } from "@/data/inverted-world"

type YouTubePlaylistItem = {
  snippet?: {
    title?: string
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
  sourceMode: "youtube-data-api" | "rss-plus-seed" | "seed"
  completeHistoryAvailable: boolean
  videos: ChannelVideo[]
  warnings: string[]
}

const ARCHIVE_TIMEOUT_MS = 8500

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
}

function buildVideo(videoId: string, title: string, publishedAt?: string): ChannelVideo {
  return {
    title: title || "Untitled upload",
    date: publishedAt ? publishedAt.slice(0, 10) : "",
    href: `https://www.youtube.com/watch?v=${videoId}`,
    topicId: "all",
    source: "YouTube",
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    kind: "episode",
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
    next: { revalidate: 900 },
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
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS),
      headers: { "user-agent": "InvertedWorldArchive/1.0" },
    })
    if (!response.ok) throw new Error(`YouTube Data API returned ${response.status}`)

    const data = (await response.json()) as YouTubePlaylistResponse
    for (const item of data.items ?? []) {
      const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId
      if (!videoId) continue
      videos.push(buildVideo(videoId, item.snippet?.title || "Untitled upload", item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt))
    }

    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }

  return videos
}

export async function getDeepArchive(): Promise<DeepArchiveResponse> {
  const warnings: string[] = []
  const seeded = featuredVideos.filter((video) => video.source === "YouTube" && video.videoId)

  try {
    const apiVideos = await fetchYouTubeDataApi()
    if (apiVideos?.length) {
      return {
        generatedAt: new Date().toISOString(),
        sourceMode: "youtube-data-api",
        completeHistoryAvailable: true,
        videos: dedupeVideos([...apiVideos, ...seeded]),
        warnings,
      }
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "YouTube Data API archive failed")
  }

  try {
    const rssVideos = await fetchYouTubeRss()
    return {
      generatedAt: new Date().toISOString(),
      sourceMode: "rss-plus-seed",
      completeHistoryAvailable: false,
      videos: dedupeVideos([...rssVideos, ...seeded]),
      warnings: [...warnings, "Set YOUTUBE_API_KEY to paginate the full channel history."],
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "YouTube RSS archive failed")
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceMode: "seed",
    completeHistoryAvailable: false,
    videos: dedupeVideos(seeded),
    warnings: [...warnings, "Set YOUTUBE_API_KEY to unlock the complete uploads playlist history."],
  }
}
