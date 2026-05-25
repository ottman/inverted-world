import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"

function safeTokenEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function authorizeRecursivJob(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }

  const header = request.headers.get("authorization") || ""
  const token = header.replace(/^Bearer\s+/i, "").trim()
  if (safeTokenEquals(token, secret)) return null

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
