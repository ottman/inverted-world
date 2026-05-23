import { NextRequest } from "next/server"
import { runFullPipelineInRecursiv } from "@/lib/recursiv/ingestion"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  return runRecursivJob(request, "full-pipeline", () =>
    runFullPipelineInRecursiv({
      mode: url.searchParams.get("mode"),
      staleAfterMinutes: Number(url.searchParams.get("staleAfterMinutes") || "") || undefined,
    }),
  )
}
