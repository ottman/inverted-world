import { channelProfile, type ChannelVideo } from "@/data/inverted-world"
import { classifyInvertedWorldTopic } from "@/lib/topic-classifier"

type UnknownRecord = Record<string, unknown>

const PUBLIC_YOUTUBE_TIMEOUT_MS = 10000

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = textValue(value)
    if (text) return text
  }
  return ""
}

function parseInitialData(html: string): unknown {
  const marker = "var ytInitialData ="
  const markerIndex = html.indexOf(marker)
  if (markerIndex < 0) return null

  const start = html.indexOf("{", markerIndex)
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < html.length; index += 1) {
    const char = html[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === "\\") {
        escaped = true
      } else if (char === "\"") {
        inString = false
      }
      continue
    }

    if (char === "\"") {
      inString = true
    } else if (char === "{") {
      depth += 1
    } else if (char === "}") {
      depth -= 1
      if (depth === 0) return JSON.parse(html.slice(start, index + 1))
    }
  }

  return null
}

function relativeDate(value: string, now = new Date()) {
  const normalized = value.toLowerCase()
  const match = normalized.match(/(?:streamed|premiered)?\s*(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/)
  if (!match) return ""

  const amount = Number(match[1])
  const unit = match[2]
  const date = new Date(now)
  if (unit === "second") date.setSeconds(date.getSeconds() - amount)
  if (unit === "minute") date.setMinutes(date.getMinutes() - amount)
  if (unit === "hour") date.setHours(date.getHours() - amount)
  if (unit === "day") date.setDate(date.getDate() - amount)
  if (unit === "week") date.setDate(date.getDate() - amount * 7)
  if (unit === "month") date.setMonth(date.getMonth() - amount)
  if (unit === "year") date.setFullYear(date.getFullYear() - amount)
  return date.toISOString()
}

function metadataParts(lockup: UnknownRecord) {
  const metadata = lockup.metadata
  if (!isRecord(metadata)) return []
  const lockupMetadata = metadata.lockupMetadataViewModel
  if (!isRecord(lockupMetadata)) return []
  const contentMetadata = lockupMetadata.metadata
  if (!isRecord(contentMetadata)) return []
  const viewModel = contentMetadata.contentMetadataViewModel
  if (!isRecord(viewModel)) return []
  const rows = Array.isArray(viewModel.metadataRows) ? viewModel.metadataRows : []
  return rows.flatMap((row) => {
    if (!isRecord(row)) return []
    const parts = Array.isArray(row.metadataParts) ? row.metadataParts : []
    return parts
      .map((part) => (isRecord(part) && isRecord(part.text) ? textValue(part.text.content) : ""))
      .filter(Boolean)
  })
}

function thumbnailUrl(lockup: UnknownRecord, videoId: string) {
  const contentImage = lockup.contentImage
  if (isRecord(contentImage)) {
    const thumbnail = contentImage.thumbnailViewModel
    if (isRecord(thumbnail) && isRecord(thumbnail.image) && Array.isArray(thumbnail.image.sources)) {
      const source = thumbnail.image.sources.find((item) => isRecord(item) && textValue(item.url))
      if (isRecord(source)) return textValue(source.url).replace(/\\u0026/g, "&")
    }
  }

  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

function videoFromLockup(lockup: UnknownRecord, now: Date): ChannelVideo | null {
  const videoId = firstText(lockup.contentId)
  if (!videoId || !/^[A-Za-z0-9_-]{6,}$/.test(videoId)) return null

  const metadata = lockup.metadata
  const lockupMetadata = isRecord(metadata) && isRecord(metadata.lockupMetadataViewModel) ? metadata.lockupMetadataViewModel : {}
  const title = firstText(isRecord(lockupMetadata) && isRecord(lockupMetadata.title) ? lockupMetadata.title.content : "")
  if (!title) return null

  const parts = metadataParts(lockup)
  const publishedAt = parts.map((part) => relativeDate(part, now)).find(Boolean) || ""

  return {
    title,
    date: publishedAt ? publishedAt.slice(0, 10) : "",
    href: `https://www.youtube.com/watch?v=${videoId}`,
    topicId: classifyInvertedWorldTopic(title),
    source: "YouTube",
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
    thumbnail: thumbnailUrl(lockup, videoId),
    kind: title.toLowerCase().includes("#shorts") ? "short" : "episode",
  }
}

function videoFromRenderer(renderer: UnknownRecord, now: Date): ChannelVideo | null {
  const videoId = firstText(renderer.videoId)
  const titleRuns = isRecord(renderer.title) && Array.isArray(renderer.title.runs) ? renderer.title.runs : []
  const title = firstText(
    renderer.title && isRecord(renderer.title) ? renderer.title.simpleText : "",
    titleRuns.map((run) => (isRecord(run) ? textValue(run.text) : "")).join(" "),
  )
  if (!videoId || !title) return null

  const publishedText = firstText(
    isRecord(renderer.publishedTimeText) ? renderer.publishedTimeText.simpleText : "",
    isRecord(renderer.publishedTimeText) && Array.isArray(renderer.publishedTimeText.runs)
      ? renderer.publishedTimeText.runs.map((run) => (isRecord(run) ? textValue(run.text) : "")).join(" ")
      : "",
  )
  const publishedAt = relativeDate(publishedText, now)

  return {
    title,
    date: publishedAt ? publishedAt.slice(0, 10) : "",
    href: `https://www.youtube.com/watch?v=${videoId}`,
    topicId: classifyInvertedWorldTopic(title),
    source: "YouTube",
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    kind: title.toLowerCase().includes("#shorts") ? "short" : "episode",
  }
}

function collectVideos(value: unknown, videos: ChannelVideo[], seen: Set<string>, now: Date) {
  if (!isRecord(value)) {
    if (Array.isArray(value)) value.forEach((item) => collectVideos(item, videos, seen, now))
    return
  }

  const lockup = value.lockupViewModel
  const renderer = value.videoRenderer || value.gridVideoRenderer
  const video = isRecord(lockup) ? videoFromLockup(lockup, now) : isRecord(renderer) ? videoFromRenderer(renderer, now) : null
  if (video?.videoId && !seen.has(video.videoId)) {
    seen.add(video.videoId)
    videos.push(video)
  }

  for (const nested of Object.values(value)) collectVideos(nested, videos, seen, now)
}

export function extractYouTubePublicChannelVideos(html: string, options: { now?: Date; limit?: number } = {}) {
  const data = parseInitialData(html)
  const videos: ChannelVideo[] = []
  collectVideos(data, videos, new Set(), options.now || new Date())
  return videos.slice(0, Math.max(1, Math.min(Math.trunc(options.limit || 60), 120)))
}

export async function fetchYouTubePublicChannelVideos(options: { limit?: number } = {}) {
  const response = await fetch(`https://www.youtube.com/${channelProfile.youtubeHandle}/videos`, {
    headers: {
      "user-agent": "Mozilla/5.0 InvertedWorldYouTubePublicArchive/1.0",
    },
    signal: AbortSignal.timeout(PUBLIC_YOUTUBE_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`YouTube public channel page returned ${response.status}`)

  return extractYouTubePublicChannelVideos(await response.text(), options)
}
