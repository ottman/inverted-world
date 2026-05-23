import { NextRequest } from "next/server"
import { runProviderHealthCheck } from "@/lib/recursiv/provider-health"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  return runRecursivJob(request, "provider-health", () => runProviderHealthCheck({ persist: true }), {
    ok: (report) => report.summary.error === 0,
  })
}
