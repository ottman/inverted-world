import { createRecursivServerClient } from "@/lib/recursiv/client"
import { getRecursivRuntimeConfig } from "@/lib/recursiv/config"
import { INVERTED_WORLD_SCHEMA_SQL, INVERTED_WORLD_TABLES } from "@/lib/recursiv/schema"

export type RecursivRow = Record<string, unknown>

const PUBLIC_READ_TIMEOUT_MS = Math.max(
  1000,
  Math.min(Math.trunc(Number(process.env.RECURSIV_PUBLIC_READ_TIMEOUT_MS || "5000")) || 5000, 15000),
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

const publicReadCache = new Map<string, CachedRead>()
const publicReadInflight = new Map<string, Promise<RecursivRow[] | null>>()

function publicReadCacheKey(projectId: string, databaseName: string, sql: string, params: unknown[]) {
  return JSON.stringify([projectId, databaseName, sql, params])
}

function getCachedRows(key: string, maxAgeMs: number) {
  const cached = publicReadCache.get(key)
  if (!cached || Date.now() - cached.cachedAt > maxAgeMs) return null
  return cached.rows
}

export async function queryInvertedWorldDatabase<T extends RecursivRow = RecursivRow>(
  sql: string,
  params: unknown[] = [],
) {
  const config = getRecursivRuntimeConfig()
  if (!config.apiKey || !config.projectId) return null
  const projectId = config.projectId
  const cacheKey = publicReadCacheKey(projectId, config.databaseName, sql, params)
  const cachedRows = getCachedRows(cacheKey, PUBLIC_READ_CACHE_MS)
  if (cachedRows) return cachedRows as T[]

  const inflight = publicReadInflight.get(cacheKey)
  if (inflight) return (await inflight) as T[] | null

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
    return rows
  })()

  publicReadInflight.set(cacheKey, readPromise)

  try {
    return (await readPromise) as T[]
  } catch (error) {
    const staleRows = getCachedRows(cacheKey, PUBLIC_READ_STALE_MS)
    if (staleRows) return staleRows as T[]
    if (process.env.RECURSIV_STRICT_READS === "1") throw error
    console.warn("[recursiv] database read skipped:", error instanceof Error ? error.message : String(error))
    return null
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
