// Rights-cleared images via Openverse (api.openverse.org) — openly-licensed (CC / public-domain)
// media. We prefer CC0 / Public-Domain Mark (no attribution required), then other commercially-
// usable CC licenses (attribution shown). The search query is AI-crafted per story for relevance.
const OPENVERSE_ENDPOINT = "https://api.openverse.org/v1/images/"

export type RightsClearedImage = {
  url: string
  license: string // e.g. "cc0 1.0", "pdm 1.0", "by 2.0"
  attribution?: string
  sourceUrl?: string
  creator?: string
}

type OpenverseResult = {
  url?: string
  license?: string
  license_version?: string
  attribution?: string
  foreign_landing_url?: string
  creator?: string
  filetype?: string
}

function licenseScore(result: OpenverseResult): number {
  const license = (result.license || "").toLowerCase()
  let score = 0
  if (license === "cc0" || license === "pdm") score += 10 // no attribution required → prefer
  if (license === "by" || license === "by-sa") score += 3
  const url = (result.url || "").toLowerCase()
  if (/\.(jpe?g|png|webp)(\?|$)/.test(url)) score += 2
  return score
}

// Try a cascade of queries (best → broadest) and return the first rights-cleared image found, so
// effectively every story ends up with a relevant CC/PD image. De-dupes and skips empties.
export async function fetchOpenverseImageFromQueries(queries: Array<string | undefined>): Promise<RightsClearedImage | null> {
  const seen = new Set<string>()
  for (const raw of queries) {
    const q = (raw || "").trim()
    if (!q || seen.has(q.toLowerCase())) continue
    seen.add(q.toLowerCase())
    const image = await fetchOpenverseImage(q).catch(() => null)
    if (image) return image
  }
  return null
}

// Search Openverse for a rights-cleared image. Returns the best commercially-usable result
// (CC0/PD preferred), or null. `query` should be concise visual keywords.
export async function fetchOpenverseImage(query: string): Promise<RightsClearedImage | null> {
  const q = (query || "").trim()
  if (!q) return null
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
    return null
  }
  if (!response.ok) return null
  const data = (await response.json().catch(() => null)) as { results?: OpenverseResult[] } | null
  const results = (data?.results || []).filter((r) => r.url && r.url.startsWith("http"))
  if (!results.length) return null
  const best = [...results].sort((a, b) => licenseScore(b) - licenseScore(a))[0]
  const license = `${best.license || ""} ${best.license_version || ""}`.trim()
  const noAttribution = /^(cc0|pdm)\b/i.test(license)
  return {
    url: best.url as string,
    license,
    attribution: noAttribution ? undefined : best.attribution,
    sourceUrl: best.foreign_landing_url,
    creator: best.creator,
  }
}
