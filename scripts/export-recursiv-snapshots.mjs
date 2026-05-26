import { spawn } from "node:child_process"
import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import { Recursiv } from "@recursiv/sdk"

const NEWS_SNAPSHOT_FILE = path.resolve("data/generated/recursiv-news-snapshot.json")
const PUBLIC_SNAPSHOT_FILE = path.resolve("data/generated/recursiv-public-snapshot.json")
const DEFAULT_DATABASE_URL_FILE = "/private/tmp/inverted-world-database-url"
const DEFAULT_SNAPSHOT_MAX_AGE_HOURS = 8
const DEFAULT_RECURSIV_BASE_URL = "https://api.recursiv.io/api/v1"
const DEFAULT_RECURSIV_DATABASE_NAME = "inverted_world_research"
const LOCAL_RECURSIV_KEY = "/private/tmp/inverted-world-recursiv-key"
const RECURSIV_API_TIMEOUT_MS = Math.max(
  5000,
  Math.min(Math.trunc(Number(process.env.RECURSIV_SNAPSHOT_API_TIMEOUT_MS || "30000")) || 30000, 120000),
)

const NEWS_EXPORTS = [
  {
    key: "channelItems",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.published_at DESC NULLS LAST, export_row.created_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          id,
          source,
          source_id,
          source_url,
          title,
          description,
          published_at,
          topic_id,
          thumbnail_url,
          embed_url,
          kind,
          metadata,
          created_at,
          updated_at
        FROM channel_items
        WHERE source = 'youtube'
      ) export_row`,
  },
  {
    key: "xSignals",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.score DESC NULLS LAST, export_row.posted_at DESC NULLS LAST, export_row.captured_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          x_id,
          url,
          text,
          topic_id,
          author_name,
          username,
          posted_at,
          captured_at,
          source,
          score,
          metrics,
          metadata
        FROM x_signals
      ) export_row`,
  },
  {
    key: "articleDrafts",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.published_at DESC NULLS LAST, export_row.generated_at DESC NULLS LAST, export_row.created_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          a.id,
          a.slug,
          a.title,
          a.deck,
          a.topic_id,
          a.status,
          a.body,
          a.source_ids,
          a.source_name,
          a.source_url,
          a.heat,
          a.thumbnail_asset_id,
          a.thumbnail_prompt,
          ga.url AS asset_url,
          a.model,
          a.prompt_version,
          a.generated_at,
          a.published_at,
          a.metadata,
          a.created_at,
          a.updated_at
        FROM article_drafts a
        LEFT JOIN generated_assets ga ON ga.id = a.thumbnail_asset_id
        WHERE a.status = 'published'
      ) export_row`,
  },
  {
    key: "claimDossiers",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.x_velocity_score DESC NULLS LAST, export_row.published_at DESC NULLS LAST, export_row.updated_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          id,
          slug,
          title,
          deck,
          topic_id,
          claim,
          summary,
          status,
          evidence_grade,
          confidence_score,
          x_velocity_score,
          source_count,
          x_signal_count,
          related_video_count,
          source_links,
          x_signals,
          related_videos,
          weird_read,
          skeptical_read,
          viral_headlines,
          chat_prompt,
          generated_at,
          published_at,
          metadata,
          created_at,
          updated_at
        FROM claim_dossiers
        WHERE status = 'published'
      ) export_row`,
  },
  {
    key: "frontPageEditions",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.edition_date DESC, export_row.published_at DESC NULLS LAST, export_row.generated_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          id,
          slug,
          edition_date,
          headline,
          deck,
          status,
          lead_dossier_slug,
          sections,
          metrics,
          generated_at,
          published_at,
          metadata,
          created_at,
          updated_at
        FROM front_page_editions
        WHERE status = 'published'
      ) export_row`,
  },
  {
    key: "pipelineRuns",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.started_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          id,
          job_name,
          status,
          started_at,
          completed_at,
          duration_ms,
          results,
          error,
          metadata,
          created_at,
          updated_at
        FROM pipeline_runs
        ORDER BY started_at DESC
        LIMIT 100
      ) export_row`,
  },
  {
    key: "coverageSnapshots",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.captured_at DESC), '[]'::jsonb)::text
      FROM (
        SELECT
          id,
          topic_id,
          query,
          source,
          captured_at,
          items,
          official_records,
          summary,
          velocity_score,
          metadata,
          created_at
        FROM coverage_snapshots
        ORDER BY captured_at DESC
        LIMIT 500
      ) export_row`,
  },
]

const PUBLIC_EXPORTS = [
  {
    key: "mediaItems",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.published_at DESC NULLS LAST, export_row.updated_at DESC NULLS LAST, export_row.title), '[]'::jsonb)::text
      FROM (
        SELECT
          slug,
          title,
          source,
          source_url,
          kind,
          viewer,
          topic_ids,
          summary,
          published_at,
          embed_url,
          thumbnail_url,
          file_type,
          agency,
          collection,
          status,
          metadata,
          created_at,
          updated_at
        FROM media_items
        WHERE status = 'active'
      ) export_row`,
  },
  {
    key: "sourceDocuments",
    sql: `SELECT COALESCE(jsonb_agg(to_jsonb(export_row) ORDER BY export_row.kind, export_row.title), '[]'::jsonb)::text
      FROM (
        SELECT
          id,
          slug,
          title,
          source,
          url,
          host,
          kind,
          topic_ids,
          status,
          metadata,
          created_at,
          updated_at
        FROM source_documents
        WHERE status = 'active'
      ) export_row`,
  },
]

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  const content = fs.readFileSync(file, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    const value = rawValue.replace(/^["']|["']$/g, "")
    if (!process.env[key] && value) process.env[key] = value
  }
}

function readOptionalFile(file) {
  if (!file || !fs.existsSync(file)) return ""
  return fs.readFileSync(file, "utf8").trim()
}

function argValue(name) {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (exact) return exact.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) return process.argv[index + 1]
  return undefined
}

