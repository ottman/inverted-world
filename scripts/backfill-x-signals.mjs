import fs from "node:fs"

const DEFAULT_BASE_URL = "https://api.recursiv.io/api/v1"
const DEFAULT_DATABASE_NAME = "inverted_world_research"
const LOCAL_PROVIDER_ENV = "/private/tmp/inverted-world-api-keys.env"
const LOCAL_RECURSIV_KEY = "/private/tmp/inverted-world-recursiv-key"
const X_EPOCH_MS = BigInt(1_288_834_974_657)
const X_SNOWFLAKE_SHIFT_BITS = BigInt(22)
const X_STATUS_URL_PATTERN =
  /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/(?!i\/web)([A-Za-z0-9_]{1,20})\/status(?:es)?\/(\d+)/i
const EXA_TIMEOUT_MS = 30000
const PROFILE_READER_TIMEOUT_MS = 15000
const DEFAULT_PROFILE_READER_ACCOUNT_LIMIT = 4
const DEFAULT_RECURSIV_TIMEOUT_MS = 30000

const TOPICS = {
  "uap-disclosure": {
    floor: 250,
    coreFloor: 35,
    queries: [
      '(UAP OR UFO OR AARO OR "UFO files" OR "UAP disclosure")',
      '("UFO hearing" OR "UAP hearing" OR Grusch OR Elizondo OR "Ryan Graves")',
      '("drone incursions" OR "mystery drones" OR "Pentagon UAP" OR "NASA UAP")',
      '("orb video" OR "crash retrieval" OR "non-human intelligence")',
    ],
    accounts: ["InvertedTales", "ShaneCashman", "ChrisKMellon", "uncertainvector", "Debriefmedia", "mufon"],
    terms: ["uap", "ufo", "aaro", "disclosure", "grusch", "pentagon", "deptofwar", "uap files", "uap videos", "mufon"],
  },
  "secret-programs": {
    floor: 140,
    coreFloor: 35,
    queries: [
      '(MKULTRA OR CIA OR FOIA OR declassified OR "secret program")',
      '("FBI Vault" OR "CIA files" OR "black budget" OR "classified program")',
      '(psyop OR psyops OR coverup OR "lab leak" OR "deep state")',
      '(Snowden OR Assange OR whistleblower OR "intelligence community")',
    ],
    accounts: ["TimcastNews", "ShaneCashman", "NSArchive", "MuckRock", "FBIRecordsVault", "FBI"],
    terms: ["mkultra", "cia files", "foia", "declassified records", "fbi vault", "cia reading room", "black budget"],
  },
  "epstein-networks": {
    floor: 160,
    coreFloor: 35,
    queries: [
      '("Jeffrey Epstein" OR Epstein OR Maxwell OR "Epstein files" OR "client list")',
      '("client list" OR "flight logs" OR "sealed documents" OR "court records")',
      '(Giuffre OR "Prince Andrew" OR "JPMorgan Epstein" OR "Epstein island")',
      '("DOJ Epstein" OR "Epstein documents" OR "unsealed Epstein")',
      '("blackmail network" OR "elite network" OR "elite access" OR "institutional corruption")',
      '("donor class" OR "dark money" OR "power network" OR "elite capture" OR lobbying)',
      '("WEF" OR Davos OR Bilderberg OR BlackRock OR Vanguard OR "World Economic Forum")',
    ],
    accounts: ["ShaneCashman", "TimcastNews", "julie_k_brown", "MiamiHerald", "SDNYnews", "TheJusticeDept"],
    terms: ["epstein", "maxwell", "ghislaine", "client list", "flight logs", "sealed documents", "prince andrew", "giuffre", "jpmorgan epstein"],
  },
  "cryptids-paranormal": {
    floor: 60,
    coreFloor: 25,
    queries: [
      '(Bigfoot OR Sasquatch OR cryptid OR Mothman OR Dogman)',
      '("ghost sighting" OR "ghost video" OR poltergeist OR "paranormal investigation")',
      '("high strangeness" OR Skinwalker OR "missing 411" OR "remote viewing")',
      '("pterodactyl" OR "strange creature" OR "fortean")',
      '("near death experience" OR "consciousness anomaly" OR "strange lights" OR "haunted")',
    ],
    accounts: ["InvertedTales", "ShaneCashman", "mufon", "ForteanTimes"],
    terms: ["pterodactyl", "cryptid", "bigfoot", "sasquatch", "mufon", "fortean", "high strangeness", "skinwalker"],
  },
  "ai-technocracy": {
    floor: 140,
    coreFloor: 35,
    queries: [
      '("AI surveillance" OR technocracy OR Palantir OR "digital ID")',
      '("facial recognition" OR "license plate reader" OR "predictive policing")',
      '("AI data center" OR "data centers" OR "power grid" OR "energy demand")',
      '(deepfake OR "synthetic media" OR "autonomous weapons" OR "AI governance")',
    ],
    accounts: ["TimcastNews", "ShaneCashman", "404mediaco", "TechCrunch", "EFF", "PalantirTech"],
    terms: ["ai", "privacy", "personal data", "surveillance", "robot", "autonomous", "palantir", "deepfake", "data center"],
  },
  "space-anomalies": {
    floor: 110,
    coreFloor: 30,
    queries: [
      '((NASA OR NOAA OR ESA) ("space anomaly" OR anomaly OR meteor OR asteroid OR "solar storm" OR "geomagnetic storm"))',
      '("Mars anomaly" OR "moon anomaly" OR "lost satellite" OR "interstellar object")',
      '("NOAA SWPC" OR "space weather" OR "geomagnetic storm")',
      '("Bermuda Triangle" OR "ocean anomaly" OR comet OR bolide)',
    ],
    accounts: ["NASA", "NASASun", "NWSSWPC", "esaoperations", "AsteroidWatch", "MarsCuriosity"],
    terms: ["nasa", "mars", "moon", "psyche", "asteroid", "solar", "space weather", "venus", "artemis", "space station", "swpc"],
  },
}

