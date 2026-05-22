import fs from "node:fs"
import { Recursiv } from "@recursiv/sdk"

const LOCAL_PROVIDER_ENV = "/private/tmp/inverted-world-api-keys.env"
const LOCAL_RECURSIV_KEY = "/private/tmp/inverted-world-recursiv-key"
const LOCAL_CRON_SECRET = "/private/tmp/inverted-world-cron-secret"
const DEFAULT_BASE_URL = "https://api.recursiv.io/api/v1"
const DEFAULT_SITE_URL = "https://invertedworld.on.recursiv.io"
const DEFAULT_DATABASE_NAME = "inverted_world_research"

const PROVIDERS = [
  {
    provider: "recursiv-database",
    required: true,
    aliases: ["RECURSIV_SERVER_API_KEY", "RECURSIV_API_KEY", "SOCIAL_DEV_API_KEY"],
    action: "Set RECURSIV_SERVER_API_KEY in Recursiv runtime and keep local proof keys in protected files.",
  },
  {
    provider: "x-api",
    required: true,
    aliases: ["X_BEARER_TOKEN", "X_API_BEARER_TOKEN", "TWITTER_BEARER_TOKEN", "TWITTER_API_BEARER_TOKEN"],
    action: "Fix X paid API access or rotate the bearer token, then store it in Recursiv/Infisical.",
  },
  {
    provider: "exa",
    required: true,
    aliases: ["EXA_API_KEY", "EXA_SEARCH_API_KEY"],
    action: "Store EXA_API_KEY in Recursiv/Infisical for source discovery.",
  },
  {
    provider: "brave-search",
    required: false,
    aliases: ["BRAVE_SEARCH_API_KEY", "BRAVE_API_KEY", "BRAVE_SEARCH_KEY"],
    action: "Add BRAVE_SEARCH_API_KEY as the public-web and X-indexed fallback.",
  },
  {
    provider: "youtube-rss",
    required: true,
    aliases: [],
    action: "No key needed; this should work from the hosted runtime.",
  },
  {
    provider: "youtube-data-api",
    required: true,
    aliases: ["YOUTUBE_API_KEY"],
    action: "Enable YouTube Data API for the key, fix restrictions/quota, then store YOUTUBE_API_KEY in Recursiv/Infisical.",
  },
  {
    provider: "firecrawl",
    required: true,
    aliases: ["FIRECRAWL_API_KEY"],
    action: "Store FIRECRAWL_API_KEY in Recursiv/Infisical for source extraction.",
  },
  {
    provider: "jina",
    required: false,
    aliases: ["JINA_API_KEY"],
    action: "Store JINA_API_KEY as the source-extraction fallback.",
  },
  {
    provider: "openai",
    required: true,
    aliases: ["OPENAI_API_KEY", "OPENROUTER_API_KEY"],
    action: "Store the production model key in Recursiv/Infisical for generation and chat.",
  },
  {
    provider: "xai",
    required: false,
    aliases: ["XAI_API_KEY"],
    action: "Optional: add XAI_API_KEY if it becomes a preferred generation or research provider.",
  },
  {
    provider: "replicate",
    required: false,
    aliases: ["REPLICATE_API_TOKEN", "IMAGE_GENERATION_API_KEY"],
    action: "Optional: add an image-generation provider for richer thumbnails.",
  },
  {
    provider: "courtlistener",
    required: false,
    aliases: ["COURTLISTENER_API_TOKEN"],
    action: "Optional: add CourtListener for legal/court-record enrichment.",
  },
  {
    provider: "documentcloud",
    required: false,
    aliases: ["DOCUMENTCLOUD_API_TOKEN"],
    action: "Optional: add DocumentCloud for document-library enrichment.",
  },
  {
    provider: "newsapi",
    required: false,
    aliases: ["NEWS_API_KEY"],
    action: "Optional: add NewsAPI if Google News/Exa coverage needs another source.",
  },
  {
    provider: "cron-secret",
    required: true,
    aliases: ["CRON_SECRET"],
    action: "Set CRON_SECRET in Recursiv runtime and scheduled job handlers.",
  },
  {
    provider: "recursiv-agent",
    required: true,
    aliases: ["RECURSIV_AGENT_ID"],
    action: "Set RECURSIV_AGENT_ID so hosted generation/chat uses the configured research desk agent.",
  },
]

