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
  relevance?: number // weighted match strength of the image's title/tags vs the story (0 = generic)
  trusted?: boolean // the picture genuinely depicts the story's subject (anchor term + ≥2 hits, no stock cruft)
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
  // 3-letter fillers — kept out so short ACRONYMS (ufo, cia, fbi, tnt, nsa, ai) still count as terms.
  "are", "was", "has", "had", "his", "her", "its", "our", "out", "off", "via", "per", "but", "not",
  "you", "all", "any", "can", "did", "get", "got", "let", "may", "now", "one", "two", "see", "too",
  "use", "way", "his", "him", "she", "they", "them", "were", "have", "been", "will", "just", "amid",
])

// Significant lowercased terms from a story used to judge image relevance. Keeps 3-char tokens so
// acronyms (UFO, CIA, TNT, FBI) — which are often the whole subject — aren't silently dropped.
export function imageRelevanceTerms(parts: Array<string | undefined>): string[] {
  const terms = new Set<string>()
  for (const part of parts) {
    for (const raw of (part || "").toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length >= 3 && !IMAGE_STOPWORDS.has(raw)) terms.add(raw)
    }
  }
  return [...terms]
}

// Stock-photo signals: when these dominate an image's title/tags it's almost never the actual
// subject of a news story or tale (it's a birthday cake, a costume, a logo, a recipe). Heavily
// penalized so a single coincidental keyword match can't pull in an obviously-wrong picture.
const STOCK_CRUFT = new Set([
  "cake", "birthday", "wedding", "bridal", "party", "recipe", "cooking", "baking", "dessert",
  "costume", "cosplay", "fancydress", "halloween", "tattoo", "selfie", "portrait", "headshot",
  "fashion", "model", "modeling", "runway", "cartoon", "clipart", "logo", "icon", "emoji", "meme",
  "greeting", "postcard", "stamp", "coin", "banknote", "toy", "figurine", "plush", "lego", "doll",
  "knitting", "crochet", "embroidery", "scrapbook", "sticker", "wallpaper", "template", "mockup",
])

