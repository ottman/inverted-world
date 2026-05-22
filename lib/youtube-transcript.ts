export type TranscriptSegment = {
  start: number
  duration?: number
  text: string
}

export type YouTubeTranscript = {
  videoId: string
  available: boolean
  language?: string
  source?: "manual" | "auto" | "youtube"
  segments: TranscriptSegment[]
  text: string
  fetchedAt: string
  error?: string
}

const TRANSCRIPT_TIMEOUT_MS = 6500

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
}

function stripTranscriptText(value: string) {
  return decodeXml(value)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim()
}

function readAttributes(tag: string) {
  const attributes = new Map<string, string>()
  for (const match of tag.matchAll(/([a-z_]+)="([^"]*)"/gi)) {
    attributes.set(match[1], decodeXml(match[2]))
  }
  return attributes
}

function parseTrackList(xml: string) {
  return [...xml.matchAll(/<track\b[^>]*>/gi)]
    .map((match) => {
      const attributes = readAttributes(match[0])
      return {
        language: attributes.get("lang_code") || "",
        name: attributes.get("name") || "",
        kind: attributes.get("kind") || "",
      }
    })
    .filter((track) => track.language)
}

function pickTrack(tracks: ReturnType<typeof parseTrackList>) {
  return (
    tracks.find((track) => track.language === "en" && track.kind !== "asr") ||
    tracks.find((track) => track.language === "en") ||
    tracks.find((track) => track.language.startsWith("en")) ||
    tracks[0]
  )
}

function parseJson3Transcript(data: unknown): TranscriptSegment[] {
  const events = (data as { events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }> })
    .events

  return (events || [])
    .flatMap((event): TranscriptSegment[] => {
      const text = stripTranscriptText((event.segs || []).map((segment) => segment.utf8 || "").join(""))
      if (!text) return []
      return [{
        start: (event.tStartMs || 0) / 1000,
        duration: event.dDurationMs ? event.dDurationMs / 1000 : undefined,
        text,
      }]
    })
}

function parseXmlTranscript(xml: string): TranscriptSegment[] {
  return [...xml.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi)]
    .flatMap((match): TranscriptSegment[] => {
      const attributes = readAttributes(match[1])
      const text = stripTranscriptText(match[2])
      if (!text) return []
      return [{
        start: Number(attributes.get("start") || "0"),
        duration: attributes.get("dur") ? Number(attributes.get("dur")) : undefined,
        text,
      }]
    })
}

async function fetchTranscriptUrl(url: URL) {
  return fetch(url, {
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(TRANSCRIPT_TIMEOUT_MS),
    headers: { "user-agent": "InvertedWorldTranscript/1.0" },
  })
}

function unavailable(videoId: string, error?: string): YouTubeTranscript {
  return {
    videoId,
    available: false,
    segments: [],
    text: "",
    fetchedAt: new Date().toISOString(),
    error,
  }
}

export async function getYouTubeTranscript(videoId?: string | null): Promise<YouTubeTranscript> {
  if (!videoId) return unavailable("")

  try {
    const listUrl = new URL("https://www.youtube.com/api/timedtext")
    listUrl.searchParams.set("type", "list")
    listUrl.searchParams.set("v", videoId)

    const listResponse = await fetchTranscriptUrl(listUrl)
    if (!listResponse.ok) return unavailable(videoId, `YouTube transcript list returned ${listResponse.status}`)

    const tracks = parseTrackList(await listResponse.text())
    const track = pickTrack(tracks)
    if (!track) return unavailable(videoId, "No public caption track is available for this video.")

    const transcriptUrl = new URL("https://www.youtube.com/api/timedtext")
    transcriptUrl.searchParams.set("v", videoId)
    transcriptUrl.searchParams.set("lang", track.language)
    transcriptUrl.searchParams.set("fmt", "json3")
    if (track.kind) transcriptUrl.searchParams.set("kind", track.kind)
    if (track.name) transcriptUrl.searchParams.set("name", track.name)

    const response = await fetchTranscriptUrl(transcriptUrl)
    if (!response.ok) return unavailable(videoId, `YouTube transcript returned ${response.status}`)

    const rawText = await response.text()
    let segments: TranscriptSegment[] = []

    try {
      segments = parseJson3Transcript(JSON.parse(rawText))
    } catch {
      segments = parseXmlTranscript(rawText)
    }

    if (!segments.length) return unavailable(videoId, "Caption track was present but empty.")

    return {
      videoId,
      available: true,
      language: track.language,
      source: track.kind === "asr" ? "auto" : "manual",
      segments,
      text: segments.map((segment) => segment.text).join(" "),
      fetchedAt: new Date().toISOString(),
    }
  } catch (error) {
    return unavailable(videoId, error instanceof Error ? error.message : "Transcript fetch failed")
  }
}

export function groupTranscriptSegments(segments: TranscriptSegment[]) {
  const groups: Array<{ start: number; text: string }> = []
  let current: { start: number; text: string } | null = null

  for (const segment of segments) {
    if (!current) {
      current = { start: segment.start, text: segment.text }
      continue
    }

    if (current.text.length > 760 || segment.start - current.start > 75) {
      groups.push(current)
      current = { start: segment.start, text: segment.text }
      continue
    }

    current.text = `${current.text} ${segment.text}`.trim()
  }

  if (current) groups.push(current)
  return groups
}

export function transcriptExcerpt(transcript: YouTubeTranscript, length = 260) {
  if (!transcript.text) return ""
  return transcript.text.length > length ? `${transcript.text.slice(0, length - 3).trim()}...` : transcript.text
}
