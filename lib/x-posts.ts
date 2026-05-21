import { topics } from "@/data/inverted-world"
import { getTopicXQuery } from "@/lib/x-search"

export type ViralXPost = {
  id: string
  url: string
  text: string
  topicId?: string
  authorName?: string
  username?: string
  createdAt?: string
  source?: "x-api" | "brave-search" | "seed"
  score?: number
  metrics?: {
    likes?: number
    reposts?: number
    replies?: number
    quotes?: number
    views?: number
  }
}

const X_TIMEOUT_MS = 6500
const BRAVE_TIMEOUT_MS = 6500
const configuredMinViralScore = Number(process.env.X_MIN_VIRAL_SCORE || "250")
const MIN_VIRAL_X_SCORE = Number.isFinite(configuredMinViralScore) ? configuredMinViralScore : 250
const MAX_EMBED_AGE_HOURS = 24
const X_EPOCH_MS = 1_288_834_974_657n
const X_STATUS_URL_PATTERN =
  /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/(?!i\/web)([A-Za-z0-9_]{1,20})\/status(?:es)?\/(\d+)/i

const seededTopicPosts: Record<string, ViralXPost[]> = {
  "uap-disclosure": [
    {
      id: "2040507193330438252",
      url: "https://twitter.com/Washington_EY/status/2040507193330438252",
      text: "UAP disclosure signal",
      topicId: "uap-disclosure",
      username: "Washington_EY",
      source: "seed",
    },
    {
      id: "2035940133984162272",
      url: "https://twitter.com/terramysteria/status/2035940133984162272",
      text: "UFO disclosure signal",
      topicId: "uap-disclosure",
      username: "terramysteria",
      source: "seed",
    },
    {
      id: "1924919274352607532",
      url: "https://twitter.com/FCBourbeau/status/1924919274352607532",
      text: "Pentagon UAP signal",
      topicId: "uap-disclosure",
      username: "FCBourbeau",
      source: "seed",
    },
  ],
  "secret-programs": [
    {
      id: "2026090242147594751",
      url: "https://twitter.com/Madres_Comadres/status/2026090242147594751",
      text: "MKULTRA archive signal",
      topicId: "secret-programs",
      username: "Madres_Comadres",
      source: "seed",
    },
    {
      id: "2026167208230183314",
      url: "https://twitter.com/aprajitanefes/status/2026167208230183314",
      text: "CIA declassified signal",
      topicId: "secret-programs",
      username: "aprajitanefes",
      source: "seed",
    },
  ],
  "epstein-networks": [
    {
      id: "2021270437498372455",
      url: "https://twitter.com/Reuters/status/2021270437498372455",
      text: "Epstein files coverage",
      topicId: "epstein-networks",
      username: "Reuters",
      source: "seed",
    },
    {
      id: "1743218364565033337",
      url: "https://twitter.com/AP/status/1743218364565033337",
      text: "Epstein court records coverage",
      topicId: "epstein-networks",
      username: "AP",
      source: "seed",
    },
  ],
  "cryptids-paranormal": [
    {
      id: "1992992072843661646",
      url: "https://twitter.com/officialdwts/status/1992992072843661646",
      text: "Cryptid pop-culture signal",
      topicId: "cryptids-paranormal",
      username: "officialdwts",
      source: "seed",
    },
  ],
  "ai-technocracy": [
    {
      id: "2000696114278043891",
      url: "https://twitter.com/suryavansh138/status/2000696114278043891",
      text: "AI surveillance signal",
      topicId: "ai-technocracy",
      username: "suryavansh138",
      source: "seed",
    },
  ],
  "space-anomalies": [
    {
      id: "1786475097887354957",
      url: "https://twitter.com/NASA/status/1786475097887354957",
      text: "NASA anomaly signal",
      topicId: "space-anomalies",
      username: "NASA",
      source: "seed",
    },
  ],
}

function scorePost(metrics?: {
  like_count?: number
  retweet_count?: number
  reply_count?: number
  quote_count?: number
  impression_count?: number
}) {
  if (!metrics) return 0
  return (
    (metrics.like_count || 0) +
    (metrics.retweet_count || 0) * 2 +
    (metrics.quote_count || 0) * 2 +
    (metrics.reply_count || 0) * 0.5 +
    (metrics.impression_count || 0) * 0.01
  )
}

function seededPostsForTopic(topicId: string) {
  return seededTopicPosts[topicId] || []
}

function getPostTimestamp(post: ViralXPost) {
  if (post.createdAt) {
    const timestamp = new Date(post.createdAt).getTime()
    if (!Number.isNaN(timestamp)) return timestamp
  }

  try {
    if (!/^\d+$/.test(post.id)) return undefined
    return Number((BigInt(post.id) >> 22n) + X_EPOCH_MS)
  } catch {
    return undefined
  }
}

export function isFreshXPost(post: ViralXPost, maxAgeHours = MAX_EMBED_AGE_HOURS) {
  const timestamp = getPostTimestamp(post)
  if (!timestamp) return false
  return Date.now() - timestamp <= maxAgeHours * 60 * 60 * 1000
}

