import { topics } from "@/data/inverted-world"
import { fetchRecursivXSignalsByTopic, fetchRecursivXSignalsForTopic } from "@/lib/recursiv/content"
import { allowProviderFallbacks, type ProviderFallbackOptions } from "@/lib/provider-fallbacks"
import { getTopicXQueries } from "@/lib/x-search"

export type ViralXPost = {
  id: string
  url: string
  text: string
  topicId?: string
  authorName?: string
  username?: string
  createdAt?: string
  source?: "x-api" | "brave-search" | "exa-search" | "x-syndication" | "x-profile-reader" | "seed"
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
const EXA_X_TIMEOUT_MS = 9000
const X_SYNDICATION_TIMEOUT_MS = 6500
const JINA_X_PROFILE_TIMEOUT_MS = 9000
const DEFAULT_PROFILE_READER_ACCOUNT_LIMIT = 4
const configuredMinViralScore = process.env.X_MIN_VIRAL_SCORE ? Number(process.env.X_MIN_VIRAL_SCORE) : undefined
export const X_FRESHNESS_WINDOW_HOURS = 24 * 7
const X_EPOCH_MS = BigInt(1_288_834_974_657)
const X_SNOWFLAKE_SHIFT_BITS = BigInt(22)
const PRIORITY_X_ACCOUNTS = ["Timcast", "TimcastNews", "TimcastIRL", "ShaneCashman", "InvertedTales"] as const
const PRIORITY_X_ACCOUNT_SET = new Set(PRIORITY_X_ACCOUNTS.map((account) => account.toLowerCase()))
const TOPIC_PROFILE_READER_ACCOUNT_LIMITS: Record<string, number> = {
  "secret-programs": 8,
  "epstein-networks": 8,
  "cryptids-paranormal": 8,
  "ai-technocracy": 8,
  "space-anomalies": 8,
}
// Independent / alternative media voices, balanced left AND right, are added per-topic below so
// the X signal isn't only mainstream + official accounts. Curated starting set (incl. the Alex
// Jones network, which has no working RSS): right-independent (RealAlexJones, infowars,
// TPostMillennial, JackPosobiec, disclosetv, esaagar), left-independent (jimmy_dore, KyleKulinski,
// aaronjmate, MaxBlumenthal, caitoz, krystalball), heterodox (mtaibbi, ggreenwald, mtracey, lhfang,
// shellenbergermd). Expandable from @Timcast's following via scripts/seed-x-accounts-from-following.mjs.
const TOPIC_SOURCE_X_ACCOUNTS: Record<string, string[]> = {
  "uap-disclosure": ["InvertedTales", "ShaneCashman", "ChrisKMellon", "uncertainvector", "Debriefmedia", "mufon", "disclosetv", "RealAlexJones", "shellenbergermd"],
  "secret-programs": [
    "NSArchive",
    "MuckRock",
    "FBIRecordsVault",
    "CIA",
    "NSAGov",
    "TheBlackVaultcom",
    "TimcastNews",
    "ShaneCashman",
    "Snowden",
    "wikileaks",
    "JasonLeopold",
    "kenklippenstein",
    "FBI",
    "ODNIgov",
    "DARPA",
    // independent / heterodox
    "mtaibbi",
    "ggreenwald",
    "lhfang",
    "mtracey",
    "RealAlexJones",
    "infowars",
    "aaronjmate",
    "MaxBlumenthal",
  ],
  "epstein-networks": [
    "ShaneCashman",
    "TimcastNews",
    "julie_k_brown",
    "MiamiHerald",
    "SDNYnews",
    "TheJusticeDept",
    "KlasfeldReports",
    "innercitypress",
    "lawcrimenews",
    "CourthouseNews",
    "ICIJorg",
    "OCCRP",
    "propublica",
    "AP",
    "Reuters",
    // independent (both sides cover Epstein heavily)
    "RealAlexJones",
    "infowars",
    "TPostMillennial",
    "JackPosobiec",
    "disclosetv",
    "mtaibbi",
    "ggreenwald",
    "krystalball",
    "esaagar",
  ],
  "cryptids-paranormal": ["InvertedTales", "ShaneCashman", "mufon", "ForteanTimes", "infowars"],
  "ai-technocracy": ["TimcastNews", "ShaneCashman", "404mediaco", "TechCrunch", "EFF", "PalantirTech", "shellenbergermd", "lhfang", "TPostMillennial", "ggreenwald", "caitoz"],
  "space-anomalies": ["NASA", "NASASun", "NWSSWPC", "esaoperations", "AsteroidWatch", "MarsCuriosity"],
}
const TOPIC_SOURCE_X_ACCOUNT_SETS = Object.fromEntries(
  Object.entries(TOPIC_SOURCE_X_ACCOUNTS).map(([topicId, accounts]) => [
    topicId,
    new Set(accounts.map((account) => account.toLowerCase())),
  ]),
)
const TOPIC_SOURCE_ACCOUNT_SCORE_BONUS = 175
const DEFAULT_TOPIC_QUERY_PACK_LIMIT = 6
const TOPIC_X_SCORE_FLOORS: Record<string, number> = {
  "uap-disclosure": 250,
  "secret-programs": 140,
  "epstein-networks": 160,
  "cryptids-paranormal": 60,
  "ai-technocracy": 140,
  "space-anomalies": 110,
}
const TOPIC_CORE_TERM_SCORE_FLOORS: Record<string, number> = {
  "uap-disclosure": 35,
  "secret-programs": 35,
  "epstein-networks": 35,
  "cryptids-paranormal": 25,
  "ai-technocracy": 35,
  "space-anomalies": 30,
}
const TOPIC_CORE_TERMS: Record<string, string[]> = {
  "uap-disclosure": ["uap", "ufo", "aaro", "disclosure", "grusch", "crash retrieval", "non-human intelligence"],
  "secret-programs": [
    "mkultra",
    "cia",
    "foia",
    "classified",
    "declassified",
    "declassified documents",
    "classified program",
    "black budget",
    "secret program",
    "intelligence community",
    "surveillance",
    "coverup",
    "cover-up",
    "psyop",
    "snowden",
    "assange",
    "darpa",
    "nsa",
    "odni",
  ],
  "epstein-networks": [
    "epstein",
    "maxwell",
    "client list",
    "flight logs",
    "sealed documents",
    "unsealed documents",
    "court records",
    "blackmail network",
    "elite network",
    "institutional corruption",
    "dark money",
    "donor class",
    "lobbying",
    "trafficking",
    "billionaire",
  ],
  "cryptids-paranormal": [
    "bigfoot",
    "sasquatch",
    "cryptid",
    "mothman",
    "dogman",
    "skinwalker",
    "pterodactyl",
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
const TOPIC_TRUSTED_SOURCE_TERMS: Record<string, string[]> = {
  "uap-disclosure": ["pentagon", "deptofwar", "uap files", "uap videos", "ufo files", "aaro", "mufon"],
  "secret-programs": [
    "mkultra",
    "cia files",
    "declassified records",
    "declassified documents",
    "foia",
    "fbi vault",
    "cia reading room",
    "black budget",
    "public records",
    "whistleblower",
    "documents",
  ],
  "epstein-networks": [
    "epstein",
    "maxwell",
    "ghislaine",
    "client list",
    "flight logs",
    "sealed documents",
    "unsealed documents",
    "prince andrew",
    "giuffre",
    "jpmorgan epstein",
    "elite access",
    "power network",
    "elite capture",
    "wef",
    "davos",
    "bilderberg",
    "blackrock",
    "vanguard",
  ],
  "cryptids-paranormal": ["pterodactyl", "cryptid", "bigfoot", "sasquatch", "mufon", "fortean", "high strangeness"],
  "ai-technocracy": ["ai", "privacy", "personal data", "surveillance", "robot", "autonomous", "palantir", "deepfake", "data center"],
  "space-anomalies": ["nasa", "mars", "moon", "psyche", "asteroid", "solar", "space weather", "venus", "artemis", "space station", "swpc"],
}
const TOPIC_EXCLUDED_TERMS: Record<string, string[]> = {
  "cryptids-paranormal": ["nsfw", "onlyfans", "freeuse", "panties", "booktok", "urban fantasy", "paranormal romance"],
  "space-anomalies": ["bruno mars", "mars bar", "mars inc", "$fly", "meme coin", "memecoin", "ca :", "mc :", "pump", "to mars"],
}
const GLOBAL_EXCLUDED_TERMS = [
  "porn",
  "tits",
  "escort",
  "giveaway",
  "airdrop",
  "onlyfans",
  "freeuse",
  "fucking",
  "shitpost",
  "meme coin",
  "memecoin",
]
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

function minCoreTopicScore(topicId: string) {
  return TOPIC_CORE_TERM_SCORE_FLOORS[topicId] ?? 35
}

function containsAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term))
}

