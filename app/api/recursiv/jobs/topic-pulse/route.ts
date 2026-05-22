import { NextRequest, NextResponse } from "next/server"
import { authorizeRecursivJob } from "@/lib/recursiv/job-auth"
import { syncTopicPulseToRecursiv } from "@/lib/recursiv/ingestion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const unauthorized = authorizeRecursivJob(request)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const result = await syncTopicPulseToRecursiv({
    limit: Number(url.searchParams.get("limit") || "") || undefined,
    profileReader: url.searchParams.get("profileReader") === "1",
  })
  return NextResponse.json({ ok: true, job: "topic-pulse", ...result })
}
