import { NextRequest } from "next/server"
import { buildDailyAutopostJobResult } from "@/lib/recursiv/daily-autopost"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  return runRecursivJob(request, "daily-autopost", buildDailyAutopostJobResult, {
    ok: (result) => Boolean(result.ready),
  })
}