function snapshotSource() {
  if (process.argv.includes("--recursiv-api")) return "recursiv-api"
  const value = String(argValue("--source") || process.env.RECURSIV_SNAPSHOT_SOURCE || "direct-db").trim().toLowerCase()
  if (["direct-db", "recursiv-api"].includes(value)) return value
  throw new Error("Unsupported snapshot source. Use --source=direct-db or --source=recursiv-api.")
}

function readRecursivApiKey() {
  const fileCandidates = [
    ["RECURSIV_API_KEY_FILE", process.env.RECURSIV_API_KEY_FILE],
    [LOCAL_RECURSIV_KEY, LOCAL_RECURSIV_KEY],
  ]
  for (const [source, file] of fileCandidates) {
    const value = readOptionalFile(file)
    if (value) return { value, source }
  }

  const envCandidates = [
    ["RECURSIV_SERVER_API_KEY", process.env.RECURSIV_SERVER_API_KEY],
    ["RECURSIV_API_KEY", process.env.RECURSIV_API_KEY],
    ["SOCIAL_DEV_API_KEY", process.env.SOCIAL_DEV_API_KEY],
  ]
  for (const [source, value] of envCandidates) {
    if (value) return { value, source }
  }

  throw new Error(`Missing Recursiv API key. Set RECURSIV_API_KEY_FILE, RECURSIV_SERVER_API_KEY, or write the key to ${LOCAL_RECURSIV_KEY}.`)
}

function recursivApiKeyStatus() {
  try {
    const key = readRecursivApiKey()
    return {
      available: true,
      keyAvailable: true,
      source: key.source,
    }
  } catch {
    return {
      available: false,
      keyAvailable: false,
      source: null,
    }
  }
}

function providerErrorDetails(error) {
  const detail = error instanceof Error ? error : new Error(String(error))
  const typed = detail
  const status = Number(typed.status || typed.response?.status || typed.cause?.status)
  const code = typed.code || typed.response?.data?.error?.code || typed.response?.data?.code
  const rawMessage =
    typed.response?.data?.error?.message ||
    typed.response?.data?.message ||
    typed.message ||
    "request failed"
  return {
    status: Number.isFinite(status) ? status : undefined,
    code: code ? String(code) : undefined,
    message: String(rawMessage).replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]").slice(0, 220),
  }
}

function mergeProbeError(result, error) {
  const detail = providerErrorDetails(error)
  if (detail.status && !result.lastErrorStatus) result.lastErrorStatus = detail.status
  if (detail.code && !result.lastErrorCode) result.lastErrorCode = detail.code
  if (detail.message && !result.lastErrorMessage) result.lastErrorMessage = detail.message
}