const GLOBAL_EXCLUDES = ["porn", "escort", "giveaway", "airdrop", "onlyfans", "freeuse", "meme coin", "memecoin"]
const TOPIC_EXCLUDES = {
  "cryptids-paranormal": ["booktok", "urban fantasy", "paranormal romance"],
  "space-anomalies": ["bruno mars", "mars bar", "$fly", "pump", "to mars"],
}
const PRIORITY_PROFILE_ACCOUNTS = ["Timcast", "TimcastNews", "TimcastIRL", "ShaneCashman", "InvertedTales"]
const profileMarkdownCache = new Map()

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    const value = rawValue.replace(/^["']|["']$/g, "")
    if (process.env[key] || !value) continue
    process.env[key] = value
  }
}

function readRecursivKey() {
  const candidates = [process.env.RECURSIV_API_KEY_FILE, LOCAL_RECURSIV_KEY].filter(Boolean)
  for (const file of candidates) {
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim()
  }
  return process.env.RECURSIV_SERVER_API_KEY || process.env.RECURSIV_API_KEY || process.env.SOCIAL_DEV_API_KEY
}

function parseLimit() {
  const value = process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1]
  const parsed = Number(value || process.env.X_BACKFILL_LIMIT_PER_TOPIC || "24")
  return Math.max(1, Math.min(Math.trunc(parsed) || 24, 48))
}

function shouldKeepExisting() {
  return process.argv.includes("--keep-existing")
}

function shouldDryRun() {
  return process.argv.includes("--dry-run")
}

function providerMode() {
  const value = process.argv.find((arg) => arg.startsWith("--provider="))?.split("=")[1] || "all"
  return ["all", "x", "exa", "profile"].includes(value) ? value : "all"
}

function selectedTopicIds() {
  const value = process.argv.find((arg) => arg.startsWith("--topic="))?.split("=")[1]
  if (!value) return Object.keys(TOPICS)
  const requested = value.split(",").map((item) => item.trim()).filter(Boolean)
  const valid = requested.filter((topicId) => TOPICS[topicId])
  return valid.length ? valid : Object.keys(TOPICS)
}

