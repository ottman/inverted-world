import { createHash } from "node:crypto"
import type { RateLimitOptionsInput, RateLimitResult } from "@/lib/api-security"
import { createRecursivServerClient } from "@/lib/recursiv/client"

export type DurableRateLimitResult =
  | (Extract<RateLimitResult, { ok: true }> & { source: "recursiv-database" })
  | (Extract<RateLimitResult, { ok: false }> & { source: "recursiv-database" })
  | { ok: null; source: "unavailable"; error: string }

type RateLimitRow = {
  count?: number | string
  reset_at?: string
}

function hashValue(value: string, length = 24) {
  return createHash("sha256").update(value).digest("hex").slice(0, length)
}

function safeKeyPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

export function hashedRateLimitSubject(value: string) {
  return hashValue(value || "unknown")
}

export function durableRateLimitKey(...parts: string[]) {
  const readable = parts.map((part) => safeKeyPart(part)).filter(Boolean).join(":").slice(0, 140)
  const digest = hashValue(parts.join("\0"), 16)
  return `${readable || "bucket"}:${digest}`
}

export async function checkRecursivRateLimit(
  bucketKey: string,
  options: RateLimitOptionsInput,
  metadata: Record<string, unknown> = {},
): Promise<DurableRateLimitResult> {
  try {
    const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000))
    const { sdk, config } = createRecursivServerClient({ maxRetries: 0, timeout: 5000 })
    const { data } = await sdk.databases.query({
      project_id: config.projectId,
      database_name: config.databaseName,
      sql: `INSERT INTO public_rate_limits (bucket_key, count, window_start, reset_at, metadata, updated_at)
        VALUES ($1, 1, now(), now() + ($2::int * interval '1 second'), $3::jsonb, now())
        ON CONFLICT (bucket_key) DO UPDATE SET
          count = CASE
            WHEN public_rate_limits.reset_at <= now() THEN 1
            ELSE public_rate_limits.count + 1
          END,
          window_start = CASE
            WHEN public_rate_limits.reset_at <= now() THEN now()
            ELSE public_rate_limits.window_start
          END,
          reset_at = CASE
            WHEN public_rate_limits.reset_at <= now() THEN now() + ($2::int * interval '1 second')
            ELSE public_rate_limits.reset_at
          END,
          metadata = public_rate_limits.metadata || $3::jsonb,
          updated_at = now()
        RETURNING count, reset_at`,
      params: [bucketKey, windowSeconds, JSON.stringify(metadata)],
    })

    const row = (data.rows?.[0] || {}) as RateLimitRow
    const count = Math.max(0, Math.trunc(Number(row.count || 0)))
    const resetAt = row.reset_at ? new Date(row.reset_at).getTime() : Date.now() + options.windowMs
    if (count > options.max) {
      return {
        ok: false,
        source: "recursiv-database",
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
        resetAt,
      }
    }

    return {
      ok: true,
      source: "recursiv-database",
      remaining: Math.max(0, options.max - count),
      resetAt,
    }
  } catch (error) {
    return {
      ok: null,
      source: "unavailable",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