const PROTECTED_LOCAL_FILES = {
  "recursiv-database": LOCAL_RECURSIV_KEY,
  "cron-secret": LOCAL_CRON_SECRET,
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

function readFileIfPresent(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : ""
}

function readRecursivKey() {
  return (
    readFileIfPresent(process.env.RECURSIV_API_KEY_FILE || "") ||
    readFileIfPresent(LOCAL_RECURSIV_KEY) ||
    process.env.RECURSIV_SERVER_API_KEY ||
    process.env.RECURSIV_API_KEY ||
    process.env.SOCIAL_DEV_API_KEY ||
    ""
  )
}

function presentAliases(aliases) {
  return aliases.filter((alias) => Boolean(process.env[alias]))
}

function protectedLocalFilePresent(provider) {
  const file = PROTECTED_LOCAL_FILES[provider]
  return Boolean(file && fs.existsSync(file) && readFileIfPresent(file))
}

function providerAction(provider, localConfigured, hosted) {
  if (hosted?.status === "ok") return "ready"
  const template = PROVIDERS.find((item) => item.provider === provider)
  if (hosted?.status === "error") return template?.action || "Fix the provider error in the hosted runtime."
  if (localConfigured && hosted?.status === "missing") {
    return `Copy ${presentAliases(template?.aliases || []).join(" or ")} into Recursiv/Infisical runtime.`
  }
  return template?.action || "Configure this provider before relying on it in production."
}

async function fetchHostedHealthFromDatabase(sdk, projectId, databaseName) {
  const { data } = await sdk.databases.query({
    project_id: projectId,
    database_name: databaseName,
    sql: `SELECT status, completed_at, duration_ms, results, metadata
      FROM pipeline_runs
      WHERE job_name = 'provider-health'
      ORDER BY completed_at DESC NULLS LAST, started_at DESC
      LIMIT 1`,
  })
  return data.rows?.[0] || null
}

async function runHostedHealth(siteUrl) {
  const secret = process.env.CRON_SECRET || readFileIfPresent(LOCAL_CRON_SECRET)
  if (!secret) return null
  const response = await fetch(new URL("/api/recursiv/jobs/provider-health?proof=readiness", siteUrl), {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(120000),
  })
  const body = await response.json().catch(() => ({}))
  return {
    statusCode: response.status,
    ok: response.ok,
    status: body.summary?.error ? "degraded" : "succeeded",
    completed_at: new Date().toISOString(),
    duration_ms: body.durationMs,
    results: body.providers || [],
    metadata: { summary: body.summary, generatedAt: body.generatedAt },
  }
}

function normalizeHostedRow(row) {
  if (!row) return null
  const providers = Array.isArray(row.results) ? row.results : []
  return {
    status: row.status,
    completedAt: row.completed_at,
    durationMs: Number(row.duration_ms || 0),
    summary: row.metadata?.summary || {},
    providers,
  }
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")
  loadEnvFile(LOCAL_PROVIDER_ENV)

  const apiKey = readRecursivKey()
  const projectId = process.env.RECURSIV_PROJECT_ID
  const databaseName = process.env.RECURSIV_DATABASE_NAME || DEFAULT_DATABASE_NAME
  const siteUrl = process.env.INVERTED_WORLD_SITE_URL || DEFAULT_SITE_URL
  if (!apiKey || !projectId) throw new Error("Missing Recursiv project id or API key for readiness check")

  const sdk = new Recursiv({
    apiKey,
    baseUrl: process.env.RECURSIV_BASE_URL || DEFAULT_BASE_URL,
    timeout: 120000,
    maxRetries: 1,
  })

  const hostedRow = process.argv.includes("--run-hosted")
    ? await runHostedHealth(siteUrl)
    : await fetchHostedHealthFromDatabase(sdk, projectId, databaseName)
  const hosted = normalizeHostedRow(hostedRow)
  const hostedByProvider = new Map((hosted?.providers || []).map((item) => [item.provider, item]))

  const providers = PROVIDERS.map((template) => {
    const hostedProvider = hostedByProvider.get(template.provider)
    const aliasesPresent = presentAliases(template.aliases)
    const localProtectedFilePresent = protectedLocalFilePresent(template.provider)
    const localConfigured = template.aliases.length
      ? aliasesPresent.length > 0 || localProtectedFilePresent
      : template.provider === "youtube-rss" || localProtectedFilePresent
    return {
      provider: template.provider,
      required: template.required,
      localConfigured,
      localAliasesPresent: aliasesPresent,
      localProtectedFilePresent,
      hostedStatus: hostedProvider?.status || "unknown",
      hostedConfigured: hostedProvider?.configured,
      hostedHttpStatus: hostedProvider?.httpStatus,
      hostedCount: hostedProvider?.count,
      hostedMode: hostedProvider?.mode,
      hostedMessage: hostedProvider?.message,
      action: providerAction(template.provider, localConfigured, hostedProvider),
    }
  })

  const blocking = providers.filter((item) => item.required && item.hostedStatus !== "ok")
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        siteUrl,
        localProviderEnv: {
          path: LOCAL_PROVIDER_ENV,
          exists: fs.existsSync(LOCAL_PROVIDER_ENV),
        },
        hostedProviderHealth: hosted
          ? {
              status: hosted.status,
              completedAt: hosted.completedAt,
              durationMs: hosted.durationMs,
              summary: hosted.summary,
            }
          : null,
        blockingCount: blocking.length,
        blockingProviders: blocking.map((item) => item.provider),
        providers,
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
