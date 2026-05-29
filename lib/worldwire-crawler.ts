import {
  WORLDWIRE_LANES,
  decodeWorldwireEntities,
  hostName,
  isExternalUrl,
  isUsefulWorldwireTitle,
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
import { SPECTRUM_LANE_FEEDS } from "@/data/news-feeds"

const GOOGLE_LANE_QUERIES: Record<string, string[]> = {
  "front-page": ["breaking news live", "Reuters AP BBC CNN Fox Bloomberg major news"],
  world: ["world news crisis protest election", "Reuters BBC Al Jazeera France 24 DW world"],
  war: ["war military strike missiles drone", "defense intelligence Ukraine Gaza Taiwan Red Sea"],
  america: ["US politics investigation White House Congress", "Trump Biden Congress election corruption"],
  "law-courts": ["court ruling trial indictment judge", "Supreme Court DOJ lawsuit prosecutor"],
  "power-files": ["classified documents leak whistleblower FOIA", "intelligence agency records government files"],
  money: ["markets economy fraud banks inflation", "Wall Street debt layoffs crypto trade"],
  "tech-ai": ["AI cyberattack surveillance chips censorship", "artificial intelligence security data centers"],
  "energy-grid": ["energy grid blackout power oil gas nuclear", "electricity infrastructure data center power demand"],
  "health-earth": ["outbreak disaster weather earthquake volcano", "CDC WHO disease lab climate emergency"],
  "science-space": ["NASA space discovery asteroid telescope", "science physics satellite solar storm"],
  "crime-culture": ["crime scandal celebrity police trial", "culture backlash abuse investigation entertainment"],
  "media-internet": ["media internet censorship platform scandal", "journalism social media creator viral controversy"],
  "sports-spectacle": ["sports scandal controversy gambling injury", "championship fight league investigation"],
  strange: ["UFO UAP unexplained anomaly government records", "mystery archaeology paranormal declassified"],
}

const MIN_GOOGLE_RESULTS_PER_LANE = 18
const GDELT_COOLDOWN_MS = 5_500

const RSS_LANE_FEEDS: Record<string, string[]> = {
  // Independent/alternative outlets (left AND right) are interleaved with mainstream so they
  // score competitively (lane score decreases with feed index) instead of being buried.
  "front-page": [
    "https://feeds.bbci.co.uk/news/rss.xml",
    "https://thepostmillennial.com/feed.xml",
    "https://www.commondreams.org/feeds/news.rss",
    "https://feeds.npr.org/1001/rss.xml",
    "https://www.breitbart.com/feed/",
    "https://jacobin.com/feed/",
    "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    "https://reason.com/feed/",
    "https://www.aljazeera.com/xml/rss/all.xml",
    "https://www.theguardian.com/world/rss",
  ],
  world: [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://thegrayzone.com/feed/",
    "https://www.mintpressnews.com/feed/",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "https://www.theguardian.com/world/rss",
    "https://www.aljazeera.com/xml/rss/all.xml",
    "https://feeds.npr.org/1004/rss.xml",
  ],
  war: [
    "https://www.aljazeera.com/xml/rss/all.xml",
    "https://thegrayzone.com/feed/",
    "https://www.mintpressnews.com/feed/",
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://reason.com/feed/",
    "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
  ],
  america: [
    "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
    "https://thepostmillennial.com/feed.xml",
    "https://www.motherjones.com/feed/",
    "https://www.dailywire.com/feeds/rss.xml",
    "https://www.thenation.com/feed/",
    "https://justthenews.com/rss.xml",
    "https://truthout.org/feed/",
    "https://thefederalist.com/feed/",
    "https://feeds.npr.org/1014/rss.xml",
    "https://www.theguardian.com/us-news/rss",
  ],
  "law-courts": [
    "https://www.scotusblog.com/feed/",
    "https://www.lawfaremedia.org/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
    "https://feeds.npr.org/1014/rss.xml",
    "https://www.theguardian.com/law/rss",
  ],
  "power-files": [
    "https://www.propublica.org/feeds/propublica/main",
    "https://theintercept.com/feed/?lang=en",
    "https://justthenews.com/rss.xml",
    "https://www.mintpressnews.com/feed/",
    "https://www.muckrock.com/news/feed/",
    "https://cms.zerohedge.com/fullrss2.xml",
    "https://www.lawfaremedia.org/rss.xml",
  ],
  money: [
    "https://cms.zerohedge.com/fullrss2.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    "https://jacobin.com/feed/",
    "https://feeds.npr.org/1006/rss.xml",
    "https://www.theguardian.com/business/rss",
    "https://www.marketwatch.com/rss/topstories",
  ],
  "tech-ai": [
    "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    "https://reason.com/feed/",
    "https://www.theverge.com/rss/index.xml",
    "https://techcrunch.com/feed/",
    "https://feeds.arstechnica.com/arstechnica/index",
  ],
  "energy-grid": [
    "https://www.utilitydive.com/feeds/news/",
    "https://www.energy.gov/rss/news.xml",
    "https://www.theguardian.com/environment/energy/rss",
    "https://feeds.bbci.co.uk/news/business/rss.xml",
    "https://www.reutersagency.com/feed/?best-topics=energy&post_type=best",
  ],
  "health-earth": [
    "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml",
    "https://feeds.npr.org/1008/rss.xml",
    "https://feeds.bbci.co.uk/news/health/rss.xml",
    "https://www.theguardian.com/environment/rss",
    "https://www.who.int/rss-feeds/news-english.xml",
  ],
  "science-space": [
    "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
    "https://www.nasa.gov/news-release/feed/",
    "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    "https://www.theguardian.com/science/rss",
    "https://www.space.com/feeds/all",
  ],
  "crime-culture": [
    "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml",
    "https://feeds.npr.org/1008/rss.xml",
    "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
    "https://www.theguardian.com/culture/rss",
    "https://www.rollingstone.com/feed/",
  ],
  "media-internet": [
    "https://www.theguardian.com/media/rss",
    "https://www.theverge.com/rss/index.xml",
    "https://www.niemanlab.org/feed/",
    "https://feeds.arstechnica.com/arstechnica/index",
    "https://techcrunch.com/feed/",
  ],
  "sports-spectacle": [
    "https://feeds.bbci.co.uk/sport/rss.xml",
    "https://www.theguardian.com/sport/rss",
    "https://www.espn.com/espn/rss/news",
    "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml",
    "https://www.cbssports.com/rss/headlines/",
  ],
  strange: [
    "https://www.nasa.gov/news-release/feed/",
    "https://www.space.com/feeds/all",
    "https://www.livescience.com/feeds/all",
    "https://www.smithsonianmag.com/rss/latest_articles/",
    "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  ],
}

const RSS_SHARED_FALLBACK_FEEDS = [
  "https://feeds.bbci.co.uk/news/rss.xml",
  "https://thepostmillennial.com/feed.xml",
  "https://www.commondreams.org/feeds/news.rss",
  "https://feeds.npr.org/1001/rss.xml",
  "https://reason.com/feed/",
  "https://www.theguardian.com/world/rss",
  "https://www.aljazeera.com/xml/rss/all.xml",
]

function laneGoogleQueries(lane: WorldwireLane) {
  return GOOGLE_LANE_QUERIES[lane.id] || [lane.query, lane.title]
}

function readWorldwireXmlTagRaw(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"))
  return match ? match[1] : ""
}

function readWorldwireXmlLink(item: string) {
  const rssLink = readWorldwireXmlTag(item, "link")
  if (rssLink) return rssLink
  return readWorldwireXmlAttr(item, "link", "href")
}

function readWorldwireXmlAttr(item: string, tagPattern: string, attr = "url") {
  const tagMatch = item.match(new RegExp(`<${tagPattern}\\b[^>]*>`, "i"))
  if (!tagMatch) return ""
  const attrMatch = tagMatch[0].match(new RegExp(`${attr}=["']([^"']+)["']`, "i"))
  return attrMatch ? attrMatch[1] : ""
}

function normalizeImageUrl(value?: string) {
  const raw = normalizeWorldwireText(value || "")
  if (!isExternalUrl(raw)) return undefined
  if (/\.svg(?:[?#]|$)/i.test(raw)) return undefined
  return raw
}

function readWorldwireImage(item: string) {
  const media =
    readWorldwireXmlAttr(item, "media:content") ||
    readWorldwireXmlAttr(item, "media:thumbnail") ||
    readWorldwireXmlAttr(item, "enclosure")
  const fromMedia = normalizeImageUrl(media)
  if (fromMedia) return fromMedia

  const rawDescription = readWorldwireXmlTagRaw(item, "description")
  const imgMatch = rawDescription.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)
  return normalizeImageUrl(imgMatch?.[1])
}

function feedItems(xml: string) {
  const rssItems = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1])
  if (rssItems.length) return rssItems
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => match[1])
}

function cleanNewsTitle(title: string, source?: string) {
  let cleaned = normalizeWorldwireText(title)
  const sourceText = normalizeWorldwireText(source || "")
  const candidates = [sourceText, sourceText.replace(/^the\s+/i, "")].filter((value) => value.length > 2)
  for (const candidate of candidates) {
    cleaned = cleaned.replace(new RegExp(`\\s[-|]\\s${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "")
  }
  return cleaned.trim()
}

function gdeltDate(value?: string) {
  const raw = String(value || "").trim()
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})?Z?$/)
  if (!match) return raw || undefined
  const [, year, month, day, hour, minute, second = "00"] = match
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
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
      image?: string
    }>
  }

  return (data.results || [])
    .filter((result) => result.title && result.url)
    .map((result, index) => {
      const url = result.url || ""
      const source = sourceLabel(undefined, url)
      const title = cleanNewsTitle(result.title || "Untitled source", source)
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
        imageUrl: normalizeImageUrl(result.image),
      }
    })
    .filter((item) => isUsefulWorldwireTitle(item.title))
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
        thumbnail?: {
          src?: string
          original?: string
        }
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
      const source = sourceLabel(result.profile?.name, url)
      const title = cleanNewsTitle(stripWorldwireTags(result.title || "Untitled source"), source)
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
        imageUrl: normalizeImageUrl(result.thumbnail?.src || result.thumbnail?.original),
      }
    })
    .filter((item) => isUsefulWorldwireTitle(item.title))
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

async function fetchGoogleLaneQuery(lane: WorldwireLane, query: string, queryIndex: number): Promise<WorldwireItem[]> {
  const url = new URL("https://news.google.com/rss/search")
  url.searchParams.set("q", `${query} when:1d`)
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
    .slice(0, MIN_GOOGLE_RESULTS_PER_LANE)
    .map((match, index) => {
      const item = match[1]
      const rawTitle = readWorldwireXmlTag(item, "title")
      const link = decodeWorldwireEntities(readWorldwireXmlTag(item, "link"))
      const source = readWorldwireXmlSource(item)
      const decodedUrl = decodeGoogleNewsArticleUrl(link)
      const directUrl = decodedUrl && looksLikeArticleUrl(decodedUrl) ? decodedUrl : ""
      const outlet = sourceLabel(source.name, directUrl || source.url || link)
      const title = cleanNewsTitle(rawTitle, outlet)
      return {
        id: `google-${lane.id}-${queryIndex}-${index}`,
        title,
        url: directUrl,
        source: outlet,
        sectionId: lane.id,
        sectionTitle: lane.title,
        score: scoreWorldwireTitle(title, 92 - queryIndex * 4, index, { source: source.name, url: directUrl }),
        publishedAt: readWorldwireXmlTag(item, "pubDate"),
        excerpt: readWorldwireXmlTag(item, "description"),
        imageUrl: readWorldwireImage(item),
      }
    })
    .filter((item) => isExternalUrl(item.url) && looksLikeArticleUrl(item.url) && isUsefulWorldwireTitle(item.title))
}

async function fetchGoogleLane(lane: WorldwireLane): Promise<WorldwireItem[]> {
  const results = await Promise.allSettled(laneGoogleQueries(lane).map((query, index) => fetchGoogleLaneQuery(lane, query, index)))
  return uniqueWorldwireItems(results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])))
}

async function fetchRssFeedLane(lane: WorldwireLane, feedUrl: string, feedIndex: number): Promise<WorldwireItem[]> {
  const response = await fetch(feedUrl, {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(6000),
    headers: {
      "user-agent": "InvertedWorldWorldwire/1.0",
    },
  })
  if (!response.ok) return []

  const xml = await response.text()
  return feedItems(xml)
    .slice(0, 16)
    .map((item, index) => {
      const url = decodeWorldwireEntities(readWorldwireXmlLink(item))
      const source = sourceLabel(undefined, url || feedUrl)
      const title = cleanNewsTitle(readWorldwireXmlTag(item, "title"), source)
      return {
        id: `rss-${lane.id}-${feedIndex}-${index}`,
        title,
        url,
        source,
        sectionId: lane.id,
        sectionTitle: lane.title,
        // Cap the feed-order penalty: with a large lane feed list, late feeds must still compete
        // (the per-source cap, not feed order, prevents any one outlet from dominating).
        score: scoreWorldwireTitle(title, 76 - Math.min(feedIndex, 10) * 2, index, { source, url }),
        publishedAt: readWorldwireXmlTag(item, "pubDate") || readWorldwireXmlTag(item, "updated") || readWorldwireXmlTag(item, "published"),
        excerpt: readWorldwireXmlTag(item, "description") || readWorldwireXmlTag(item, "summary"),
        imageUrl: readWorldwireImage(item),
      }
    })
    .filter((item) => isExternalUrl(item.url) && looksLikeArticleUrl(item.url) && isUsefulWorldwireTitle(item.title))
}

// Effective feeds for a lane = the curated lane feeds PLUS the large balanced spectrum registry
// mapped to this lane (data/news-feeds.ts). This is what gives /news a wide pool of outlets
// across the political spectrum instead of a handful of mainstream feeds.
function laneFeeds(laneId: string) {
  const base = RSS_LANE_FEEDS[laneId] || RSS_LANE_FEEDS["front-page"] || []
  const registry = SPECTRUM_LANE_FEEDS[laneId] || []
  const seen = new Set<string>()
  return [...base, ...registry].filter((url) => (seen.has(url) ? false : (seen.add(url), true)))
}

async function fetchRssLane(lane: WorldwireLane): Promise<WorldwireItem[]> {
  const feeds = laneFeeds(lane.id)
  const results = await Promise.allSettled(feeds.map((feedUrl, index) => fetchRssFeedLane(lane, feedUrl, index)))
  const laneItems = uniqueWorldwireItems(results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])))
  if (laneItems.length >= 5) return laneItems

  const fallbackFeeds = RSS_SHARED_FALLBACK_FEEDS.filter((feedUrl) => !feeds.includes(feedUrl))
  const fallbackResults = await Promise.allSettled(
    fallbackFeeds.map((feedUrl, index) => fetchRssFeedLane(lane, feedUrl, feeds.length + index)),
  )
  return uniqueWorldwireItems([...laneItems, ...fallbackResults.flatMap((result) => (result.status === "fulfilled" ? result.value : []))])
}

async function fetchGdeltLane(lane: WorldwireLane): Promise<WorldwireItem[]> {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc")
  url.searchParams.set("query", `${lane.query} sourcelang:english`)
  url.searchParams.set("mode", "ArtList")
  url.searchParams.set("format", "json")
  url.searchParams.set("sort", "hybridrel")
  url.searchParams.set("maxrecords", "25")
  url.searchParams.set("timespan", "1d")

  const response = await fetch(url, {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(8000),
    headers: {
      "user-agent": "InvertedWorldWorldwire/1.0",
    },
  })
  if (!response.ok) return []

  const data = (await response.json()) as {
    articles?: Array<{
      title?: string
      url?: string
      sourceCommonName?: string
      domain?: string
      seendate?: string
      socialimage?: string
    }>
  }

  return (data.articles || [])
    .filter((article) => article.title && article.url && isExternalUrl(article.url))
    .map((article, index) => {
      const url = article.url || ""
      const source = sourceLabel(article.sourceCommonName || article.domain, url)
      const title = cleanNewsTitle(article.title || "Untitled source", source)
      return {
        id: `gdelt-${lane.id}-${index}`,
        title,
        url,
        source,
        sectionId: lane.id,
        sectionTitle: lane.title,
        score: scoreWorldwireTitle(title, 84, index, { source, url }),
        publishedAt: gdeltDate(article.seendate),
        imageUrl: normalizeImageUrl(article.socialimage),
      }
    })
    .filter((item) => isExternalUrl(item.url) && looksLikeArticleUrl(item.url) && isUsefulWorldwireTitle(item.title))
}

// Breadth over volume: keep at most this many items per source so the wire shows a wide variety
// of outlets across the spectrum instead of being dominated by one or two high-volume mainstream
// feeds (e.g. the Guardian, which appears in nearly every lane). Pure selection, not bias scoring.
const WORLDWIRE_MAX_PER_SOURCE = Math.max(1, Math.min(Math.trunc(Number(process.env.WORLDWIRE_MAX_PER_SOURCE)) || 2, 8))

function worldwireSourceKey(item: WorldwireItem) {
  const label = (item.source || "").trim().toLowerCase()
  if (label) return label
  try {
    return new URL(item.url).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return item.url.toLowerCase()
  }
}

// Input MUST be pre-sorted by score (best first); keeps the top `max` items per source.
function capItemsPerSource(items: WorldwireItem[], max = WORLDWIRE_MAX_PER_SOURCE) {
  const counts = new Map<string, number>()
  const kept: WorldwireItem[] = []
  for (const item of items) {
    const key = worldwireSourceKey(item)
    const used = counts.get(key) || 0
    if (used >= max) continue
    counts.set(key, used + 1)
    kept.push(item)
  }
  return kept
}

// newsapi.ai / Event Registry: the primary breadth source — ~30k+ publishers worldwide via one
// query per lane, returning a hugely diverse pool of outlets. Enabled when NEWSAPI_AI_KEY is set.
const NEWSAPI_AI_ENDPOINT = "https://eventregistry.org/api/v1/article/getArticles"

type NewsApiAiArticle = {
  title?: string
  url?: string
  dateTime?: string
  image?: string
  source?: { title?: string; uri?: string }
}

// Event Registry needs a keyword ARRAY with keywordOper:"or" — a multi-word string is treated as
// an exact phrase (returns ~nothing). Convert the lane's Google-style query into OR keywords.
function newsApiKeywords(lane: WorldwireLane): string[] {
  const terms = `${lane.query || ""} ${lane.title || ""}`
    .replace(/\b(?:OR|AND)\b/gi, " ")
    .replace(/["'()]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2)
  return Array.from(new Set(terms)).slice(0, 8)
}

async function fetchNewsApiAiLane(lane: WorldwireLane): Promise<WorldwireItem[]> {
  const apiKey = process.env.NEWSAPI_AI_KEY
  if (!apiKey) return []
  const keywords = newsApiKeywords(lane)
  if (!keywords.length) return []
  const response = await fetch(NEWSAPI_AI_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "getArticles",
      keyword: keywords,
      keywordOper: "or",
      lang: "eng",
      articlesSortBy: "date",
      articlesCount: 50,
      articlesPage: 1,
      resultType: "articles",
      dataType: ["news"],
      isDuplicateFilter: "skipDuplicates",
      articleBodyLen: 0,
      apiKey,
    }),
    signal: AbortSignal.timeout(9000),
    next: { revalidate: 600 },
  })
  if (!response.ok) return []
  const data = (await response.json()) as { articles?: { results?: NewsApiAiArticle[] } }
  return (data.articles?.results || [])
    .map((article, index) => {
      const url = article.url || ""
      const source = sourceLabel(article.source?.title || article.source?.uri, url)
      const title = cleanNewsTitle(article.title || "Untitled source", source)
      return {
        id: `newsapi-${lane.id}-${index}`,
        title,
        url,
        source,
        sectionId: lane.id,
        sectionTitle: lane.title,
        score: scoreWorldwireTitle(title, 80, index, { source, url }),
        publishedAt: article.dateTime,
        imageUrl: normalizeImageUrl(article.image),
      }
    })
    .filter((item) => isExternalUrl(item.url) && looksLikeArticleUrl(item.url) && isUsefulWorldwireTitle(item.title))
}

async function fetchLaneBase(lane: WorldwireLane) {
  const results = await Promise.allSettled([
    fetchNewsApiAiLane(lane),
    fetchExaLane(lane),
    fetchBraveLane(lane),
    fetchGoogleLane(lane),
    fetchRssLane(lane),
  ])
  return capItemsPerSource(
    uniqueWorldwireItems(results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])))
      .filter((item) => isExternalUrl(item.url) && looksLikeArticleUrl(item.url) && isUsefulWorldwireTitle(item.title))
      .sort((left, right) => right.score - left.score),
  )
}

export async function fetchWorldwireItems(options: { lanes?: WorldwireLane[] } = {}) {
  const lanes = options.lanes?.length ? options.lanes : WORLDWIRE_LANES
  const baseResults = await Promise.allSettled(lanes.map(fetchLaneBase))
  const byLane = new Map<string, WorldwireItem[]>()

  lanes.forEach((lane, index) => {
    const result = baseResults[index]
    byLane.set(lane.id, result?.status === "fulfilled" ? result.value : [])
  })

  // GDELT is a primary breadth source: it surfaces articles from ~60k outlets across the
  // spectrum, so pull it for EVERY lane (not just sparse ones) and enable it by default.
  // Set WORLDWIRE_USE_GDELT=0 to disable. Failures are harmless (fetchGdeltLane returns []).
  const gdeltEnabled = process.env.WORLDWIRE_USE_GDELT !== "0"
  let lastGdeltAt = 0
  for (const lane of lanes) {
    if (!gdeltEnabled) break
    const current = byLane.get(lane.id) || []

    const elapsed = Date.now() - lastGdeltAt
    if (lastGdeltAt && elapsed < GDELT_COOLDOWN_MS) {
      await new Promise((resolve) => setTimeout(resolve, GDELT_COOLDOWN_MS - elapsed))
    }
    lastGdeltAt = Date.now()

    const gdeltItems = await fetchGdeltLane(lane).catch(() => [])
    byLane.set(
      lane.id,
      capItemsPerSource(
        uniqueWorldwireItems([...current, ...gdeltItems])
          .filter((item) => isExternalUrl(item.url) && looksLikeArticleUrl(item.url) && isUsefulWorldwireTitle(item.title))
          .sort((left, right) => right.score - left.score),
      ),
    )
  }

  return uniqueWorldwireItems(Array.from(byLane.values()).flat())
}