function recordProbeError(result, key, error) {
  const detail = providerErrorDetails(error)
  result[key] = detail
  mergeProbeError(result, error)
}

async function recursivApiCapabilityStatus(options = {}) {
  const keyStatus = recursivApiKeyStatus()
  const result = {
    ...keyStatus,
    probed: false,
    configured: keyStatus.keyAvailable,
    databaseListAvailable: false,
    databaseReady: false,
    queryAvailable: false,
    credentialsAvailable: false,
    usableForSnapshot: false,
    lastErrorStatus: undefined,
    lastErrorCode: undefined,
    lastErrorMessage: undefined,
    databaseListError: undefined,
    queryError: undefined,
    credentialsError: undefined,
  }

  if (!keyStatus.keyAvailable) return result
  if (options.probe === false) return result

  let config
  try {
    config = recursivApiConfig()
  } catch (error) {
    mergeProbeError(result, error)
    return result
  }

  result.probed = true
  result.projectId = config.projectId
  result.databaseName = config.databaseName

  const sdk = new Recursiv({
    apiKey: config.apiKey.value,
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
    maxRetries: 0,
  })

  try {
    const { data } = await sdk.databases.list({ project_id: config.projectId })
    const databases = Array.isArray(data) ? data : Array.isArray(data?.databases) ? data.databases : Array.isArray(data?.items) ? data.items : []
    const database = databases.find((item) => item?.name === config.databaseName)
    result.databaseListAvailable = true
    result.databaseReady = Boolean(database && (!database.status || database.status === "ready"))
    result.databaseStatus = database?.status || null
  } catch (error) {
    recordProbeError(result, "databaseListError", error)
  }

  try {
    await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: "SELECT 1 AS ok",
      params: [],
    })
    result.queryAvailable = true
  } catch (error) {
    recordProbeError(result, "queryError", error)
  }

  if (typeof sdk.databases.getCredentials === "function") {
    try {
      await sdk.databases.getCredentials({
        project_id: config.projectId,
        name: config.databaseName,
      })
      result.credentialsAvailable = true
    } catch (error) {
      recordProbeError(result, "credentialsError", error)
    }
  }

  result.usableForSnapshot = Boolean(result.queryAvailable)
  return result
}

function readDatabaseUrl() {
  const explicitEnvCandidates = [
    ["RECURSIV_DATABASE_URL", process.env.RECURSIV_DATABASE_URL],
    ["RECURSIV_DIRECT_DATABASE_URL", process.env.RECURSIV_DIRECT_DATABASE_URL],
    ["INVERTED_WORLD_DATABASE_URL", process.env.INVERTED_WORLD_DATABASE_URL],
  ]
  for (const [source, value] of explicitEnvCandidates) {
    if (value) return { value, source }
  }

  const fileCandidates = [
    ["RECURSIV_DATABASE_URL_FILE", process.env.RECURSIV_DATABASE_URL_FILE],
    ["DATABASE_URL_FILE", process.env.DATABASE_URL_FILE],
    ["default database URL file", DEFAULT_DATABASE_URL_FILE],
  ]
  for (const [source, file] of fileCandidates) {
    const value = readOptionalFile(file)
    if (value) return { value, source }
  }

  const genericEnvCandidates = [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["POSTGRES_URL", process.env.POSTGRES_URL],
    ["RECURSIV_POSTGRES_URL", process.env.RECURSIV_POSTGRES_URL],
  ]
  for (const [source, value] of genericEnvCandidates) {
    if (value) return { value, source }
  }

  throw new Error(
    `Missing Recursiv database URL. Set RECURSIV_DATABASE_URL, RECURSIV_DATABASE_URL_FILE, or write the URL to ${DEFAULT_DATABASE_URL_FILE}.`,
  )
}

