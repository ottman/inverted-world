import { NextResponse } from "next/server"
import { getRecursivPublicReadHealth } from "@/lib/recursiv/database"
import { fetchRecursivPipelineRuns } from "@/lib/recursiv/content"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") || "5")
  const jobName = url.searchParams.get("jobName") || "full-pipeline"
  const recent = await fetchRecursivPipelineRuns({ limit, jobName, allowSnapshotFallback: false })

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sourceMode: recent ? "recursiv-database" : "unavailable",
    readHealth: getRecursivPublicReadHealth(),
    latest: recent?.[0] ?? null,
    count: recent?.length ?? 0,
    recent: recent ?? [],
  })
}
