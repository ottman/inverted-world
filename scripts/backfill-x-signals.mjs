import fs from "node:fs"
import { Recursiv } from "@recursiv/sdk"

const DEFAULT_BASE_URL = "https://api.recursiv.io/api/v1"
const DEFAULT_DATABASE_NAME = "inverted_world_research"
const LOCAL_PROVIDER_ENV = "/private/tmp/inverted-world-api-keys.env"
const LOCAL_RECURSIV_KEY = "/private/tmp/inverted-world-recursiv-key"

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

async function upsertPost(sdk, projectId, databaseName, post) {
  await sdk.databases.query({
    project_id: projectId,
    database_name: databaseName,
    sql: `INSERT INTO x_signals (
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
      VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, '')::timestamptz, $8, $9, $10::jsonb, $11::jsonb)
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
    params: [
      post.topicId,
      post.id,
      post.url,
      post.username || "",
      post.authorName || "",
      post.text,
      post.createdAt || "",
      post.source,
      post.score || 0,
      JSON.stringify(post.metrics || {}),
      JSON.stringify({ ingestion: "local-x-backfill", backfilledAt: new Date().toISOString() }),
    ],
  })
}

async function clearLocalBackfillRows(sdk, projectId, databaseName) {
  await sdk.databases.query({
    project_id: projectId,
    database_name: databaseName,
    sql: "DELETE FROM x_signals WHERE metadata->>'ingestion' = 'local-x-backfill'",
  })
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")
  loadEnvFile(LOCAL_PROVIDER_ENV)

  const token =
    process.env.X_BEARER_TOKEN ||
    process.env.X_API_BEARER_TOKEN ||
    process.env.TWITTER_BEARER_TOKEN ||
    process.env.TWITTER_API_BEARER_TOKEN
  if (!token) throw new Error(`Missing X bearer token. Expected ${LOCAL_PROVIDER_ENV} or server env.`)

  const apiKey = readRecursivKey()
  if (!apiKey) throw new Error("Missing Recursiv API key")

  const projectId = process.env.RECURSIV_PROJECT_ID
  const databaseName = process.env.RECURSIV_DATABASE_NAME || DEFAULT_DATABASE_NAME
  if (!projectId || !databaseName) throw new Error("Missing RECURSIV_PROJECT_ID or RECURSIV_DATABASE_NAME")

  const limit = parseLimit()
  const sdk = new Recursiv({
    apiKey,
    baseUrl: process.env.RECURSIV_BASE_URL || DEFAULT_BASE_URL,
    timeout: 120000,
    maxRetries: 2,
  })

  const summary = {}
  const acceptedByTopic = {}
  for (const topicId of Object.keys(TOPICS)) {
    const posts = await postsForTopic(topicId, token, limit)
    acceptedByTopic[topicId] = posts
    summary[topicId] = {
      upserted: posts.length,
      accounts: [...new Set(posts.map((post) => post.username).filter(Boolean))],
    }
  }

  const totalAccepted = Object.values(acceptedByTopic).reduce((sum, posts) => sum + posts.length, 0)
  if (!shouldKeepExisting() && totalAccepted > 0) {
    await clearLocalBackfillRows(sdk, projectId, databaseName)
  }

  for (const posts of Object.values(acceptedByTopic)) {
    for (const post of posts) await upsertPost(sdk, projectId, databaseName, post)
  }

  console.log(JSON.stringify({ ok: true, limit, totalAccepted, replacedExisting: !shouldKeepExisting() && totalAccepted > 0, summary }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
