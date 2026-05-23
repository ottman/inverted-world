import { NextRequest } from "next/server"
import { syncWorldwireCoverageToRecursiv } from "@/lib/recursiv/ingestion"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  return runRecursivJob(request, "worldwire", () =>
    syncWorldwireCoverageToRecursiv({
      limitPerLane: Number(url.searchParams.get("limitPerLane") || "") || undefined,
    }),
  )
}