// Score an image's RELEVANCE to a story by how its title/tags overlap the story's terms — title
// matches count double (the title describes the subject; tags are noisier), an "anchor" hit (one of
// the story's distinctive subject words) is rewarded, and stock-photo cruft is heavily penalized.
// `trusted` means the picture genuinely depicts the subject: an anchor matched, ≥2 total term hits,
// and no dominating cruft — the bar a photo must clear to be used instead of an on-topic AI image.
function scoreRelevance(
  result: OpenverseResult,
  terms: string[],
  anchors: string[],
): { relevance: number; trusted: boolean } {
  const title = (result.title || "").toLowerCase()
  const tagList = (result.tags || []).map((tag) => (tag?.name || "").toLowerCase())
  const tagStr = tagList.join(" ")
  let titleHits = 0
  let tagHits = 0
  for (const term of terms) {
    if (title.includes(term)) titleHits += 1
    else if (tagStr.includes(term)) tagHits += 1
  }
  const anchorHit = anchors.some((anchor) => title.includes(anchor) || tagStr.includes(anchor))
  const cruft = [...STOCK_CRUFT].some((word) => title.includes(word) || tagList.includes(word))
  let relevance = titleHits * 2 + tagHits + (anchorHit ? 2 : 0)
  if (cruft) relevance -= 4
  const trusted = anchorHit && titleHits + tagHits >= 2 && !cruft
  return { relevance, trusted }
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

function toRightsClearedImage(result: OpenverseResult, relevance: number, trusted: boolean): RightsClearedImage {
  const license = `${result.license || ""} ${result.license_version || ""}`.trim()
  const noAttribution = /^(cc0|pdm)\b/i.test(license)
  return {
    url: result.url as string,
    license,
    attribution: noAttribution ? undefined : result.attribution,
    sourceUrl: result.foreign_landing_url,
    creator: result.creator,
    relevance,
    trusted,
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
// words and `anchors` its distinctive subject words (entity/concept names). An image that mentions
// more of them — especially in its title — wins. Returns the best available even at relevance 0 so a
// story is never left imageless; the `relevance`/`trusted` fields let callers tell a real match from
// a coincidental keyword hit (and fall back to an on-topic AI image when nothing is trusted).
export async function fetchBestRelevantOpenverseImage(
  queries: Array<string | undefined>,
  relevanceTerms: string[] = [],
  anchors: string[] = [],
): Promise<RightsClearedImage | null> {
  const seenQueries = new Set<string>()
  const seenUrls = new Set<string>()
  let best: { result: OpenverseResult; relevance: number; trusted: boolean; score: number } | null = null

  for (const raw of queries) {
    const q = (raw || "").trim()
    if (!q || seenQueries.has(q.toLowerCase())) continue
    seenQueries.add(q.toLowerCase())
    const results = await searchOpenverse(q)
    for (const result of results) {
      const key = (result.url || "").toLowerCase()
      if (seenUrls.has(key)) continue
      seenUrls.add(key)
      const { relevance, trusted } = scoreRelevance(result, relevanceTerms, anchors)
      // Trust dominates ranking, then weighted relevance, then license/format.
      const score = (trusted ? 100000 : 0) + relevance * 100 + licenseScore(result)
      if (!best || score > best.score) best = { result, relevance, trusted, score }
    }
    // Stop early once we have a trusted match (genuinely depicts the subject) to save calls.
    if (best && best.trusted) break
  }

  return best ? toRightsClearedImage(best.result, best.relevance, best.trusted) : null
}

// AI-generated thumbnail via Pollinations (free, keyless text-to-image) — used when no rights-cleared
// photo is relevant enough, so a story never shows an irrelevant "dud". The URL is deterministic per
// prompt (Pollinations caches by URL), so it's stable to store and reload.
const POLLINATIONS_ENDPOINT = "https://image.pollinations.ai/prompt/"
export function aiThumbnailImage(prompt: string): RightsClearedImage | null {
  const trimmed = (prompt || "").replace(/\s+/g, " ").trim().slice(0, 340)
  if (!trimmed) return null
  // Generated FROM the story, so it's always on-topic. Styled cinematic-editorial: credible for both
  // breaking-news clusters and eerie "tales" without reading as clip-art. No text/watermark/caption.
  const styled = `${trimmed}. Cinematic editorial photograph, photorealistic, atmospheric, dramatic natural lighting, high detail, documentary framing, no text, no watermark, no caption, no border`
  const url = `${POLLINATIONS_ENDPOINT}${encodeURIComponent(styled)}?width=1024&height=576&nologo=true&model=flux`
  return { url, license: "AI-generated", relevance: 99, trusted: true }
}

// Best thumbnail for a story: a rights-cleared photo ONLY when one genuinely depicts the subject
// (`trusted` — an anchor term matched, ≥2 hits, no stock cruft), otherwise an on-topic AI image.
// This is what stops a coincidental single-keyword match (e.g. a birthday cake for a UFO story) from
// ever being shown: anything short of a trusted photo loses to a picture generated from the story.
export async function fetchStoryThumbnail(
  queries: Array<string | undefined>,
  relevanceTerms: string[],
  aiPrompt: string,
  anchors: string[] = [],
): Promise<RightsClearedImage | null> {
  const photo = await fetchBestRelevantOpenverseImage(queries, relevanceTerms, anchors).catch(() => null)
  if (photo && photo.trusted) return photo
  return aiThumbnailImage(aiPrompt) || photo
}

// Back-compat: cascade queries with no relevance signal (returns the first rights-cleared hit).
export async function fetchOpenverseImageFromQueries(queries: Array<string | undefined>): Promise<RightsClearedImage | null> {
  return fetchBestRelevantOpenverseImage(queries, [], [])
}

// Single-query convenience (best rights-cleared result for the query).
export async function fetchOpenverseImage(query: string): Promise<RightsClearedImage | null> {
  return fetchBestRelevantOpenverseImage([query], [])
}
