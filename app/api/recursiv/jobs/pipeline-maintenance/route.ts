import { NextRequest, NextResponse } from "next/server"
import { authorizeRecursivJob } from "@/lib/recursiv/job-auth"
import { markStalePipelineRunsInRecursiv } from "@/lib/recursiv/ingestion"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const unauthorized = authorizeRecursivJob(request)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const staleAfterMinutes = Number(url.searchParams.get("staleAfterMinutes") || "")
  const jobName = url.searchParams.get("jobName") || "full-pipeline"
  const result = await markStalePipelineRunsInRecursiv({
    jobName,
    staleAfterMinutes: Number.isFinite(staleAfterMinutes) ? staleAfterMinutes : undefined,
  })

  return NextResponse.json({ ok: true, job: "pipeline-maintenance", jobName, ...result })
}
