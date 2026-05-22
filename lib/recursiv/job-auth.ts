import { NextRequest, NextResponse } from "next/server"

export function authorizeRecursivJob(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }

  const header = request.headers.get("authorization") || ""
  const token = header.replace(/^Bearer\s+/i, "").trim()
  if (token === secret) return null

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
