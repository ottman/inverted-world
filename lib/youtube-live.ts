import { channelProfile } from "@/data/inverted-world"
import { allowProviderFallbacks, type ProviderFallbackOptions } from "@/lib/provider-fallbacks"
import { getYouTubeApiKey } from "@/lib/youtube-config"

export type YouTubeLiveStatus = {
  isLive: boolean
  title?: string
  videoId?: string
  url?: string
  checkedAt: string
  error?: string
}

const LIVE_STATUS_TIMEOUT_MS = 5000

export async function getYouTubeLiveStatus(options: ProviderFallbackOptions = {}): Promise<YouTubeLiveStatus> {
  const checkedAt = new Date().toISOString()
  if (!allowProviderFallbacks(options)) {
    return { isLive: false, checkedAt }
  }

  const key = getYouTubeApiKey()

  if (!key) {
    return { isLive: false, checkedAt }
  }

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search")
    url.searchParams.set("part", "snippet")
    url.searchParams.set("channelId", channelProfile.youtubeChannelId)
    url.searchParams.set("eventType", "live")
    url.searchParams.set("type", "video")
    url.searchParams.set("maxResults", "1")
    url.searchParams.set("key", key)

    const response = await fetch(url, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(LIVE_STATUS_TIMEOUT_MS),
      headers: {
        "user-agent": "InvertedWorldLiveStatus/1.0",
      },
    })

    if (!response.ok) {
      throw new Error(`YouTube live status returned ${response.status}`)
    }

    const data = (await response.json()) as {
      items?: Array<{
        id?: { videoId?: string }
        snippet?: { title?: string }
      }>
    }
    const videoId = data.items?.[0]?.id?.videoId

    if (!videoId) {
      return { isLive: false, checkedAt }
    }

    return {
      isLive: true,
      videoId,
      title: data.items?.[0]?.snippet?.title || channelProfile.liveName,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      checkedAt,
    }
  } catch (error) {
    return {
      isLive: false,
      checkedAt,
      error: error instanceof Error ? error.message : "YouTube live status lookup failed",
    }
  }
}
