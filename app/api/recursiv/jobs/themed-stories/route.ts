import { NextRequest } from "next/server"
import { syncAllThemedStoriesToRecursiv } from "@/lib/recursiv/ingestion"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  return runRecursivJob(request, "themed-stories", () =>
    syncAllThemedStoriesToRecursiv({
      maxNew: Number(url.searchParams.get("maxNew") || "") || undefined,
      rebuild: /^(1|true|yes)$/i.test(url.searchParams.get("rebuild") || ""),
    }),
  )
}