function hasCoreTopicTerm(topicId: string, text: string) {
  return containsAnyTerm(text, TOPIC_CORE_TERMS[topicId] || [])
}

function hasTrustedSourceTerm(topicId: string, text: string) {
  return containsAnyTerm(text, [...(TOPIC_CORE_TERMS[topicId] || []), ...(TOPIC_TRUSTED_SOURCE_TERMS[topicId] || [])])
}

function rejectsGlobalText(text?: string) {
  const normalized = (text || "").toLowerCase()
  return Boolean(normalized && containsAnyTerm(normalized, GLOBAL_EXCLUDED_TERMS))
}

function rejectsLaneNoise(topicId: string, text?: string) {
  const normalized = (text || "").toLowerCase()
  return Boolean(normalized && containsAnyTerm(normalized, TOPIC_EXCLUDED_TERMS[topicId] || []))
}

function isPriorityPost(post: ViralXPost) {
  return Boolean(post.username && PRIORITY_X_ACCOUNT_SET.has(post.username.toLowerCase()))
}

function isTrustedSourcePost(topicId: string, post: ViralXPost, normalized: string) {
  const sourceAccounts = TOPIC_SOURCE_X_ACCOUNT_SETS[topicId]
  return Boolean(post.username && sourceAccounts?.has(post.username.toLowerCase()) && hasTrustedSourceTerm(topicId, normalized))
}

