import { createRecursivServerClient } from "@/lib/recursiv/client"
import { getRecursivRuntimeConfig } from "@/lib/recursiv/config"
import { INVERTED_WORLD_SCHEMA_SQL, INVERTED_WORLD_TABLES } from "@/lib/recursiv/schema"

export type RecursivRow = Record<string, unknown>

const PUBLIC_READ_TIMEOUT_MS = Math.max(
  1000,
  Math.min(Math.trunc(Number(process.env.RECURSIV_PUBLIC_READ_TIMEOUT_MS || "12000")) || 12000, 15000),
)
const PUBLIC_READ_CACHE_MS = Math.max(
  0,
  Math.min(Math.trunc(Number(process.env.RECURSIV_PUBLIC_READ_CACHE_MS || "60000")) || 60000, 5 * 60 * 1000),
)
const PUBLIC_READ_STALE_MS = Math.max(
  PUBLIC_READ_CACHE_MS,
  Math.min(Math.trunc(Number(process.env.RECURSIV_PUBLIC_READ_STALE_MS || "900000")) || 900000, 60 * 60 * 1000),
)

type CachedRead = {
  rows: RecursivRow[]
  cachedAt: number
}

type PublicReadHealth = {
  status: "ok" | "missing-config" | "rate-limited" | "backoff" | "error"
  retryAfterSeconds?: number
  backoffUntil?: string
  lastErrorStatus?: number
  lastErrorKind?: string
  lastErrorAt?: string
}

const publicReadCache = new Map<string, CachedRead>()
const publicReadInflight = new Map<string, Promise<RecursivRow[] | null>>()
let publicReadBackoffUntil = 0
let publicReadHealth: PublicReadHealth = { status: "ok" }

function publicReadCacheKey(projectId: string, databaseName: string, sql: string, params: unknown[]) {
  return JSON.stringify([projectId, databaseName, sql, params])
}

function getCachedRows(key: string, maxAgeMs: number) {
  const cached = publicReadCache.get(key)
  if (!cached || Date.now() - cached.cachedAt > maxAgeMs) return null
  return cached.rows
}

function rateLimitBackoffMs(error: unknown) {
  if (!(error instanceof Error)) return 0
  const details = error as Error & { status?: number; retryAfter?: number }
  if (details.status !== 429) return 0
  const retryAfter = Number(details.retryAfter)
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 60 * 60 * 1000)
  return 5 * 60 * 1000
}

function publicReadErrorStatus(error: unknown) {
  return error instanceof Error ? (error as Error & { status?: number }).status : undefined
}

function publicReadErrorKind(error: unknown) {
  const status = publicReadErrorStatus(error)
  if (status === 429) return "rate_limited"
  if (status) return `http_${status}`
  return "request_failed"
}

export function getRecursivPublicReadHealth(): PublicReadHealth {
  if (Date.now() < publicReadBackoffUntil) {
    return {
      ...publicReadHealth,
      status: "backoff",
      retryAfterSeconds: Math.max(1, Math.ceil((publicReadBackoffUntil - Date.now()) / 1000)),
      backoffUntil: new Date(publicReadBackoffUntil).toISOString(),
    }
  }
  return publicReadHealth
}

function handlePublicReadError<T extends RecursivRow>(cacheKey: string, error: unknown) {
  const backoffMs = rateLimitBackoffMs(error)
  if (backoffMs > 0) publicReadBackoffUntil = Math.max(publicReadBackoffUntil, Date.now() + backoffMs)
  publicReadHealth = {
    status: backoffMs > 0 ? "rate-limited" : "error",
    retryAfterSeconds: backoffMs > 0 ? Math.ceil(backoffMs / 1000) : undefined,
    backoffUntil: backoffMs > 0 ? new Date(Date.now() + backoffMs).toISOString() : undefined,
    lastErrorStatus: publicReadErrorStatus(error),
    lastErrorKind: publicReadErrorKind(error),
    lastErrorAt: new Date().toISOString(),
  }
  const staleRows = getCachedRows(cacheKey, PUBLIC_READ_STALE_MS)
  if (staleRows) return staleRows as T[]
  if (process.env.RECURSIV_STRICT_READS === "1") throw error
  console.warn("[recursiv] database read skipped:", error instanceof Error ? error.message : String(error))
  return null
}

export async function queryInvertedWorldDatabase<T extends RecursivRow = RecursivRow>(
  sql: string,
  params: unknown[] = [],
) {
  const config = getRecursivRuntimeConfig()
  if (!config.apiKey || !config.projectId) {
    publicReadHealth = { status: "missing-config", lastErrorAt: new Date().toISOString() }
    return null
  }
  const projectId = config.projectId
  const cacheKey = publicReadCacheKey(projectId, config.databaseName, sql, params)
  const cachedRows = getCachedRows(cacheKey, PUBLIC_READ_CACHE_MS)
  if (cachedRows) return cachedRows as T[]
  if (Date.now() < publicReadBackoffUntil) {
    const staleRows = getCachedRows(cacheKey, PUBLIC_READ_STALE_MS)
    return (staleRows as T[] | null) ?? null
  }

  const inflight = publicReadInflight.get(cacheKey)
  if (inflight) {
    try {
      return (await inflight) as T[] | null
    } catch (error) {
      return handlePublicReadError<T>(cacheKey, error)
    }
  }

  const readPromise = (async () => {
    const { sdk } = createRecursivServerClient({ maxRetries: 0, timeout: PUBLIC_READ_TIMEOUT_MS })
    const { data } = await sdk.databases.query({
      project_id: projectId,
      database_name: config.databaseName,
      sql,
      params,
    })
    const rows = (data.rows || []) as RecursivRow[]
    if (PUBLIC_READ_CACHE_MS > 0) publicReadCache.set(cacheKey, { rows, cachedAt: Date.now() })
    publicReadHealth = { status: "ok" }
    return rows
  })()

  publicReadInflight.set(cacheKey, readPromise)

  try {
    return (await readPromise) as T[]
  } catch (error) {
    return handlePublicReadError<T>(cacheKey, error)
  } finally {
    publicReadInflight.delete(cacheKey)
  }
}

export async function provisionInvertedWorldDatabase(options: { allowDeveloperApiKey?: boolean } = {}) {
  const { sdk, config } = createRecursivServerClient({
    allowDeveloperApiKey: options.allowDeveloperApiKey,
    timeout: 120000,
  })

  await sdk.databases.ensure({
    project_id: config.projectId,
    name: config.databaseName,
  })

  for (const sql of INVERTED_WORLD_SCHEMA_SQL) {
    await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql,
    })
  }

  return {
    projectId: config.projectId,
    databaseName: config.databaseName,
    tableCount: INVERTED_WORLD_TABLES.length,
  }
}
