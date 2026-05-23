import { NextRequest } from "next/server"
import { markStalePipelineRunsInRecursiv } from "@/lib/recursiv/ingestion"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const staleAfterMinutes = Number(url.searchParams.get("staleAfterMinutes") || "")
  const jobName = url.searchParams.get("jobName") || "full-pipeline"
  return runRecursivJob(request, "pipeline-maintenance", async () => ({
    jobName,
    ...(await markStalePipelineRunsInRecursiv({
      jobName,
      staleAfterMinutes: Number.isFinite(staleAfterMinutes) ? staleAfterMinutes : undefined,
    })),
  }))
}
