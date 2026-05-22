import { NextRequest, NextResponse } from "next/server"
import { authorizeRecursivJob } from "@/lib/recursiv/job-auth"
import { generateArticleDraftsInRecursiv } from "@/lib/recursiv/ingestion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function optionalBoolean(value: string | null) {
  if (value === null) return undefined
  return !["0", "false", "no", "off"].includes(value.toLowerCase())
}

export async function POST(request: NextRequest) {
  const unauthorized = authorizeRecursivJob(request)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const result = await generateArticleDraftsInRecursiv({
    limit: Number(url.searchParams.get("limit") || "") || undefined,
    useAgent: optionalBoolean(url.searchParams.get("useAgent")),
  })
  return NextResponse.json({ ok: true, job: "article-generation", ...result })
}
