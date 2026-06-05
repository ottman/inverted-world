import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { requestClientId } from "@/lib/api-security"

function safeTokenEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

// In-memory failed-auth throttle: blunts CRON_SECRET brute-forcing. After FAIL_MAX wrong tokens from
// one client within the window, reject with 429 until it rolls off. (Per-instance; the real backstop
// is the secret's entropy — this just stops cheap online guessing.)
const FAIL_WINDOW_MS = 60_000
const FAIL_MAX = 10
const authFailures = new Map<string, { count: number; resetAt: number }>()

function tooManyFailures(clientId: string): boolean {
  const entry = authFailures.get(clientId)
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= FAIL_MAX)
}

function recordFailure(clientId: string) {
  const now = Date.now()
  const entry = authFailures.get(clientId)
  if (!entry || entry.resetAt <= now) {
    authFailures.set(clientId, { count: 1, resetAt: now + FAIL_WINDOW_MS })
  } else {
    entry.count += 1
  }
  if (authFailures.size > 5000) {
    for (const [key, value] of authFailures) if (value.resetAt <= now) authFailures.delete(key)
  }
}

export function authorizeRecursivJob(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }

  const clientId = requestClientId(request)
  if (tooManyFailures(clientId)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
  }

  const header = request.headers.get("authorization") || ""
  const token = header.replace(/^Bearer\s+/i, "").trim()
  if (token && safeTokenEquals(token, secret)) {
    authFailures.delete(clientId) // reset the counter on a good auth
    return null
  }

  recordFailure(clientId)
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
