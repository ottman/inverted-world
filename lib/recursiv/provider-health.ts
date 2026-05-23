import { channelProfile } from "@/data/inverted-world"
import { createRecursivServerClient } from "@/lib/recursiv/client"
import { getRecursivRuntimeConfig } from "@/lib/recursiv/config"
import { getYouTubeApiKey } from "@/lib/youtube-config"

type ProviderStatus = "ok" | "missing" | "error"

export type ProviderHealthResult = {
  provider: string
  status: ProviderStatus
  configured: boolean
  checkedAt: string
  httpStatus?: number
  count?: number
  mode?: "live" | "configured-only"
  message?: string
}

export type ProviderHealthReport = {
  generatedAt: string
  durationMs: number
  summary: {
    ok: number
    missing: number
    error: number
  }
  providers: ProviderHealthResult[]
}

const PROVIDER_HEALTH_TIMEOUT_MS = 10000

function envAny(names: string[]) {
  return names.map((name) => process.env[name]).find(Boolean)
}

function now() {
  return new Date().toISOString()
}

function missing(provider: string): ProviderHealthResult {
  return {
    provider,
    status: "missing",
    configured: false,
    checkedAt: now(),
  }
}

function configuredOnly(provider: string, configured: boolean): ProviderHealthResult {
  return {
    provider,
    status: configured ? "ok" : "missing",
    configured,
    checkedAt: now(),
    mode: "configured-only",
  }
}

function safeMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 160)
  return String(error).slice(0, 160)
}

function textField(value: unknown) {
  return typeof value === "string" ? value : ""
}

function sanitizeProviderMessage(value: string) {
  return value
    .replace(/\[[0-9]{8,}\]/g, "[redacted-id]")
    .replace(/\b[0-9]{12,}\b/g, "[redacted-id]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
}

function providerErrorMessage(provider: string, status: number, body: unknown) {
  const data = body as
    | {
        title?: string
        detail?: string
        errors?: Array<{ title?: string; detail?: string; message?: string; reason?: string }>
        error?: { message?: string; status?: string; errors?: Array<{ reason?: string; message?: string }> }
      }
    | undefined
  const parts = [
    `${provider} returned ${status}`,
    textField(data?.title),
    textField(data?.detail),
    textField(data?.errors?.[0]?.title),
    textField(data?.errors?.[0]?.detail),
    textField(data?.errors?.[0]?.message),
    textField(data?.errors?.[0]?.reason),
    textField(data?.error?.status),
    textField(data?.error?.message),
    textField(data?.error?.errors?.[0]?.reason),
    textField(data?.error?.errors?.[0]?.message),
  ].filter(Boolean)

  return sanitizeProviderMessage(Array.from(new Set(parts)).join(" / ")).slice(0, 220)
}

async function jsonFetch(url: string | URL, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(PROVIDER_HEALTH_TIMEOUT_MS),
  })
  const text = await response.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : undefined
  } catch {
    body = undefined
  }

  return { response, body }
}

async function checkRecursivDatabase(): Promise<ProviderHealthResult> {
  const config = getRecursivRuntimeConfig()
  if (!config.apiKey || !config.projectId || !config.databaseName) return missing("recursiv-database")

  try {
    const { sdk } = createRecursivServerClient({ maxRetries: 0, timeout: PROVIDER_HEALTH_TIMEOUT_MS })
    const { data } = await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: "SELECT 1 AS ok",
    })

    return {
      provider: "recursiv-database",
      status: data.rows?.length ? "ok" : "error",
      configured: true,
      checkedAt: now(),
      count: data.rows?.length || 0,
      mode: "live",
    }
  } catch (error) {
    return {
      provider: "recursiv-database",
      status: "error",
      configured: true,
      checkedAt: now(),
      mode: "live",
      message: safeMessage(error),
    }
  }
}

async function checkXApi(): Promise<ProviderHealthResult> {
  const token = envAny(["X_BEARER_TOKEN", "X_API_BEARER_TOKEN", "TWITTER_BEARER_TOKEN", "TWITTER_API_BEARER_TOKEN"])
  if (!token) return missing("x-api")

  try {
    const url = new URL("https://api.twitter.com/2/tweets/search/recent")
    url.searchParams.set("query", "from:InvertedTales lang:en -is:retweet -is:reply")
    url.searchParams.set("max_results", "10")
    url.searchParams.set("tweet.fields", "created_at")
    const { response, body } = await jsonFetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        "user-agent": "InvertedWorldProviderHealth/1.0",
      },
    })
    const count = Array.isArray((body as { data?: unknown[] } | undefined)?.data)
      ? ((body as { data?: unknown[] }).data || []).length
      : 0

    return {
      provider: "x-api",
      status: response.ok ? "ok" : "error",
      configured: true,
      checkedAt: now(),
      httpStatus: response.status,
      count,
      mode: "live",
      message: response.ok ? undefined : providerErrorMessage("X API", response.status, body),
    }
  } catch (error) {
    return {
      provider: "x-api",
      status: "error",
      configured: true,
      checkedAt: now(),
      mode: "live",
      message: safeMessage(error),
    }
  }
}