function mergeWithSeededPosts(topicId: string, posts: ViralXPost[], limit: number) {
  const seen = new Set<string>()
  return [...posts, ...seededPostsForTopic(topicId)]
    .map((post) => ({ ...post, topicId: post.topicId || topicId }))
    .filter((post) => isFreshXPost(post))
    .filter((post) => {
      const key = post.id || post.url
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

function cleanSearchText(value?: string) {
  return (value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function extractXStatusUrl(value?: string) {
  const match = value?.match(X_STATUS_URL_PATTERN)
  if (!match) return undefined

  const [, username, id] = match
  return {
    id,
    username,
    url: `https://twitter.com/${username}/status/${id}`,
    createdAt: new Date(Number((BigInt(id) >> 22n) + X_EPOCH_MS)).toISOString(),
  }
}

async function fetchXApiPosts(topicId: string, limit: number) {
  const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || process.env.TWITTER_API_BEARER_TOKEN
  if (!token) return [] satisfies ViralXPost[]

  const topic = topics.find((item) => item.id === topicId)
  if (!topic) return [] satisfies ViralXPost[]

  const url = new URL("https://api.twitter.com/2/tweets/search/recent")
  url.searchParams.set("query", `${getTopicXQuery(topic)} lang:en -is:retweet -is:reply`)
  url.searchParams.set("max_results", "50")
  url.searchParams.set("tweet.fields", "created_at,public_metrics")
  url.searchParams.set("expansions", "author_id")
  url.searchParams.set("user.fields", "name,username")

  const response = await fetch(url, {
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(X_TIMEOUT_MS),
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": "InvertedWorldXSignals/1.0",
    },
  })

  if (!response.ok) return [] satisfies ViralXPost[]

  const data = (await response.json()) as {
    data?: Array<{
      id: string
      text: string
      author_id?: string
      created_at?: string
      public_metrics?: {
        like_count?: number
        retweet_count?: number
        reply_count?: number
        quote_count?: number
        impression_count?: number
      }
    }>
    includes?: {
      users?: Array<{
        id: string
        name?: string
        username?: string
      }>
    }
  }

  const users = new Map((data.includes?.users || []).map((user) => [user.id, user]))

  const ranked = (data.data || [])
    .map((post) => {
      const user = post.author_id ? users.get(post.author_id) : undefined
      const username = user?.username
      const score = scorePost(post.public_metrics)

      return {
        id: post.id,
        url: `https://twitter.com/${username || "i"}/status/${post.id}`,
        text: post.text,
        topicId,
        authorName: user?.name,
        username,
        createdAt: post.created_at,
        source: "x-api",
        score,
        metrics: {
          likes: post.public_metrics?.like_count,
          reposts: post.public_metrics?.retweet_count,
          replies: post.public_metrics?.reply_count,
          quotes: post.public_metrics?.quote_count,
          views: post.public_metrics?.impression_count,
        },
      } satisfies ViralXPost
    })
    .sort((left, right) => (right.score || 0) - (left.score || 0))

  const viral = ranked.filter((post) => (post.score || 0) >= MIN_VIRAL_X_SCORE)
  return (viral.length ? viral : ranked).filter((post) => isFreshXPost(post)).slice(0, limit)
}

async function fetchBraveIndexedXPosts(topicId: string, limit: number) {
  const token = process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || process.env.BRAVE_SEARCH_KEY
  if (!token) return [] satisfies ViralXPost[]

  const topic = topics.find((item) => item.id === topicId)
  if (!topic) return [] satisfies ViralXPost[]

  const queryTerms = getTopicXQuery(topic)
    .replace(/[()"]/g, " ")
    .replace(/\bOR\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const url = new URL("https://api.search.brave.com/res/v1/web/search")
  url.searchParams.set("q", `${queryTerms} viral OR million OR thread site:x.com`)
  url.searchParams.set("count", "20")
  url.searchParams.set("country", "us")
  url.searchParams.set("search_lang", "en")
  url.searchParams.set("safesearch", "moderate")
  url.searchParams.set("text_decorations", "false")

  const response = await fetch(url, {
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(BRAVE_TIMEOUT_MS),
    headers: {
      accept: "application/json",
      "user-agent": "InvertedWorldXSignals/1.0",
      "x-subscription-token": token,
    },
  })

  if (!response.ok) return [] satisfies ViralXPost[]

  const data = (await response.json()) as {
    web?: {
      results?: Array<{
        title?: string
        url?: string
        description?: string
      }>
    }
  }

  const seen = new Set<string>()

  return (data.web?.results || [])
    .map((result) => {
      const status = extractXStatusUrl(result.url)
      if (!status || seen.has(status.id)) return undefined
      seen.add(status.id)

      const title = cleanSearchText(result.title)
      const description = cleanSearchText(result.description)
      const text = title || description || `${topic.title} signal on X`

      return {
        id: status.id,
        url: status.url,
        text,
        topicId,
        username: status.username,
        createdAt: status.createdAt,
        source: "brave-search",
      } satisfies ViralXPost
    })
    .filter((post): post is ViralXPost => Boolean(post))
    .filter((post) => isFreshXPost(post))
    .slice(0, limit)
}

export async function fetchViralXPostsForTopic(topicId: string, options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 12), 24))

  try {
    const xPosts = await fetchXApiPosts(topicId, limit)
    if (xPosts.length) return mergeWithSeededPosts(topicId, xPosts, limit)
  } catch {
    // Fall back to indexed public X posts when the paid X API is absent, limited, or unavailable.
  }

  try {
    const indexedPosts = await fetchBraveIndexedXPosts(topicId, limit)
    return mergeWithSeededPosts(topicId, indexedPosts, limit)
  } catch {
    return mergeWithSeededPosts(topicId, [], limit)
  }
}
