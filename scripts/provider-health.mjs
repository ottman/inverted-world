import fs from "node:fs"

const LOCAL_PROVIDER_ENV = "/private/tmp/inverted-world-api-keys.env"
const LOCAL_RECURSIV_KEY = "/private/tmp/inverted-world-recursiv-key"
const DEFAULT_BASE_URL = "https://api.recursiv.io/api/v1"
const DEFAULT_DATABASE_NAME = "inverted_world_research"
const YOUTUBE_RSS_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UC7qGeFv85Oyct3xlKq-pedw"
const YOUTUBE_UPLOADS_PLAYLIST_ID = "UU7qGeFv85Oyct3xlKq-pedw"

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

function envAny(names) {
  return names.map((name) => process.env[name]).find(Boolean)
}

function result(provider, data) {
  return { provider, checkedAt: new Date().toISOString(), ...data }
}

function missing(provider) {
  return result(provider, { status: "missing", configured: false })
}

function configuredOnly(provider, configured) {
  return result(provider, {
    status: configured ? "ok" : "missing",
    configured,
    mode: "configured-only",
  })
}

function safeMessage(error) {
  return error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160)
}

function readRecursivKey() {
  const candidates = [process.env.RECURSIV_API_KEY_FILE, LOCAL_RECURSIV_KEY].filter(Boolean)
  for (const file of candidates) {
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim()
  }
  return process.env.RECURSIV_SERVER_API_KEY || process.env.RECURSIV_API_KEY || process.env.SOCIAL_DEV_API_KEY
}

async function jsonFetch(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) })
  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : undefined
  } catch {
    body = undefined
  }
  return { response, body }
}

async function checkRecursivDatabase() {
  const apiKey = readRecursivKey()
  const projectId = process.env.RECURSIV_PROJECT_ID
  const databaseName = process.env.RECURSIV_DATABASE_NAME || DEFAULT_DATABASE_NAME
  if (!apiKey || !projectId || !databaseName) return missing("recursiv-database")

  try {
    const response = await fetch(`${process.env.RECURSIV_BASE_URL || DEFAULT_BASE_URL}/databases/query`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        project_id: projectId,
        database_name: databaseName,
        sql: "SELECT 1 AS ok",
      }),
      signal: AbortSignal.timeout(10000),
    })
    const body = await response.json().catch(() => ({}))
    return result("recursiv-database", {
      status: response.ok && body.data?.rows?.length ? "ok" : "error",
      configured: true,
      httpStatus: response.status,
      count: body.data?.rows?.length || 0,
      mode: "live",
      message: response.ok ? undefined : `Recursiv returned ${response.status}`,
    })
  } catch (error) {
    return result("recursiv-database", {
      status: "error",
      configured: true,
      mode: "live",
      message: safeMessage(error),
    })
  }
}

async function checkXApi() {
  const token = envAny(["X_BEARER_TOKEN", "X_API_BEARER_TOKEN", "TWITTER_BEARER_TOKEN", "TWITTER_API_BEARER_TOKEN"])
  if (!token) return missing("x-api")

  try {
    const url = new URL("https://api.twitter.com/2/tweets/search/recent")
    url.searchParams.set("query", "from:InvertedTales lang:en -is:retweet -is:reply")
    url.searchParams.set("max_results", "10")
    const { response, body } = await jsonFetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        "user-agent": "InvertedWorldProviderHealth/1.0",
      },
    })
    return result("x-api", {
      status: response.ok ? "ok" : "error",
      configured: true,
      httpStatus: response.status,
      count: body?.data?.length || 0,
      mode: "live",
      message: response.ok ? undefined : `X API returned ${response.status}`,
    })
  } catch (error) {
    return result("x-api", { status: "error", configured: true, mode: "live", message: safeMessage(error) })
  }
}

async function checkExa() {
  const apiKey = envAny(["EXA_API_KEY", "EXA_SEARCH_API_KEY"])
  if (!apiKey) return missing("exa")

  try {
    const { response, body } = await jsonFetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "InvertedWorldProviderHealth/1.0",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ query: "Inverted World source documents", type: "auto", numResults: 3 }),
    })
    return result("exa", {
      status: response.ok ? "ok" : "error",
      configured: true,
      httpStatus: response.status,
      count: body?.results?.length || 0,
      mode: "live",
      message: response.ok ? undefined : `Exa returned ${response.status}`,
    })
  } catch (error) {
    return result("exa", { status: "error", configured: true, mode: "live", message: safeMessage(error) })
  }
}

