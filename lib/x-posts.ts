import { topics } from "@/data/inverted-world"
import { fetchRecursivXSignalsForTopic } from "@/lib/recursiv/content"
import { getTopicXQueries } from "@/lib/x-search"

export type ViralXPost = {
  id: string
  url: string
  text: string
  topicId?: string
  authorName?: string
  username?: string
  createdAt?: string
  source?: "x-api" | "brave-search" | "x-syndication" | "seed"
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
const X_SYNDICATION_TIMEOUT_MS = 6500
const configuredMinViralScore = process.env.X_MIN_VIRAL_SCORE ? Number(process.env.X_MIN_VIRAL_SCORE) : undefined
export const X_FRESHNESS_WINDOW_HOURS = 24 * 7
const X_EPOCH_MS = BigInt(1_288_834_974_657)
const X_SNOWFLAKE_SHIFT_BITS = BigInt(22)
const PRIORITY_X_ACCOUNTS = ["Timcast", "TimcastNews", "ShaneCashman", "InvertedTales"] as const
const DEFAULT_TOPIC_QUERY_PACK_LIMIT = 2
const TOPIC_X_SCORE_FLOORS: Record<string, number> = {
  "uap-disclosure": 250,
  "secret-programs": 140,
  "epstein-networks": 160,
  "cryptids-paranormal": 60,
  "ai-technocracy": 140,
  "space-anomalies": 110,
}
const TOPIC_CORE_TERMS: Record<string, string[]> = {
  "uap-disclosure": ["uap", "ufo", "aaro", "disclosure", "grusch", "crash retrieval", "non-human intelligence"],
  "secret-programs": ["mkultra", "cia", "foia", "declassified", "classified program", "black budget", "psyop"],
  "epstein-networks": ["epstein", "maxwell", "client list", "flight logs", "sealed documents", "court records"],
  "cryptids-paranormal": [
    "bigfoot",
    "sasquatch",
    "cryptid",
    "mothman",
    "dogman",
    "skinwalker",
    "ghost sighting",
    "ghost video",
    "paranormal investigation",
    "poltergeist",
    "missing 411",
    "remote viewing",
  ],
  "ai-technocracy": ["ai surveillance", "palantir", "digital id", "facial recognition", "predictive policing", "deepfake", "autonomous weapons"],
  "space-anomalies": [
    "space anomaly",
    "mars anomaly",
    "moon anomaly",
    "meteor",
    "asteroid",
    "solar storm",
    "solar flare",
    "geomagnetic storm",
    "space weather",
    "bolide",
    "interstellar object",
  ],
}
const TOPIC_EXCLUDED_TERMS: Record<string, string[]> = {
  "cryptids-paranormal": ["nsfw", "onlyfans", "freeuse", "panties", "booktok", "urban fantasy", "paranormal romance"],
  "space-anomalies": ["bruno mars", "mars bar", "mars inc", "$fly", "meme coin", "memecoin", "ca :", "mc :", "pump", "to mars"],
}
const GLOBAL_EXCLUDED_TERMS = ["porn", "tits", "escort", "giveaway", "airdrop"]
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

function queryPackLimit() {
  const configured = Number(process.env.X_TOPIC_QUERY_PACK_LIMIT || "")
  if (Number.isFinite(configured) && configured > 0) return Math.min(Math.trunc(configured), 8)
  return DEFAULT_TOPIC_QUERY_PACK_LIMIT
}

function minViralScoreForTopic(topicId: string) {
  if (typeof configuredMinViralScore === "number" && Number.isFinite(configuredMinViralScore)) {
    return configuredMinViralScore
  }

  return TOPIC_X_SCORE_FLOORS[topicId] ?? 140
}

function containsAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term))
}

function hasCoreTopicTerm(topicId: string, text: string) {
  return containsAnyTerm(text, TOPIC_CORE_TERMS[topicId] || [])
}

function rejectsTopicText(topicId: string, text?: string) {
  const normalized = (text || "").toLowerCase()
  if (!normalized) return false
  return containsAnyTerm(normalized, GLOBAL_EXCLUDED_TERMS) || containsAnyTerm(normalized, TOPIC_EXCLUDED_TERMS[topicId] || [])
}

function isQualityTopicPost(topicId: string, post: ViralXPost) {
  const normalized = post.text.toLowerCase()
  if (rejectsTopicText(topicId, normalized)) return false
  if (hasCoreTopicTerm(topicId, normalized)) return true
  return (post.score || 0) >= minViralScoreForTopic(topicId)
}

