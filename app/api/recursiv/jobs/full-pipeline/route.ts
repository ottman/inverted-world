import { NextRequest } from "next/server"
import { runFullPipelineInRecursiv } from "@/lib/recursiv/ingestion"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseProfileReader(value: string | null) {
  if (value === "0" || value === "false" || value === "no") return false
  if (value === "1" || value === "true" || value === "yes") return true
  return undefined
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  return runRecursivJob(request, "full-pipeline", () =>
    runFullPipelineInRecursiv({
      mode: url.searchParams.get("mode"),
      staleAfterMinutes: Number(url.searchParams.get("staleAfterMinutes") || "") || undefined,
      profileReader: parseProfileReader(url.searchParams.get("profileReader")),
    }),
  )
}
