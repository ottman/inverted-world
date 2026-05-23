import { NextRequest } from "next/server"
import { syncTopicPulseToRecursiv } from "@/lib/recursiv/ingestion"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  return runRecursivJob(request, "topic-pulse", () =>
    syncTopicPulseToRecursiv({
      limit: Number(url.searchParams.get("limit") || "") || undefined,
      profileReader: url.searchParams.get("profileReader") === "1",
    }),
  )
}