function getPostTimestamp(post: ViralXPost) {
  if (post.createdAt) {
    const timestamp = new Date(post.createdAt).getTime()
    if (!Number.isNaN(timestamp)) return timestamp
  }

  try {
    if (!/^\d+$/.test(post.id)) return undefined
    return Number((BigInt(post.id) >> X_SNOWFLAKE_SHIFT_BITS) + X_EPOCH_MS)
  } catch {
    return undefined
  }
}

export function isFreshXPost(post: ViralXPost, maxAgeHours = X_FRESHNESS_WINDOW_HOURS) {
  const timestamp = getPostTimestamp(post)
  if (!timestamp) return false
  return Date.now() - timestamp <= maxAgeHours * 60 * 60 * 1000
}

function mergeWithSeededPosts(topicId: string, posts: ViralXPost[], limit: number) {
  const seen = new Set<string>()
  return [...posts, ...seededPostsForTopic(topicId)]
    .map((post) => ({ ...post, topicId: post.topicId || topicId }))
    .filter((post) => isFreshXPost(post))
    .filter((post) => isQualityTopicPost(topicId, post))
    .filter((post) => {
      const key = post.id || post.url
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

function dedupePosts(posts: ViralXPost[]) {
  const seen = new Set<string>()
  return posts.filter((post) => {
    const key = post.id || post.url
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
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
    createdAt: new Date(Number((BigInt(id) >> X_SNOWFLAKE_SHIFT_BITS) + X_EPOCH_MS)).toISOString(),
  }
}

function topicTerms(topicId: string) {
  const topic = topics.find((item) => item.id === topicId)
  if (!topic) return []

  return `${getTopicXQueries(topic).join(" ")} ${topic.title} ${topic.signal}`
    .replace(/[()"]/g, " ")
    .replace(/\bOR\b/gi, " ")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term === "ai" || term.length > 2)
}

function matchesTopicText(topicId: string, text?: string) {
  const normalized = (text || "").toLowerCase()
  if (!normalized) return false
  const terms = topicTerms(topicId)
  return terms.some((term) => normalized.includes(term))
}

async function fetchXApiSearch(query: string, topicId: string, token: string) {
  const url = new URL("https://api.twitter.com/2/tweets/search/recent")
  url.searchParams.set("query", query)
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

  return (data.data || []).map((post) => {
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
}

async function fetchXApiPosts(topicId: string, limit: number) {
  const token =
    process.env.X_BEARER_TOKEN ||
    process.env.X_API_BEARER_TOKEN ||
    process.env.TWITTER_BEARER_TOKEN ||
    process.env.TWITTER_API_BEARER_TOKEN
  if (!token) return [] satisfies ViralXPost[]

  const topic = topics.find((item) => item.id === topicId)
  if (!topic) return [] satisfies ViralXPost[]

  const topicQueries = getTopicXQueries(topic).slice(0, queryPackLimit())
  const priorityAccountQuery = PRIORITY_X_ACCOUNTS.map((account) => `from:${account}`).join(" OR ")
  const topicPostSets = await Promise.all(
    topicQueries.map((query) => fetchXApiSearch(`${query} lang:en -is:retweet -is:reply`, topicId, token)),
  )
  const priorityPostSets = await Promise.all(
    topicQueries.slice(0, 2).map((query) => {
      const priorityQuery = `(${priorityAccountQuery}) ${query} lang:en -is:retweet -is:reply`
      return fetchXApiSearch(priorityQuery, topicId, token)
    }),
  )

  const ranked = dedupePosts([
    ...priorityPostSets.flat().map((post) => ({ ...post, score: (post.score || 0) + 500 })),
    ...topicPostSets.flat(),
  ]).sort((left, right) => (right.score || 0) - (left.score || 0))

  const viral = ranked.filter((post) => (post.score || 0) >= minViralScoreForTopic(topicId))
  return (viral.length ? viral : ranked)
    .filter((post) => isFreshXPost(post))
    .filter((post) => isQualityTopicPost(topicId, post))
    .slice(0, limit)
}

async function fetchBraveSearchResults(query: string) {
  const token = process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || process.env.BRAVE_SEARCH_KEY
  if (!token) return []

  const url = new URL("https://api.search.brave.com/res/v1/web/search")
  url.searchParams.set("q", query)
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

  if (!response.ok) return []

  const data = (await response.json()) as {
    web?: {
      results?: Array<{
        title?: string
        url?: string
        description?: string
      }>
    }
  }

  return data.web?.results || []
}

async function fetchBraveIndexedXPosts(topicId: string, limit: number) {
  const token = process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY || process.env.BRAVE_SEARCH_KEY
  if (!token) return [] satisfies ViralXPost[]

  const topic = topics.find((item) => item.id === topicId)
  if (!topic) return [] satisfies ViralXPost[]

  const queryTerms = getTopicXQueries(topic)
    .slice(0, queryPackLimit() + 1)
    .map((query) =>
      query
        .replace(/[()"]/g, " ")
        .replace(/\bOR\b/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )

  const results = await Promise.all([
    ...queryTerms.map((query) => fetchBraveSearchResults(`${query} viral OR million OR thread site:x.com`)),
    ...queryTerms.slice(0, 2).map((query) => fetchBraveSearchResults(`${query} site:x.com/ShaneCashman`)),
  ])

  const seen = new Set<string>()

  return results
    .flat()
    .map((result): ViralXPost | undefined => {
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
      }
    })
    .filter((post): post is ViralXPost => Boolean(post))
    .filter((post) => isFreshXPost(post))
    .slice(0, limit)
}

async function fetchSyndicatedPriorityPosts(topicId: string, limit: number) {
  const posts = await Promise.all(
    PRIORITY_X_ACCOUNTS.map(async (account) => {
      const response = await fetch(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${account}`, {
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(X_SYNDICATION_TIMEOUT_MS),
        headers: {
          "user-agent": "Mozilla/5.0 InvertedWorldXSignals/1.0",
        },
      })

      if (!response.ok) return [] satisfies ViralXPost[]

      const html = await response.text()
      const marker = '<script id="__NEXT_DATA__" type="application/json">'
      const start = html.indexOf(marker)
      const end = start >= 0 ? html.indexOf("</script>", start) : -1
      if (start < 0 || end < 0) return [] satisfies ViralXPost[]

      const data = JSON.parse(html.slice(start + marker.length, end)) as {
        props?: {
          pageProps?: {
            timeline?: {
              entries?: Array<{
                type?: string
                entry_id?: string
                content?: {
                  tweet?: {
                    id_str?: string
                    conversation_id_str?: string
                    created_at?: string
                    full_text?: string
                    text?: string
                    favorite_count?: number
                    retweet_count?: number
                    reply_count?: number
                    quote_count?: number
                  }
                }
              }>
            }
          }
        }
      }

      return (data.props?.pageProps?.timeline?.entries || [])
        .filter((entry) => entry.type === "tweet")
        .map((entry): ViralXPost | undefined => {
          const tweet = entry.content?.tweet
          const id = tweet?.id_str || tweet?.conversation_id_str || entry.entry_id?.replace(/^tweet-/, "")
          const text = cleanSearchText(tweet?.full_text || tweet?.text)
          const createdAt = tweet?.created_at ? new Date(tweet.created_at).toISOString() : undefined
          if (!id || !text || !matchesTopicText(topicId, text)) return undefined

          const score =
            (tweet?.favorite_count || 0) +
            (tweet?.retweet_count || 0) * 2 +
            (tweet?.quote_count || 0) * 2 +
            (tweet?.reply_count || 0) * 0.5 +
            500

          return {
            id,
            url: `https://twitter.com/${account}/status/${id}`,
            text,
            topicId,
            username: account,
            createdAt,
            source: "x-syndication",
            score,
            metrics: {
              likes: tweet?.favorite_count,
              reposts: tweet?.retweet_count,
              replies: tweet?.reply_count,
              quotes: tweet?.quote_count,
            },
          }
        })
        .filter((post): post is ViralXPost => Boolean(post))
    }),
  )

  return dedupePosts(posts.flat())
    .filter((post) => isFreshXPost(post))
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, limit)
}

export async function fetchViralXPostsForTopic(topicId: string, options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 12), 24))
  const recursivPosts = await fetchRecursivXSignalsForTopic(topicId, { limit })
  if (recursivPosts?.length) return mergeWithSeededPosts(topicId, recursivPosts, limit)

  try {
    const xPosts = await fetchXApiPosts(topicId, limit)
    if (xPosts.length) return mergeWithSeededPosts(topicId, xPosts, limit)
  } catch {
    // Fall back to indexed public X posts when the paid X API is absent, limited, or unavailable.
  }

  try {
    const indexedPosts = await fetchBraveIndexedXPosts(topicId, limit)
    if (indexedPosts.length) return mergeWithSeededPosts(topicId, indexedPosts, limit)
  } catch {
    // Public embed fallback below keeps Shane Cashman visible when no search API is configured.
  }

  try {
    const syndicatedPosts = await fetchSyndicatedPriorityPosts(topicId, limit)
    return mergeWithSeededPosts(topicId, syndicatedPosts, limit)
  } catch {
    return mergeWithSeededPosts(topicId, [], limit)
  }
}
