import { NextResponse } from "next/server"
import { fetchRecursivPipelineRunsWithSource, type PipelineRunStatus } from "@/lib/recursiv/content"

export const dynamic = "force-dynamic"

const PUBLIC_PIPELINE_JOBS = new Set(["full-pipeline", "worldwire", "topic-pulse", "front-page-edition"])

function publicPipelineRun(run?: PipelineRunStatus | null) {
  if (!run) return null
  return {
    jobName: run.jobName,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    durationMs: run.durationMs,
    stepCount: run.stepCount,
    failedStepCount: run.failedStepCount,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requestedLimit = Number(url.searchParams.get("limit") || "1")
  const limit = Math.max(1, Math.min(Math.trunc(requestedLimit) || 1, 3))
  const requestedJobName = url.searchParams.get("jobName") || "full-pipeline"
  const jobName = PUBLIC_PIPELINE_JOBS.has(requestedJobName) ? requestedJobName : "full-pipeline"
  const result = await fetchRecursivPipelineRunsWithSource({ limit, jobName })
  const recent = result?.runs ?? []

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      sourceMode: result?.sourceMode ?? "unavailable",
      latest: publicPipelineRun(recent[0]),
      count: recent.length,
      recent: recent.map(publicPipelineRun),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  )
}
