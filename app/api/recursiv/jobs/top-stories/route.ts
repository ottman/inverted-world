import { NextRequest } from "next/server"
import { syncTopStoriesToRecursiv } from "@/lib/recursiv/ingestion"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  return runRecursivJob(request, "top-stories", () =>
    syncTopStoriesToRecursiv({
      limit: Number(url.searchParams.get("limit") || "") || undefined,
      sinceDays: Number(url.searchParams.get("sinceDays") || "") || undefined,
    }),
  )
}