function maxAgeHours() {
  const parsed = Number(process.env.X_BACKFILL_MAX_AGE_HOURS || "168")
  return Math.max(1, Math.min(Math.trunc(parsed) || 168, 24 * 30))
}

function profileReaderAccountLimit() {
  const parsed = Number(process.env.X_PROFILE_READER_ACCOUNT_LIMIT || "")
  if (Number.isFinite(parsed) && parsed > 0) return Math.min(Math.trunc(parsed), 12)
  return DEFAULT_PROFILE_READER_ACCOUNT_LIMIT
}

function recursivTimeoutMs() {
  const parsed = Number(process.env.RECURSIV_BACKFILL_TIMEOUT_MS || "")
  if (Number.isFinite(parsed) && parsed > 0) return Math.min(Math.trunc(parsed), 120000)
  return DEFAULT_RECURSIV_TIMEOUT_MS
}

async function recursivQuery(client, input) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), client.timeoutMs)
  try {
    const response = await fetch(`${client.baseUrl}/databases/query`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${client.apiKey}`,
        "content-type": "application/json",
        "user-agent": "InvertedWorldXBackfill/1.0",
      },
      body: JSON.stringify(input),
    })
    const text = await response.text()
    const data = text ? JSON.parse(text) : {}
    if (!response.ok) {
      const message = data?.error?.message || data?.error || response.statusText
      throw new Error(`Recursiv query returned ${response.status}: ${message}`)
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

function score(metrics = {}) {
  return (
    (metrics.like_count || 0) +
    (metrics.retweet_count || 0) * 2 +
    (metrics.quote_count || 0) * 2 +
    (metrics.reply_count || 0) * 0.5 +
    (metrics.impression_count || 0) * 0.01
  )
}

function containsAny(value, terms) {
  return terms.some((term) => value.includes(term))
}

function normalize(value = "") {
  return value.toLowerCase()
}

function cleanSearchText(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function extractXStatusUrl(value = "") {
  const match = value.match(X_STATUS_URL_PATTERN)
  if (!match) return undefined
  const [, username, id] = match
  return {
    id,
    username,
    url: `https://twitter.com/${username}/status/${id}`,
    createdAt: new Date(Number((BigInt(id) >> X_SNOWFLAKE_SHIFT_BITS) + X_EPOCH_MS)).toISOString(),
  }
}

function isFreshPost(post, hours) {
  const timestamp = post.createdAt ? new Date(post.createdAt).getTime() : 0
  return Boolean(timestamp && !Number.isNaN(timestamp) && Date.now() - timestamp <= hours * 60 * 60 * 1000)
}

function stableTextId(value = "") {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash).toString(36)
}

function isAcceptedPost(topicId, post) {
  const topic = TOPICS[topicId]
  const text = normalize(post.text)
  if (!text) return false
  if (containsAny(text, GLOBAL_EXCLUDES)) return false
  const username = normalize(post.username)
  const trustedAccount = topic.accounts.map(normalize).includes(username)
  const topicMatch = containsAny(text, topic.terms)
  if (trustedAccount && topicMatch) return true
  if (containsAny(text, TOPIC_EXCLUDES[topicId] || [])) return false
  return topicMatch && (post.score || 0) >= topic.coreFloor
}