async function checkBrave() {
  const token = envAny(["BRAVE_SEARCH_API_KEY", "BRAVE_API_KEY", "BRAVE_SEARCH_KEY"])
  if (!token) return missing("brave-search")

  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search")
    url.searchParams.set("q", "Tales From the Inverted World")
    url.searchParams.set("count", "5")
    const { response, body } = await jsonFetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "InvertedWorldProviderHealth/1.0",
        "x-subscription-token": token,
      },
    })
    return result("brave-search", {
      status: response.ok ? "ok" : "error",
      configured: true,
      httpStatus: response.status,
      count: body?.web?.results?.length || 0,
      mode: "live",
      message: response.ok ? undefined : `Brave returned ${response.status}`,
    })
  } catch (error) {
    return result("brave-search", { status: "error", configured: true, mode: "live", message: safeMessage(error) })
  }
}

async function checkYouTubeRss() {
  try {
    const response = await fetch(YOUTUBE_RSS_URL, {
      headers: { "user-agent": "InvertedWorldProviderHealth/1.0" },
      signal: AbortSignal.timeout(10000),
    })
    const text = await response.text()
    return result("youtube-rss", {
      status: response.ok ? "ok" : "error",
      configured: true,
      httpStatus: response.status,
      count: response.ok ? [...text.matchAll(/<entry>/g)].length : 0,
      mode: "live",
      message: response.ok ? undefined : `YouTube RSS returned ${response.status}`,
    })
  } catch (error) {
    return result("youtube-rss", { status: "error", configured: true, mode: "live", message: safeMessage(error) })
  }
}

async function checkYouTubeData() {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return missing("youtube-data-api")

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems")
    url.searchParams.set("part", "contentDetails")
    url.searchParams.set("playlistId", YOUTUBE_UPLOADS_PLAYLIST_ID)
    url.searchParams.set("maxResults", "1")
    url.searchParams.set("key", key)
    const { response, body } = await jsonFetch(url, { headers: { "user-agent": "InvertedWorldProviderHealth/1.0" } })
    return result("youtube-data-api", {
      status: response.ok ? "ok" : "error",
      configured: true,
      httpStatus: response.status,
      count: body?.items?.length || 0,
      mode: "live",
      message: response.ok ? undefined : `YouTube Data API returned ${response.status}`,
    })
  } catch (error) {
    return result("youtube-data-api", { status: "error", configured: true, mode: "live", message: safeMessage(error) })
  }
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")
  loadEnvFile(LOCAL_PROVIDER_ENV)

  const startedAt = Date.now()
  const providers = [
    ...(await Promise.all([
      checkRecursivDatabase(),
      checkXApi(),
      checkExa(),
      checkBrave(),
      checkYouTubeRss(),
      checkYouTubeData(),
    ])),
    configuredOnly("firecrawl", Boolean(process.env.FIRECRAWL_API_KEY)),
    configuredOnly("jina", Boolean(process.env.JINA_API_KEY)),
    configuredOnly("openai", Boolean(process.env.OPENAI_API_KEY)),
    configuredOnly("xai", Boolean(process.env.XAI_API_KEY)),
    configuredOnly("replicate", Boolean(process.env.REPLICATE_API_TOKEN || process.env.IMAGE_GENERATION_API_KEY)),
    configuredOnly("courtlistener", Boolean(process.env.COURTLISTENER_API_TOKEN)),
    configuredOnly("documentcloud", Boolean(process.env.DOCUMENTCLOUD_API_TOKEN)),
    configuredOnly("newsapi", Boolean(process.env.NEWS_API_KEY)),
    configuredOnly("cron-secret", Boolean(process.env.CRON_SECRET)),
    configuredOnly("recursiv-agent", Boolean(process.env.RECURSIV_AGENT_ID)),
  ]
  const summary = providers.reduce(
    (counts, item) => {
      counts[item.status] += 1
      return counts
    },
    { ok: 0, missing: 0, error: 0 },
  )

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, summary, providers }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