async function checkExa(): Promise<ProviderHealthResult> {
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
      body: JSON.stringify({
        query: "Inverted World source documents",
        type: "auto",
        numResults: 3,
      }),
    })
    const count = Array.isArray((body as { results?: unknown[] } | undefined)?.results)
      ? ((body as { results?: unknown[] }).results || []).length
      : 0

    return {
      provider: "exa",
      status: response.ok ? "ok" : "error",
      configured: true,
      checkedAt: now(),
      httpStatus: response.status,
      count,
      mode: "live",
      message: response.ok ? undefined : providerErrorMessage("Exa", response.status, body),
    }
  } catch (error) {
    return {
      provider: "exa",
      status: "error",
      configured: true,
      checkedAt: now(),
      mode: "live",
      message: safeMessage(error),
    }
  }
}

async function checkBrave(): Promise<ProviderHealthResult> {
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
    const count = Array.isArray((body as { web?: { results?: unknown[] } } | undefined)?.web?.results)
      ? ((body as { web?: { results?: unknown[] } }).web?.results || []).length
      : 0

    return {
      provider: "brave-search",
      status: response.ok ? "ok" : "error",
      configured: true,
      checkedAt: now(),
      httpStatus: response.status,
      count,
      mode: "live",
      message: response.ok ? undefined : providerErrorMessage("Brave", response.status, body),
    }
  } catch (error) {
    return {
      provider: "brave-search",
      status: "error",
      configured: true,
      checkedAt: now(),
      mode: "live",
      message: safeMessage(error),
    }
  }
}

async function checkYouTubeRss(): Promise<ProviderHealthResult> {
  try {
    const response = await fetch(channelProfile.youtubeRssUrl, {
      headers: { "user-agent": "InvertedWorldProviderHealth/1.0" },
      signal: AbortSignal.timeout(PROVIDER_HEALTH_TIMEOUT_MS),
    })
    const text = await response.text()
    const count = response.ok ? [...text.matchAll(/<entry>/g)].length : 0

    return {
      provider: "youtube-rss",
      status: response.ok ? "ok" : "error",
      configured: true,
      checkedAt: now(),
      httpStatus: response.status,
      count,
      mode: "live",
      message: response.ok ? undefined : `YouTube RSS returned ${response.status}`,
    }
  } catch (error) {
    return {
      provider: "youtube-rss",
      status: "error",
      configured: true,
      checkedAt: now(),
      mode: "live",
      message: safeMessage(error),
    }
  }
}

async function checkYouTubeData(): Promise<ProviderHealthResult> {
  const key = getYouTubeApiKey()
  if (!key) return missing("youtube-data-api")

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems")
    url.searchParams.set("part", "contentDetails")
    url.searchParams.set("playlistId", channelProfile.youtubeUploadsPlaylistId)
    url.searchParams.set("maxResults", "1")
    url.searchParams.set("key", key)
    const { response, body } = await jsonFetch(url, {
      headers: { "user-agent": "InvertedWorldProviderHealth/1.0" },
    })
    const count = Array.isArray((body as { items?: unknown[] } | undefined)?.items)
      ? ((body as { items?: unknown[] }).items || []).length
      : 0

    return {
      provider: "youtube-data-api",
      status: response.ok ? "ok" : "error",
      configured: true,
      checkedAt: now(),
      httpStatus: response.status,
      count,
      mode: "live",
      message: response.ok ? undefined : providerErrorMessage("YouTube Data API", response.status, body),
    }
  } catch (error) {
    return {
      provider: "youtube-data-api",
      status: "error",
      configured: true,
      checkedAt: now(),
      mode: "live",
      message: safeMessage(error),
    }
  }
}

function checkConfiguredProviders() {
  return [
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
}

export async function runProviderHealthCheck(options: { persist?: boolean } = {}): Promise<ProviderHealthReport> {
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
    ...checkConfiguredProviders(),
  ]
  const summary = providers.reduce(
    (counts, item) => {
      counts[item.status] += 1
      return counts
    },
    { ok: 0, missing: 0, error: 0 },
  )
  const report = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    summary,
    providers,
  }

  if (options.persist) await persistProviderHealthReport(report)
  return report
}

async function persistProviderHealthReport(report: ProviderHealthReport) {
  const config = getRecursivRuntimeConfig()
  if (!config.apiKey || !config.projectId || !config.databaseName) return

  const { sdk } = createRecursivServerClient({ timeout: 120000 })
  await sdk.databases.query({
    project_id: config.projectId,
    database_name: config.databaseName,
    sql: `INSERT INTO pipeline_runs (job_name, status, completed_at, duration_ms, results, metadata)
      VALUES ('provider-health', $1, now(), $2, $3::jsonb, $4::jsonb)`,
    params: [
      report.summary.error ? "degraded" : "succeeded",
      report.durationMs,
      JSON.stringify(report.providers),
      JSON.stringify({ summary: report.summary, generatedAt: report.generatedAt }),
    ],
  })
}
