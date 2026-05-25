import { NextResponse } from "next/server"

type RateLimitOptions = {
  max: number
  windowMs: number
}

type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfterSeconds: number; resetAt: number }

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 5000

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || ""
}

function pruneBuckets(now: number) {
  if (buckets.size <= MAX_BUCKETS) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
    if (buckets.size <= MAX_BUCKETS) break
  }
}

export function requestClientId(request: Request) {
  return (
    firstHeaderValue(request.headers.get("cf-connecting-ip")) ||
    firstHeaderValue(request.headers.get("x-real-ip")) ||
    firstHeaderValue(request.headers.get("x-forwarded-for")) ||
    "unknown"
  )
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  pruneBuckets(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs
    buckets.set(key, { count: 1, resetAt })
    return { ok: true, remaining: Math.max(0, options.max - 1), resetAt }
  }

  if (existing.count >= options.max) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      resetAt: existing.resetAt,
    }
  }

  existing.count += 1
  return { ok: true, remaining: Math.max(0, options.max - existing.count), resetAt: existing.resetAt }
}

export function rateLimitResponse(result: Extract<RateLimitResult, { ok: false }>) {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "retry-after": String(result.retryAfterSeconds),
      },
    },
  )
}

function bytesLength(value: string) {
  return new TextEncoder().encode(value).byteLength
}

export async function readLimitedJsonBody<T extends Record<string, unknown>>(
  request: Request,
  maxBytes = 16_384,
): Promise<{ ok: true; body: T } | { ok: false; response: NextResponse }> {
  const contentLength = Number(request.headers.get("content-length") || "0")
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Request body too large" }, { status: 413 }),
    }
  }

  const text = await request.text().catch(() => "")
  if (bytesLength(text) > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Request body too large" }, { status: 413 }),
    }
  }

  if (!text.trim()) return { ok: true, body: {} as T }

  try {
    return { ok: true, body: JSON.parse(text) as T }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    }
  }
}