function recursivApiConfig() {
  const apiKey = readRecursivApiKey()
  const projectId = process.env.RECURSIV_PROJECT_ID || process.env.NEXT_PUBLIC_RECURSIV_PROJECT_ID
  const databaseName = process.env.RECURSIV_DATABASE_NAME || DEFAULT_RECURSIV_DATABASE_NAME
  if (!projectId) throw new Error("Missing RECURSIV_PROJECT_ID for Recursiv API snapshot export.")

  return {
    baseUrl: process.env.RECURSIV_BASE_URL || process.env.NEXT_PUBLIC_RECURSIV_BASE_URL || DEFAULT_RECURSIV_BASE_URL,
    apiKey,
    projectId,
    databaseName,
    timeoutMs: RECURSIV_API_TIMEOUT_MS,
  }
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function databaseConnectionEnv(databaseUrl) {
  const parsed = new URL(databaseUrl)
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("Recursiv database URL must use postgres:// or postgresql://")
  }

  const host = parsed.hostname
  const localHost = host === "localhost" || host === "127.0.0.1" || host === "::1"
  const sslMode = process.env.RECURSIV_DATABASE_SSLMODE || parsed.searchParams.get("sslmode") || (localHost ? "" : "require")

  const env = {
    ...process.env,
    PGHOST: host,
    PGPORT: parsed.port || "5432",
    PGDATABASE: safeDecode(parsed.pathname.replace(/^\//, "")),
    PGUSER: safeDecode(parsed.username),
    PGPASSWORD: safeDecode(parsed.password),
  }
  if (sslMode) env.PGSSLMODE = sslMode
  return env
}

function redact(value, databaseUrl) {
  let text = String(value || "")
  if (!databaseUrl) return text
  text = text.replaceAll(databaseUrl, "[redacted-database-url]")
  try {
    const parsed = new URL(databaseUrl)
    const password = safeDecode(parsed.password)
    const encodedPassword = parsed.password
    if (password) text = text.replaceAll(password, "[redacted]")
    if (encodedPassword) text = text.replaceAll(encodedPassword, "[redacted]")
  } catch {
    // Ignore malformed URLs here; the parser error is reported elsewhere.
  }
  return text
}

function runPsql(sql, databaseUrl) {
  const env = databaseConnectionEnv(databaseUrl)
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-qAt", "-c", sql], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(new Error("psql is required to export Recursiv snapshots. Install PostgreSQL client tools first."))
        return
      }
      reject(error)
    })
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim())
        return
      }
      const detail = redact(stderr || stdout || `psql exited with ${code}`, databaseUrl)
      reject(new Error(detail.slice(0, 1200)))
    })
  })
}

async function exportRows(exportSpec, databaseUrl) {
  const raw = await runPsql(exportSpec.sql, databaseUrl)
  const parsed = JSON.parse(raw || "[]")
  if (!Array.isArray(parsed)) throw new Error(`${exportSpec.key} export returned a non-array payload`)
  return parsed
}

