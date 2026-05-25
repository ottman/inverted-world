import {
  WORLDWIRE_LANES,
  decodeWorldwireEntities,
  hostName,
  isExternalUrl,
  looksLikeArticleUrl,
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

const GOOGLE_LANE_QUERIES: Record<string, string> = {
  "front-page": "breaking news live",
  world: "world news crisis",
  war: "war military strike",
  america: "US politics investigation",
  "law-courts": "court ruling trial",
  "power-files": "classified documents leak",
  money: "markets economy fraud",
  "tech-ai": "AI cyberattack surveillance",
  "energy-grid": "energy grid blackout",
  "health-earth": "outbreak disaster weather",
  "science-space": "NASA space discovery",
  "crime-culture": "crime culture scandal",
  "media-internet": "media internet censorship",
  "sports-spectacle": "sports scandal controversy",
  strange: "UFO UAP mystery",
}

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
      numResults: 12,
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
  url.searchParams.set("count", "12")
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

function decodeGoogleNewsArticleUrl(value: string) {
  try {
    const url = new URL(value)
    const encoded = url.pathname.split("/").filter(Boolean).pop()
    if (!encoded) return ""

    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/")
    const decoded = Buffer.from(normalized, "base64").toString("utf8")
    const match = decoded.match(/https?:\/\/[^\s"'<>\\\u0000-\u001F]+/i)
    return match ? decodeWorldwireEntities(match[0]) : ""
  } catch {
    return ""
  }
}

async function fetchGoogleLane(lane: WorldwireLane): Promise<WorldwireItem[]> {
  const url = new URL("https://news.google.com/rss/search")
  url.searchParams.set("q", `${GOOGLE_LANE_QUERIES[lane.id] || lane.title} when:1d`)
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
    .slice(0, 12)
    .map((match, index) => {
      const item = match[1]
      const title = readWorldwireXmlTag(item, "title")
      const link = decodeWorldwireEntities(readWorldwireXmlTag(item, "link"))
      const source = readWorldwireXmlSource(item)
      const decodedUrl = decodeGoogleNewsArticleUrl(link)
      const directUrl = decodedUrl || (link && isExternalUrl(link) ? link : source.url || "")
      return {
        id: `google-${lane.id}-${index}`,
        title,
        url: directUrl || source.url || "https://news.google.com/",
        source: sourceLabel(source.name, decodedUrl || source.url || link),
        sectionId: lane.id,
        sectionTitle: lane.title,
        score: scoreWorldwireTitle(title, 92, index, { source: source.name, url: directUrl }),
        publishedAt: readWorldwireXmlTag(item, "pubDate"),
        excerpt: readWorldwireXmlTag(item, "description"),
      }
    })
    .filter((item) => isExternalUrl(item.url) && looksLikeArticleUrl(item.url))
}

async function fetchLane(lane: WorldwireLane) {
  const results = await Promise.allSettled([fetchExaLane(lane), fetchBraveLane(lane), fetchGoogleLane(lane)])
  return uniqueWorldwireItems(results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])))
    .filter((item) => isExternalUrl(item.url) && looksLikeArticleUrl(item.url))
    .sort((left, right) => right.score - left.score)
}

export async function fetchWorldwireItems(options: { lanes?: WorldwireLane[] } = {}) {
  const lanes = options.lanes?.length ? options.lanes : WORLDWIRE_LANES
  const results = await Promise.allSettled(lanes.map(fetchLane))
  return uniqueWorldwireItems(results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])))
}
