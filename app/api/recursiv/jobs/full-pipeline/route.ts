import { NextRequest, NextResponse } from "next/server"
import { authorizeRecursivJob } from "@/lib/recursiv/job-auth"
import { runFullPipelineInRecursiv } from "@/lib/recursiv/ingestion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const unauthorized = authorizeRecursivJob(request)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const result = await runFullPipelineInRecursiv({
    mode: url.searchParams.get("mode"),
    staleAfterMinutes: Number(url.searchParams.get("staleAfterMinutes") || "") || undefined,
  })
  return NextResponse.json({ ok: true, job: "full-pipeline", ...result })
}