function rejectsProfileReaderBoilerplate(post: ViralXPost, normalized: string) {
  const text = post.text.trim()
  const profileChromePatterns = [
    /^#\s+.+\(@[A-Za-z0-9_]{1,20}\)\s*\/\s*X$/i,
    /^\[[^\]]+\]\([^)]*\)$/i,
    /^\[(?:media|posts|replies|highlights|articles|likes)\]/i,
    /^media\s*&\s*news company\b/i,
    /\bads info\b/i,
    /\bcookie policy\b/i,
    /\bcookie use\b/i,
    /\bprivacy policy\b/i,
    /\bterms of service\b/i,
    /\bsign up\b/i,
    /\blog in\b/i,
    /\bopens profile photo\b/i,
  ]

  if (profileChromePatterns.some((pattern) => pattern.test(text) || pattern.test(normalized))) return true
  if (post.source === "x-profile-reader" && !/status(?:es)?\/\d{8,}/i.test(post.url || "")) {
    if (/^@?[A-Za-z0-9_]{1,20}\b\s*(?:\/\s*)?X$/i.test(text)) return true
    if (text.length < 42 && !/[.!?]$/.test(text)) return true
  }

  return false
}

function isQualityTopicPost(topicId: string, post: ViralXPost) {
  const normalized = post.text.toLowerCase()
  if (rejectsGlobalText(normalized)) return false
  if (rejectsProfileReaderBoilerplate(post, normalized)) return false
  if (isTrustedSourcePost(topicId, post, normalized)) return true
  if (rejectsLaneNoise(topicId, normalized)) return false
  if (hasCoreTopicTerm(topicId, normalized)) {
    if (isPriorityPost(post)) return true
    if (post.source === "x-api") return (post.score || 0) >= minCoreTopicScore(topicId)
    return true
  }
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
  const ranked = [...posts, ...seededPostsForTopic(topicId)]
    .map((post) => ({ ...post, topicId: post.topicId || topicId }))
    .filter((post) => isFreshXPost(post))
    .filter((post) => isQualityTopicPost(topicId, post))
    .filter((post) => {
      const key = post.id || post.url
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return diversifyXPosts(ranked, limit)
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

function xPostAccountKey(post: ViralXPost) {
  return (post.username || post.authorName || "unknown").toLowerCase()
}

function profileReaderMaxPerAccount(limit: number) {
  const configured = Math.trunc(Number(process.env.X_PROFILE_READER_MAX_PER_ACCOUNT || ""))
  if (Number.isFinite(configured) && configured > 0) return Math.min(configured, 12)
  return Math.max(2, Math.ceil(limit / 6))
}

function diversifyXPosts(posts: ViralXPost[], limit: number, maxPerAccount = profileReaderMaxPerAccount(limit)) {
  const ranked = dedupePosts(posts).sort((left, right) => (right.score || 0) - (left.score || 0))
  const selected: ViralXPost[] = []
  const selectedKeys = new Set<string>()
  const accountCounts = new Map<string, number>()

  for (const post of ranked) {
    const key = post.id || post.url
    const account = xPostAccountKey(post)
    if (!key || selectedKeys.has(key)) continue
    if ((accountCounts.get(account) || 0) >= maxPerAccount) continue
    selected.push(post)
    selectedKeys.add(key)
    accountCounts.set(account, (accountCounts.get(account) || 0) + 1)
    if (selected.length >= limit) return selected
  }

  for (const post of ranked) {
    const key = post.id || post.url
    if (!key || selectedKeys.has(key)) continue
    selected.push(post)
    selectedKeys.add(key)
    if (selected.length >= limit) return selected
  }

  return selected
}

function cleanSearchText(value?: string) {
  return (value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function stableTextId(value: string) {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
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

// Fetch a few recent tweets about an arbitrary story (for story detail pages). Uses the X recent-
// search API when a bearer token is configured; returns [] otherwise so the page can fall back to a
// plain X live-search link. The underlying fetch is cached (revalidate), so views don't hammer X.
export async function fetchStoryTweets(query: string, limit = 6): Promise<ViralXPost[]> {
  const token =
    process.env.X_BEARER_TOKEN ||
    process.env.X_API_BEARER_TOKEN ||
    process.env.TWITTER_BEARER_TOKEN ||
    process.env.TWITTER_API_BEARER_TOKEN
  const trimmed = (query || "").trim()
  if (!token || !trimmed) return [] satisfies ViralXPost[]
  const posts = await fetchXApiSearch(`${trimmed} lang:en -is:retweet -is:reply`, "story", token).catch(
    () => [] satisfies ViralXPost[],
  )
  return [...posts].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, Math.max(1, Math.min(limit, 12)))
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
  const sourceAccountQuery = (TOPIC_SOURCE_X_ACCOUNTS[topicId] || []).map((account) => `from:${account}`).join(" OR ")
  const topicPostSets = await Promise.all(
    topicQueries.map((query) => fetchXApiSearch(`${query} lang:en -is:retweet -is:reply`, topicId, token)),
  )
  const priorityPostSets = await Promise.all(
    topicQueries.slice(0, 2).map((query) => {
      const priorityQuery = `(${priorityAccountQuery}) ${query} lang:en -is:retweet -is:reply`
      return fetchXApiSearch(priorityQuery, topicId, token)
    }),
  )
  const sourcePostSet = sourceAccountQuery
    ? await fetchXApiSearch(`(${sourceAccountQuery}) lang:en -is:retweet -is:reply`, topicId, token)
    : []

  const ranked = dedupePosts([
    ...priorityPostSets.flat().map((post) => ({ ...post, score: (post.score || 0) + 500 })),
    ...sourcePostSet.map((post) => ({ ...post, score: (post.score || 0) + TOPIC_SOURCE_ACCOUNT_SCORE_BONUS })),
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

async function fetchExaXSearchResults(query: string) {
  const token = process.env.EXA_API_KEY || process.env.EXA_SEARCH_API_KEY
  if (!token) return []

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(EXA_X_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      "user-agent": "InvertedWorldXSignals/1.0",
      "x-api-key": token,
    },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: 10,
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

  return data.results || []
}

async function fetchExaIndexedXPosts(topicId: string, limit: number) {
  const token = process.env.EXA_API_KEY || process.env.EXA_SEARCH_API_KEY
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
  const priorityAccounts = PRIORITY_X_ACCOUNTS.map((account) => `site:x.com/${account}`).join(" OR ")
  const results = await Promise.all([
    ...queryTerms.map((query) => fetchExaXSearchResults(`${query} site:x.com status thread documents breaking`)),
    ...queryTerms.slice(0, 2).map((query) => fetchExaXSearchResults(`${query} ${priorityAccounts}`)),
  ])
  const seen = new Set<string>()

  return results
    .flat()
    .map((result, index): ViralXPost | undefined => {
      const status = extractXStatusUrl(result.url)
      if (!status || seen.has(status.id)) return undefined
      seen.add(status.id)

      const title = cleanSearchText(result.title)
      const highlight = cleanSearchText(result.highlights?.find(Boolean))
      const text = title || highlight || `${topic.title} signal on X`
      if (!matchesTopicText(topicId, `${text} ${highlight}`)) return undefined

      return {
        id: status.id,
        url: status.url,
        text,
        topicId,
        username: status.username,
        createdAt: status.createdAt,
        source: "exa-search",
        score: Math.max(20, 100 - index),
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

function profileReaderAccounts(topicId: string) {
  const configuredLimit = Math.trunc(Number(process.env.X_PROFILE_READER_ACCOUNT_LIMIT || ""))
  const accountLimit =
    Number.isFinite(configuredLimit) && configuredLimit > 0
      ? Math.min(configuredLimit, 12)
      : TOPIC_PROFILE_READER_ACCOUNT_LIMITS[topicId] || DEFAULT_PROFILE_READER_ACCOUNT_LIMIT
  return Array.from(new Set([...(TOPIC_SOURCE_X_ACCOUNTS[topicId] || []), ...PRIORITY_X_ACCOUNTS])).slice(0, accountLimit)
}

function parseJinaProfilePublishedAt(markdown: string) {
  const value = markdown.match(/^Published Time:\s*(.+)$/m)?.[1]?.trim()
  if (!value) return new Date().toISOString()
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? new Date().toISOString() : new Date(timestamp).toISOString()
}

function isProfileReaderNoise(line: string, account: string) {
  const normalized = line.toLowerCase()
  return (
    !line ||
    line === "Pinned" ||
    line === "Replying to" ||
    line === account ||
    line === `@${account}` ||
    line.startsWith("Title:") ||
    line.startsWith("URL Source:") ||
    line.startsWith("Published Time:") ||
    line.startsWith("Markdown Content:") ||
    line.startsWith("## ") ||
    line.startsWith("![") ||
    line.startsWith("[![") ||
    normalized.includes("opens profile photo")
  )
}

function parseJinaProfilePosts(topicId: string, account: string, markdown: string, limit: number) {
  const publishedAt = parseJinaProfilePublishedAt(markdown)
  const postHeadingIndex = markdown.search(/^## .+ posts$/m)
  const postMarkdown = postHeadingIndex >= 0 ? markdown.slice(postHeadingIndex) : markdown
  const lines = postMarkdown
    .split(/\r?\n/)
    .map((line) => cleanSearchText(line))
    .filter((line) => !isProfileReaderNoise(line, account))
    .filter((line) => line.length >= 28 && line.length <= 520)
    .filter((line) => matchesTopicText(topicId, line))

  return dedupePosts(lines.map((line, index) => {
    const status = extractXStatusUrl(line)
    const id = status?.id || `jina-${account.toLowerCase()}-${stableTextId(line)}`

    return {
      id,
      url: status?.url || `https://twitter.com/${account}`,
      text: line,
      topicId,
      username: account,
      createdAt: status?.createdAt || publishedAt,
      source: "x-profile-reader",
      score: Math.max(25, 300 - index * 4),
    } satisfies ViralXPost
  })).slice(0, limit)
}

async function fetchJinaProfilePostsForTopic(topicId: string, limit: number) {
  const posts: ViralXPost[] = []
  for (const account of profileReaderAccounts(topicId)) {
    const accountPosts = await fetch(`https://r.jina.ai/http://https://x.com/${account}`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(JINA_X_PROFILE_TIMEOUT_MS),
      headers: {
        "user-agent": "InvertedWorldXProfileReader/1.0",
      },
    })
      .then(async (response) => {
        if (!response.ok) return [] satisfies ViralXPost[]
        const markdown = await response.text()
        return parseJinaProfilePosts(topicId, account, markdown, limit)
      })
      .catch(() => [] satisfies ViralXPost[])

    posts.push(...accountPosts)
  }

  return diversifyXPosts(
    posts
      .filter((post) => isFreshXPost(post))
      .filter((post) => isQualityTopicPost(topicId, post)),
    limit,
  )
}

export async function fetchViralXPostsForTopic(
  topicId: string,
  options: { limit?: number; allowProfileReader?: boolean } & ProviderFallbackOptions = {},
) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 18), 48))
  const recursivPosts = (await fetchRecursivXSignalsForTopic(topicId, { limit })) || []
  const recursivRankedPosts = mergeWithSeededPosts(topicId, recursivPosts, limit)
  if (recursivRankedPosts.length >= limit || !allowProviderFallbacks(options)) return recursivRankedPosts

  const [xPosts, indexedPosts, exaPosts, syndicatedPosts, profilePosts] = await Promise.all([
    fetchXApiPosts(topicId, limit).catch(() => []),
    fetchBraveIndexedXPosts(topicId, limit).catch(() => []),
    fetchExaIndexedXPosts(topicId, limit).catch(() => []),
    fetchSyndicatedPriorityPosts(topicId, limit).catch(() => []),
    options.allowProfileReader ? fetchJinaProfilePostsForTopic(topicId, limit).catch(() => []) : Promise.resolve([]),
  ])
  const rankedPosts = diversifyXPosts([...xPosts, ...indexedPosts, ...exaPosts, ...syndicatedPosts, ...profilePosts], limit)

  return mergeWithSeededPosts(topicId, [...recursivPosts, ...rankedPosts], limit)
}

export async function fetchViralXPostsByTopic(
  options: { limitPerTopic?: number; allowProfileReader?: boolean } & ProviderFallbackOptions = {},
) {
  const limitPerTopic = Math.max(1, Math.min(Math.trunc(options.limitPerTopic || 18), 48))
  const topicIds = topics.map((topic) => topic.id)
  const recursivByTopic = await fetchRecursivXSignalsByTopic({ limitPerTopic, topicIds })
  const result: Record<string, ViralXPost[]> = {}
  const missingTopicIds: string[] = []

  for (const topicId of topicIds) {
    const posts = mergeWithSeededPosts(topicId, recursivByTopic?.[topicId] || [], limitPerTopic)
    if (posts.length >= limitPerTopic || !allowProviderFallbacks(options)) {
      result[topicId] = posts
    } else {
      missingTopicIds.push(topicId)
    }
  }

  if (!missingTopicIds.length) return result

  const fallbackResults = await Promise.allSettled(
    missingTopicIds.map((topicId) =>
      fetchViralXPostsForTopic(topicId, {
        ...options,
        limit: limitPerTopic,
      }),
    ),
  )

  for (let index = 0; index < missingTopicIds.length; index += 1) {
    const topicId = missingTopicIds[index]
    const fallback = fallbackResults[index]
    result[topicId] = fallback.status === "fulfilled" ? fallback.value : mergeWithSeededPosts(topicId, [], limitPerTopic)
  }

  return result
}
