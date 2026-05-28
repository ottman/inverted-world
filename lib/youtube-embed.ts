const YOUTUBE_EMBED_HOST = "www.youtube-nocookie.com"

function safeYouTubeId(value?: string) {
  const cleaned = String(value || "").trim()
  return /^[A-Za-z0-9_-]{11}$/.test(cleaned) ? cleaned : ""
}

export function extractYouTubeVideoId(value?: string) {
  const raw = String(value || "").trim()
  const direct = safeYouTubeId(raw)
  if (direct) return direct

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
    const host = url.hostname.replace(/^www\./, "")
    if (host === "youtu.be") return safeYouTubeId(url.pathname.split("/").filter(Boolean)[0])
    if (!host.endsWith("youtube.com") && !host.endsWith("youtube-nocookie.com")) return ""

    const queryVideoId = safeYouTubeId(url.searchParams.get("v") || "")
    if (queryVideoId) return queryVideoId

    const parts = url.pathname.split("/").filter(Boolean)
    const markerIndex = parts.findIndex((part) => ["embed", "shorts", "live", "v"].includes(part))
    return markerIndex >= 0 ? safeYouTubeId(parts[markerIndex + 1]) : ""
  } catch {
    const match = raw.match(/(?:watch\?v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/)
    return safeYouTubeId(match?.[1])
  }
}

function extractYouTubePlaylistId(value?: string) {
  const raw = String(value || "").trim()
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
    const list = url.searchParams.get("list") || ""
    return /^[A-Za-z0-9_-]{6,}$/.test(list) ? list : ""
  } catch {
    const match = raw.match(/[?&]list=([A-Za-z0-9_-]{6,})/)
    return match?.[1] || ""
  }
}

export function youtubeEmbedUrl({
  videoId,
  source,
  autoplay = false,
}: {
  videoId?: string
  source?: string
  autoplay?: boolean
}) {
  const resolvedVideoId = extractYouTubeVideoId(videoId) || extractYouTubeVideoId(source)
  const url = resolvedVideoId
    ? new URL(`https://${YOUTUBE_EMBED_HOST}/embed/${resolvedVideoId}`)
    : new URL(`https://${YOUTUBE_EMBED_HOST}/embed/videoseries`)

  if (!resolvedVideoId) {
    const playlistId = extractYouTubePlaylistId(source)
    if (playlistId) url.searchParams.set("list", playlistId)
  }

  url.searchParams.set("rel", "0")
  url.searchParams.set("playsinline", "1")
  url.searchParams.set("controls", "1")
  if (autoplay) url.searchParams.set("autoplay", "1")
  return url.toString()
}