async function fetchXApiSearch(query, topicId, token) {
  const url = new URL("https://api.twitter.com/2/tweets/search/recent")
  url.searchParams.set("query", query)
  url.searchParams.set("max_results", "50")
  url.searchParams.set("tweet.fields", "created_at,public_metrics")
  url.searchParams.set("expansions", "author_id")
  url.searchParams.set("user.fields", "name,username")

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": "InvertedWorldXBackfill/1.0",
    },
  })
  if (!response.ok) return []

  const data = await response.json()
  const users = new Map((data.includes?.users || []).map((user) => [user.id, user]))
  return (data.data || []).map((item) => {
    const user = item.author_id ? users.get(item.author_id) : undefined
    const postScore = score(item.public_metrics)
    return {
      id: item.id,
      url: `https://twitter.com/${user?.username || "i"}/status/${item.id}`,
      text: item.text,
      topicId,
      authorName: user?.name,
      username: user?.username,
      createdAt: item.created_at,
      source: "x-api",
      score: postScore,
      metrics: {
        likes: item.public_metrics?.like_count,
        reposts: item.public_metrics?.retweet_count,
        replies: item.public_metrics?.reply_count,
        quotes: item.public_metrics?.quote_count,
        views: item.public_metrics?.impression_count,
      },
    }
  })
}

