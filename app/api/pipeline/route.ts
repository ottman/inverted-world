import { NextResponse } from "next/server"
import { fetchRecursivPipelineRuns, getLatestRecursivPipelineRun } from "@/lib/recursiv/content"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") || "5")
  const jobName = url.searchParams.get("jobName") || "full-pipeline"
  const [latest, recent] = await Promise.all([
    getLatestRecursivPipelineRun(jobName),
    fetchRecursivPipelineRuns({ limit, jobName }).then((runs) => runs || []),
  ])

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    latest,
    count: recent.length,
    recent,
  })
}