async function runRecursivQuery(client, sql) {
  const response = await fetch(`${client.baseUrl.replace(/\/+$/, "")}/databases/query`, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${client.apiKey.value}`,
      "content-type": "application/json",
      "user-agent": "InvertedWorldSnapshotExport/1.0",
    },
    body: JSON.stringify({
      project_id: client.projectId,
      database_name: client.databaseName,
      sql,
    }),
    signal: AbortSignal.timeout(client.timeoutMs),
  })
  const text = await response.text()
  let body = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { text: text.slice(0, 220) }
  }

  if (!response.ok) {
    const message = body?.error?.message || body?.error || body?.message || response.statusText
    const error = new Error(`Recursiv query returned ${response.status}: ${message}`)
    error.status = response.status
    error.code = body?.error?.code
    throw error
  }

  return body
}

async function exportRowsFromRecursivApi(exportSpec, client) {
  const body = await runRecursivQuery(client, `SELECT (${exportSpec.sql}) AS payload`)
  const row = body?.data?.rows?.[0] || {}
  const raw = row.payload ?? Object.values(row)[0] ?? "[]"
  const parsed = typeof raw === "string" ? JSON.parse(raw || "[]") : raw
  if (!Array.isArray(parsed)) throw new Error(`${exportSpec.key} Recursiv API export returned a non-array payload`)
  return parsed
}

async function exportSnapshot(exportSpecs, source) {
  const snapshot = {
    source: source.type === "recursiv-api" ? "recursiv-database-api-export" : "recursiv-database-direct-export",
    generatedAt: new Date().toISOString(),
    exportedBy: "scripts/export-recursiv-snapshots.mjs",
  }

  for (const exportSpec of exportSpecs) {
    snapshot[exportSpec.key] =
      source.type === "recursiv-api"
        ? await exportRowsFromRecursivApi(exportSpec, source.client)
        : await exportRows(exportSpec, source.databaseUrl)
  }

  return snapshot
}

async function writeJson(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}

function snapshotCounts(snapshot) {
  return Object.fromEntries(
    Object.entries(snapshot)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, value.length]),
  )
}

function ageMinutes(value) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000))
}

function freshUntil(value, maxAgeHours) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN
  if (!Number.isFinite(timestamp)) return null
  return new Date(timestamp + maxAgeHours * 60 * 60 * 1000).toISOString()
}

function latestRun(snapshot, jobName) {
  const runs = Array.isArray(snapshot?.pipelineRuns) ? snapshot.pipelineRuns : []
  return runs
    .filter((run) => run?.job_name === jobName)
    .sort((left, right) => new Date(right.completed_at || right.started_at || 0).getTime() - new Date(left.completed_at || left.started_at || 0).getTime())[0]
}

function latestFrontPage(snapshot) {
  const editions = Array.isArray(snapshot?.frontPageEditions) ? snapshot.frontPageEditions : []
  return editions
    .filter((edition) => edition?.status === "published")
    .sort(
      (left, right) =>
        new Date(right.published_at || right.generated_at || right.edition_date || 0).getTime() -
        new Date(left.published_at || left.generated_at || left.edition_date || 0).getTime(),
    )[0]
}

function readSnapshot(file) {
  if (!fs.existsSync(file)) {
    return {
      file,
      exists: false,
      error: "missing",
    }
  }

  try {
    const snapshot = JSON.parse(fs.readFileSync(file, "utf8"))
    return {
      file,
      exists: true,
      snapshot,
    }
  } catch (error) {
    return {
      file,
      exists: true,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function databaseUrlStatus() {
  try {
    const databaseUrl = readDatabaseUrl()
    return {
      available: true,
      source: databaseUrl.source,
    }
  } catch {
    return {
      available: false,
      source: null,
    }
  }
}

async function snapshotStatus(options = {}) {
  const maxAgeHours =
    Math.trunc(Number(process.env.RECURSIV_SNAPSHOT_MAX_AGE_HOURS || process.env.CUTOVER_PIPELINE_MAX_AGE_HOURS || DEFAULT_SNAPSHOT_MAX_AGE_HOURS)) ||
    DEFAULT_SNAPSHOT_MAX_AGE_HOURS
  const news = readSnapshot(NEWS_SNAPSHOT_FILE)
  const publicSnapshot = readSnapshot(PUBLIC_SNAPSHOT_FILE)
  const latestFullPipeline = latestRun(news.snapshot, "full-pipeline")
  const latestProviderHealth = latestRun(news.snapshot, "provider-health")
  const frontPage = latestFrontPage(news.snapshot)
  const latestFullPipelineCompletedAt = latestFullPipeline?.completed_at || null
  const latestFullPipelineAgeMinutes = ageMinutes(latestFullPipelineCompletedAt)
  const pipelineFresh = latestFullPipelineAgeMinutes !== null && latestFullPipelineAgeMinutes <= maxAgeHours * 60
  const nextActions = []
  const database = databaseUrlStatus()
  const recursivApi = await recursivApiCapabilityStatus(options)

  if (!news.exists || news.error) nextActions.push("Regenerate the Recursiv news snapshot before relying on public fallback data.")
  if (!publicSnapshot.exists || publicSnapshot.error) nextActions.push("Regenerate the Recursiv public media/document snapshot before relying on public fallback data.")
  if (!pipelineFresh) nextActions.push(`Refresh the Recursiv news snapshot before the ${maxAgeHours} hour pipeline freshness gate can pass.`)
  if (!database.available) {
    nextActions.push(`No protected direct database URL was found; add it to ${DEFAULT_DATABASE_URL_FILE} or set RECURSIV_DATABASE_URL_FILE before running pnpm recursiv:snapshot.`)
    if (recursivApi.usableForSnapshot) {
      nextActions.push("After the Recursiv API cooldown clears, run pnpm recursiv:snapshot -- --source=recursiv-api to refresh through the database API without a direct Postgres URL.")
    } else if (recursivApi.keyAvailable) {
      nextActions.push("A Recursiv API key source exists, but the database query path is not proven usable. Repair the Recursiv database query/credentials path or add a protected direct database URL before refreshing the snapshot.")
    }
  } else if (!pipelineFresh) {
    nextActions.push("Run pnpm recursiv:snapshot to refresh committed Recursiv fallback data from the protected direct database connection.")
  }

  return {
    ok: Boolean(news.exists && !news.error && publicSnapshot.exists && !publicSnapshot.error && pipelineFresh),
    generatedAt: new Date().toISOString(),
    freshnessWindowHours: maxAgeHours,
    databaseUrl: database,
    recursivApi,
    news: {
      file: NEWS_SNAPSHOT_FILE,
      exists: news.exists,
      source: news.snapshot?.source,
      generatedAt: news.snapshot?.generatedAt,
      generatedAgeMinutes: ageMinutes(news.snapshot?.generatedAt),
      counts: news.snapshot ? snapshotCounts(news.snapshot) : {},
      latestFullPipeline: latestFullPipeline
        ? {
            status: latestFullPipeline.status,
            completedAt: latestFullPipelineCompletedAt,
            ageMinutes: latestFullPipelineAgeMinutes,
            fresh: pipelineFresh,
            freshUntil: freshUntil(latestFullPipelineCompletedAt, maxAgeHours),
            stepCount: Array.isArray(latestFullPipeline.results) ? latestFullPipeline.results.length : 0,
          }
        : null,
      latestProviderHealth: latestProviderHealth
        ? {
            status: latestProviderHealth.status,
            completedAt: latestProviderHealth.completed_at || null,
            ageMinutes: ageMinutes(latestProviderHealth.completed_at),
          }
        : null,
      frontPageEdition: frontPage
        ? {
            slug: frontPage.slug,
            editionDate: frontPage.edition_date,
            publishedAt: frontPage.published_at || null,
            headline: frontPage.headline,
          }
        : null,
      error: news.error,
    },
    public: {
      file: PUBLIC_SNAPSHOT_FILE,
      exists: publicSnapshot.exists,
      source: publicSnapshot.snapshot?.source,
      generatedAt: publicSnapshot.snapshot?.generatedAt,
      generatedAgeMinutes: ageMinutes(publicSnapshot.snapshot?.generatedAt),
      counts: publicSnapshot.snapshot ? snapshotCounts(publicSnapshot.snapshot) : {},
      error: publicSnapshot.error,
    },
    nextActions,
  }
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const flags = new Set(process.argv.slice(2))
  if (flags.has("--status")) {
    console.log(JSON.stringify(await snapshotStatus({ probe: !flags.has("--no-recursiv-probe") }), null, 2))
    return
  }

  const exportNews = !flags.has("--public-only")
  const exportPublic = !flags.has("--news-only")
  const dryRun = flags.has("--dry-run")
  const sourceMode = snapshotSource()
  if (!exportNews && !exportPublic) throw new Error("Nothing to export. Remove one of --news-only or --public-only.")

  const source =
    sourceMode === "recursiv-api"
      ? { type: "recursiv-api", client: recursivApiConfig() }
      : { type: "direct-db", databaseUrl: readDatabaseUrl().value }
  const result = {
    dryRun,
    source: source.type,
    databaseUrlSource: source.type === "direct-db" ? databaseUrlStatus().source : undefined,
    recursivApiKeySource: source.type === "recursiv-api" ? source.client.apiKey.source : undefined,
    projectId: source.type === "recursiv-api" ? source.client.projectId : undefined,
    databaseName: source.type === "recursiv-api" ? source.client.databaseName : undefined,
    written: [],
    wouldWrite: [],
    counts: {},
  }

  if (exportNews) {
    const snapshot = await exportSnapshot(NEWS_EXPORTS, source)
    if (dryRun) {
      result.wouldWrite.push(NEWS_SNAPSHOT_FILE)
    } else {
      await writeJson(NEWS_SNAPSHOT_FILE, snapshot)
      result.written.push(NEWS_SNAPSHOT_FILE)
    }
    result.counts.news = snapshotCounts(snapshot)
  }

  if (exportPublic) {
    const snapshot = await exportSnapshot(PUBLIC_EXPORTS, source)
    if (dryRun) {
      result.wouldWrite.push(PUBLIC_SNAPSHOT_FILE)
    } else {
      await writeJson(PUBLIC_SNAPSHOT_FILE, snapshot)
      result.written.push(PUBLIC_SNAPSHOT_FILE)
    }
    result.counts.public = snapshotCounts(snapshot)
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