async function fetchExaSearch(query, exaKey) {
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    signal: AbortSignal.timeout(EXA_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      "user-agent": "InvertedWorldXBackfill/1.0",
      "x-api-key": exaKey,
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
  const data = await response.json().catch(() => ({}))
  return Array.isArray(data.results) ? data.results : []
}

function dedupe(posts) {
  const seen = new Set()
  return posts.filter((post) => {
    const key = post.id || post.url
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function postsForTopic(topicId, token, limit) {
  const topic = TOPICS[topicId]
  const accountQuery = topic.accounts.map((account) => `from:${account}`).join(" OR ")
  const [accountPosts, topicSets] = await Promise.all([
    accountQuery ? fetchXApiSearch(`(${accountQuery}) lang:en -is:retweet -is:reply`, topicId, token) : [],
    Promise.all(topic.queries.map((query) => fetchXApiSearch(`${query} lang:en -is:retweet -is:reply`, topicId, token))),
  ])

  return dedupe([
    ...accountPosts.map((post) => ({ ...post, score: (post.score || 0) + 175 })),
    ...topicSets.flat(),
  ])
    .filter((post) => isAcceptedPost(topicId, post))
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, limit)
}

async function exaPostsForTopic(topicId, exaKey, limit) {
  const topic = TOPICS[topicId]
  const queryTerms = topic.queries.map((query) =>
    query
      .replace(/[()"]/g, " ")
      .replace(/\bOR\b/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
  const accountSites = topic.accounts.map((account) => `site:x.com/${account}`).join(" OR ")
  const resultSets = await Promise.all([
    ...queryTerms.map((query) => fetchExaSearch(`${query} site:x.com status breaking documents thread`, exaKey)),
    ...queryTerms.slice(0, 2).map((query) => fetchExaSearch(`${query} ${accountSites}`, exaKey)),
  ])
  const seen = new Set()
  const maxHours = maxAgeHours()

  return resultSets
    .flat()
    .map((result, index) => {
      const status = extractXStatusUrl(result.url || "")
      if (!status || seen.has(status.id)) return undefined
      seen.add(status.id)
      const highlight = cleanSearchText((Array.isArray(result.highlights) && result.highlights.find(Boolean)) || "")
      const title = cleanSearchText(result.title || "")
      const text = cleanSearchText(`${title} ${highlight}`) || `${topicId} X signal`
      const username = status.username || cleanSearchText(result.author || "")
      const trustedAccount = topic.accounts.map(normalize).includes(normalize(username))

      return {
        id: status.id,
        url: status.url,
        text,
        topicId,
        authorName: cleanSearchText(result.author || ""),
        username,
        createdAt: status.createdAt,
        source: "exa-search",
        score: Math.max(topic.coreFloor, 160 - index * 2) + (trustedAccount ? 175 : 0),
        metrics: {},
      }
    })
    .filter(Boolean)
    .filter((post) => isFreshPost(post, maxHours))
    .filter((post) => isAcceptedPost(topicId, post))
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, limit)
}

function profileReaderAccounts(topicId) {
  const topic = TOPICS[topicId]
  return Array.from(new Set([...(topic?.accounts || []), ...PRIORITY_PROFILE_ACCOUNTS])).slice(0, profileReaderAccountLimit())
}

function parseProfilePublishedAt(markdown) {
  const value = markdown.match(/^Published Time:\s*(.+)$/m)?.[1]?.trim()
  if (!value) return new Date().toISOString()
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? new Date().toISOString() : new Date(timestamp).toISOString()
}

function isProfileReaderNoise(line, account) {
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

function parseProfilePosts(topicId, account, markdown, limit) {
  const publishedAt = parseProfilePublishedAt(markdown)
  const postHeadingIndex = markdown.search(/^## .+ posts$/m)
  const postMarkdown = postHeadingIndex >= 0 ? markdown.slice(postHeadingIndex) : markdown
  const lines = postMarkdown
    .split(/\r?\n/)
    .map((line) => cleanSearchText(line))
    .filter((line) => !isProfileReaderNoise(line, account))
    .filter((line) => line.length >= 28 && line.length <= 520)

  return dedupe(lines.map((line, index) => {
    const status = extractXStatusUrl(line)
    return {
      id: status?.id || `jina-${account.toLowerCase()}-${stableTextId(line)}`,
      url: status?.url || `https://twitter.com/${account}`,
      text: line,
      topicId,
      username: account,
      createdAt: status?.createdAt || publishedAt,
      source: "x-profile-reader",
      score: Math.max(25, 300 - index * 4),
      metrics: {},
    }
  }))
    .filter((post) => isFreshPost(post, maxAgeHours()))
    .filter((post) => isAcceptedPost(topicId, post))
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, limit)
}

async function fetchProfileMarkdown(account) {
  const key = account.toLowerCase()
  if (!profileMarkdownCache.has(key)) {
    profileMarkdownCache.set(
      key,
      fetch(`https://r.jina.ai/http://https://x.com/${account}`, {
        signal: AbortSignal.timeout(PROFILE_READER_TIMEOUT_MS),
        headers: {
          "user-agent": "InvertedWorldXProfileBackfill/1.0",
        },
      })
        .then((response) => (response.ok ? response.text() : ""))
        .catch(() => ""),
    )
  }
  return profileMarkdownCache.get(key)
}

async function profilePostsForTopic(topicId, limit) {
  const posts = await Promise.all(
    profileReaderAccounts(topicId).map(async (account) => {
      const markdown = await fetchProfileMarkdown(account)
      if (!markdown) return []
      return parseProfilePosts(topicId, account, markdown, limit)
    }),
  )

  return dedupe(posts.flat())
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, limit)
}

async function upsertPosts(client, projectId, databaseName, posts) {
  if (!posts.length) return
  const backfilledAt = new Date().toISOString()
  const rows = posts.map((post) => ({
    topic_id: post.topicId,
    x_id: post.id,
    url: post.url,
    username: post.username || "",
    author_name: post.authorName || "",
    body: post.text,
    posted_at: post.createdAt || "",
    source: post.source,
    score: post.score || 0,
    metrics: post.metrics || {},
    metadata: { ingestion: "local-x-backfill", backfilledAt },
  }))

  await recursivQuery(client, {
    project_id: projectId,
    database_name: databaseName,
    sql: `WITH input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS row(
          topic_id text,
          x_id text,
          url text,
          username text,
          author_name text,
          body text,
          posted_at text,
          source text,
          score numeric,
          metrics jsonb,
          metadata jsonb
        )
      )
      INSERT INTO x_signals (
        topic_id,
        x_id,
        url,
        username,
        author_name,
        text,
        posted_at,
        source,
        score,
        metrics,
        metadata
      )
      SELECT
        topic_id,
        x_id,
        url,
        username,
        author_name,
        body,
        NULLIF(posted_at, '')::timestamptz,
        source,
        score,
        metrics,
        metadata
      FROM input
      ON CONFLICT (x_id) DO UPDATE SET
        topic_id = EXCLUDED.topic_id,
        url = EXCLUDED.url,
        username = EXCLUDED.username,
        author_name = EXCLUDED.author_name,
        text = EXCLUDED.text,
        posted_at = EXCLUDED.posted_at,
        source = EXCLUDED.source,
        score = EXCLUDED.score,
        metrics = EXCLUDED.metrics,
        metadata = x_signals.metadata || EXCLUDED.metadata,
        captured_at = now()`,
    params: [JSON.stringify(rows)],
  })
}

async function clearLocalBackfillRows(client, projectId, databaseName) {
  await recursivQuery(client, {
    project_id: projectId,
    database_name: databaseName,
    sql: "DELETE FROM x_signals WHERE metadata->>'ingestion' = 'local-x-backfill'",
  })
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")
  loadEnvFile(LOCAL_PROVIDER_ENV)

  const dryRun = shouldDryRun()
  const token =
    process.env.X_BEARER_TOKEN ||
    process.env.X_API_BEARER_TOKEN ||
    process.env.TWITTER_BEARER_TOKEN ||
    process.env.TWITTER_API_BEARER_TOKEN
  const exaKey = process.env.EXA_API_KEY || process.env.EXA_SEARCH_API_KEY
  const provider = providerMode()
  if (provider === "x" && !token) {
    throw new Error(`Missing X bearer token. Expected ${LOCAL_PROVIDER_ENV} or server env.`)
  }
  if (provider === "exa" && !exaKey) {
    throw new Error(`Missing EXA_API_KEY or EXA_SEARCH_API_KEY. Expected ${LOCAL_PROVIDER_ENV} or server env.`)
  }
  if (provider === "all" && !token && !exaKey) {
    throw new Error(`Missing X bearer token or EXA_API_KEY. Expected ${LOCAL_PROVIDER_ENV} or server env.`)
  }

  const apiKey = dryRun ? "" : readRecursivKey()
  if (!dryRun && !apiKey) throw new Error("Missing Recursiv API key")

  const projectId = process.env.RECURSIV_PROJECT_ID
  const databaseName = process.env.RECURSIV_DATABASE_NAME || DEFAULT_DATABASE_NAME
  if (!dryRun && (!projectId || !databaseName)) throw new Error("Missing RECURSIV_PROJECT_ID or RECURSIV_DATABASE_NAME")

  const limit = parseLimit()
  const client = dryRun ? undefined : {
    apiKey,
    baseUrl: (process.env.RECURSIV_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    timeoutMs: recursivTimeoutMs(),
  }

  const summary = {}
  const acceptedByTopic = {}
  for (const topicId of selectedTopicIds()) {
    const [xPosts, exaPosts, profilePosts] = await Promise.all([
      token && provider !== "exa" && provider !== "profile" ? postsForTopic(topicId, token, limit).catch(() => []) : [],
      exaKey && provider !== "x" && provider !== "profile" ? exaPostsForTopic(topicId, exaKey, limit).catch(() => []) : [],
      provider === "profile" ? profilePostsForTopic(topicId, limit).catch(() => []) : [],
    ])
    const posts = dedupe([...xPosts, ...exaPosts, ...profilePosts])
      .sort((left, right) => (right.score || 0) - (left.score || 0))
      .slice(0, limit)
    acceptedByTopic[topicId] = posts
    summary[topicId] = {
      upserted: posts.length,
      sources: [...new Set(posts.map((post) => post.source).filter(Boolean))],
      accounts: [...new Set(posts.map((post) => post.username).filter(Boolean))],
    }
    if (provider === "profile") {
      console.error(`[x-backfill] ${topicId}: ${posts.length} accepted from ${summary[topicId].accounts.length} accounts`)
    }
  }

  const totalAccepted = Object.values(acceptedByTopic).reduce((sum, posts) => sum + posts.length, 0)
  if (!dryRun && !shouldKeepExisting() && totalAccepted > 0) {
    await clearLocalBackfillRows(client, projectId, databaseName)
  }

  if (!dryRun) {
    await upsertPosts(client, projectId, databaseName, Object.values(acceptedByTopic).flat())
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        provider,
        dryRun,
        limit,
        totalAccepted,
        replacedExisting: !dryRun && !shouldKeepExisting() && totalAccepted > 0,
        summary,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
