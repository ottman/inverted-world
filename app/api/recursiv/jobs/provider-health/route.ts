import { NextRequest } from "next/server"
import { runProviderHealthCheck } from "@/lib/recursiv/provider-health"
import { runRecursivJob } from "@/lib/recursiv/job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const persist =
    url.searchParams.get("persist") !== "0" &&
    url.searchParams.get("persist") !== "false" &&
    url.searchParams.get("proof") !== "readiness"

  return runRecursivJob(request, "provider-health", () => runProviderHealthCheck({ persist }), {
    ok: (report) => report.summary.error === 0,
  })
}
