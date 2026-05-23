import {
  WORLDWIRE_LANES,
  decodeWorldwireEntities,
  hostName,
  isExternalUrl,
  isGoogleNewsUrl,
  normalizeWorldwireText,
  readWorldwireXmlSource,
  readWorldwireXmlTag,
  scoreWorldwireTitle,
  sourceLabel,
  stripWorldwireTags,
  uniqueWorldwireItems,
  type WorldwireItem,
  type WorldwireLane,
} from "@/lib/worldwire"

async function fetchExaLane(lane: WorldwireLane): Promise<WorldwireItem[]> {
  const apiKey = process.env.EXA_API_KEY || process.env.EXA_SEARCH_API_KEY
  if (!apiKey) return []

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(4500),
    headers: {
      "content-type": "application/json",
      "user-agent": "InvertedWorldWorldwire/1.0",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: `${lane.query} latest high consequence source reporting`,
      type: "auto",
      numResults: 8,
      contents: {
        highlights: true,
      },
    }),
  })

  if (!response.ok) return []
  const data = (await response.json()) as {
    results?: Array<{
      id?: string
      title?: string
      url?: string
      author?: string
      publishedDate?: string
      highlights?: string[]
    }>
  }

  return (data.results || [])
    .filter((result) => result.title && result.url)
    .map((result, index) => {
      const url = result.url || ""
      const title = normalizeWorldwireText(result.title || "Untitled source")
      const source = sourceLabel(result.author, url)
      return {
        id: `exa-${lane.id}-${result.id || index}`,
        title,
        url,
        source,
        sectionId: lane.id,
        sectionTitle: lane.title,
        score: scoreWorldwireTitle(title, 118, index, { source, url }),
        publishedAt: result.publishedDate,
        excerpt: result.highlights?.find(Boolean),
      }
    })
}

async function fetchBraveLane(lane: WorldwireLane): Promise<WorldwireItem[]> {
  const token = process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || process.env.BRAVE_SEARCH_KEY
  if (!token) return []

  const url = new URL("https://api.search.brave.com/res/v1/web/search")
  url.searchParams.set("q", `${lane.query} latest`)
  url.searchParams.set("count", "8")
  url.searchParams.set("freshness", "pd")
  url.searchParams.set("safesearch", "moderate")

  const response = await fetch(url, {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(4500),
    headers: {
      accept: "application/json",
      "accept-encoding": "gzip",
      "user-agent": "InvertedWorldWorldwire/1.0",
      "x-subscription-token": token,
    },
  })
  if (!response.ok) return []

  const data = (await response.json()) as {
    web?: {
      results?: Array<{
        title?: string
        url?: string
        description?: string
        age?: string
        profile?: {
          name?: string
        }
      }>
    }
  }

  return (data.web?.results || [])
    .filter((result) => result.title && result.url && isExternalUrl(result.url) && !hostName(result.url || "").includes("google."))
    .map((result, index) => {
      const url = result.url || ""
      const title = normalizeWorldwireText(stripWorldwireTags(result.title || "Untitled source"))
      const source = sourceLabel(result.profile?.name, url)
      return {
        id: `brave-${lane.id}-${index}`,
        title,
        url,
        source,
        sectionId: lane.id,
        sectionTitle: lane.title,
        score: scoreWorldwireTitle(title, 108, index, { source, url }),
        publishedAt: result.age,
        excerpt: result.description ? normalizeWorldwireText(stripWorldwireTags(result.description)) : undefined,
      }
    })
}

async function fetchGoogleLane(lane: WorldwireLane): Promise<WorldwireItem[]> {
  const url = new URL("https://news.google.com/rss/search")
  url.searchParams.set("q", `${lane.query} when:1d`)
  url.searchParams.set("hl", "en-US")
  url.searchParams.set("gl", "US")
  url.searchParams.set("ceid", "US:en")

  const response = await fetch(url, {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(4500),
    headers: {
      "user-agent": "InvertedWorldWorldwire/1.0",
    },
  })
  if (!response.ok) return []

  const xml = await response.text()
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .slice(0, 8)
    .map((match, index) => {
      const item = match[1]
      const title = readWorldwireXmlTag(item, "title")
      const link = decodeWorldwireEntities(readWorldwireXmlTag(item, "link"))
      const source = readWorldwireXmlSource(item)
      const directUrl = source.url && !isGoogleNewsUrl(source.url) ? source.url : link
      return {
        id: `google-${lane.id}-${index}`,
        title,
        url: directUrl || source.url || "https://news.google.com/",
        source: sourceLabel(source.name, directUrl || link),
        sectionId: lane.id,
        sectionTitle: lane.title,
        score: scoreWorldwireTitle(title, 92, index, { source: source.name, url: directUrl }),
        publishedAt: readWorldwireXmlTag(item, "pubDate"),
        excerpt: readWorldwireXmlTag(item, "description"),
      }
    })
    .filter((item) => !isGoogleNewsUrl(item.url))
}

async function fetchLane(lane: WorldwireLane) {
  const exaItems = await fetchExaLane(lane).catch(() => [])
  if (exaItems.length) return exaItems
  const braveItems = await fetchBraveLane(lane).catch(() => [])
  return braveItems.length ? braveItems : fetchGoogleLane(lane).catch(() => [])
}

export async function fetchWorldwireItems(options: { lanes?: WorldwireLane[] } = {}) {
  const lanes = options.lanes?.length ? options.lanes : WORLDWIRE_LANES
  const results = await Promise.allSettled(lanes.map(fetchLane))
  return uniqueWorldwireItems(results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])))
}
