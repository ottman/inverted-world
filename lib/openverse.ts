// Rights-cleared images via Openverse (api.openverse.org) — openly-licensed (CC / public-domain)
// media. We prefer CC0 / Public-Domain Mark (no attribution required), then other commercially-
// usable CC licenses (attribution shown). Results are scored for RELEVANCE to the story (how many
// of the story's key terms appear in the image's title/tags) so the picture actually matches the
// article — not just any rights-cleared photo the query happened to surface.
const OPENVERSE_ENDPOINT = "https://api.openverse.org/v1/images/"

export type RightsClearedImage = {
  url: string
  license: string // e.g. "cc0 1.0", "pdm 1.0", "by 2.0"
  attribution?: string
  sourceUrl?: string
  creator?: string
  relevance?: number // how many story terms matched the image title/tags (0 = generic)
}

type OpenverseResult = {
  url?: string
  license?: string
  license_version?: string
  attribution?: string
  foreign_landing_url?: string
  creator?: string
  filetype?: string
  title?: string
  tags?: Array<{ name?: string }>
}

const IMAGE_STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "after", "into", "over", "under", "amid",
  "says", "say", "said", "new", "news", "report", "reports", "latest", "update", "live", "watch",
  "video", "day", "week", "year", "first", "more", "than", "what", "who", "how", "why", "when",
])

// Significant lowercased terms from a story used to judge image relevance.
export function imageRelevanceTerms(parts: Array<string | undefined>): string[] {
  const terms = new Set<string>()
  for (const part of parts) {
    for (const raw of (part || "").toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length > 3 && !IMAGE_STOPWORDS.has(raw)) terms.add(raw)
    }
  }
  return [...terms]
}

function relevanceScore(result: OpenverseResult, terms: string[]): number {
  if (!terms.length) return 0
  const haystack = `${result.title || ""} ${(result.tags || []).map((tag) => tag?.name || "").join(" ")}`.toLowerCase()
  let matched = 0
  for (const term of terms) {
    if (haystack.includes(term)) matched += 1
  }
  return matched
}

function licenseScore(result: OpenverseResult): number {
  const license = (result.license || "").toLowerCase()
  let score = 0
  if (license === "cc0" || license === "pdm") score += 4 // no attribution required → prefer
  if (license === "by" || license === "by-sa") score += 1
  const url = (result.url || "").toLowerCase()
  if (/\.(jpe?g|png|webp)(\?|$)/.test(url)) score += 1
  return score
}

function toRightsClearedImage(result: OpenverseResult, relevance: number): RightsClearedImage {
  const license = `${result.license || ""} ${result.license_version || ""}`.trim()
  const noAttribution = /^(cc0|pdm)\b/i.test(license)
  return {
    url: result.url as string,
    license,
    attribution: noAttribution ? undefined : result.attribution,
    sourceUrl: result.foreign_landing_url,
    creator: result.creator,
    relevance,
  }
}

async function searchOpenverse(query: string): Promise<OpenverseResult[]> {
  const q = (query || "").trim()
  if (!q) return []
  const url = new URL(OPENVERSE_ENDPOINT)
  url.searchParams.set("q", q)
  url.searchParams.set("page_size", "12")
  url.searchParams.set("license_type", "commercial,modification") // usable commercially + editable
  url.searchParams.set("mature", "false")
  let response: Response
  try {
    response = await fetch(url, {
      headers: { "user-agent": "InvertedWorld/1.0 (news aggregator; rights-cleared images)" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    })
  } catch {
    return []
  }
  if (!response.ok) return []
  const data = (await response.json().catch(() => null)) as { results?: OpenverseResult[] } | null
  return (data?.results || []).filter((r) => r.url && r.url.startsWith("http"))
}

// Search Openverse across a cascade of queries, score every candidate by relevance-to-the-story
// (then license/format), and return the single best match. `relevanceTerms` are the story's key
// words; an image that mentions more of them in its title/tags wins. Returns the best available even
// at relevance 0 so a story is never left imageless, but the `relevance` field lets callers tell.
export async function fetchBestRelevantOpenverseImage(
  queries: Array<string | undefined>,
  relevanceTerms: string[] = [],
): Promise<RightsClearedImage | null> {
  const seenQueries = new Set<string>()
  const seenUrls = new Set<string>()
  let best: { result: OpenverseResult; relevance: number; score: number } | null = null

  for (const raw of queries) {
    const q = (raw || "").trim()
    if (!q || seenQueries.has(q.toLowerCase())) continue
    seenQueries.add(q.toLowerCase())
    const results = await searchOpenverse(q)
    for (const result of results) {
      const key = (result.url || "").toLowerCase()
      if (seenUrls.has(key)) continue
      seenUrls.add(key)
      const relevance = relevanceScore(result, relevanceTerms)
      const score = relevance * 100 + licenseScore(result)
      if (!best || score > best.score) best = { result, relevance, score }
    }
    // Stop early once we have a solidly-relevant match (≥2 story terms) to save calls.
    if (best && best.relevance >= 2) break
  }

  return best ? toRightsClearedImage(best.result, best.relevance) : null
}

// Back-compat: cascade queries with no relevance signal (returns the first rights-cleared hit).
export async function fetchOpenverseImageFromQueries(queries: Array<string | undefined>): Promise<RightsClearedImage | null> {
  return fetchBestRelevantOpenverseImage(queries, [])
}

// Single-query convenience (best rights-cleared result for the query).
export async function fetchOpenverseImage(query: string): Promise<RightsClearedImage | null> {
  return fetchBestRelevantOpenverseImage([query], [])
}
