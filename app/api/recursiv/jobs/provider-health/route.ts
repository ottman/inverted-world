import { NextRequest, NextResponse } from "next/server"
import { authorizeRecursivJob } from "@/lib/recursiv/job-auth"
import { runProviderHealthCheck } from "@/lib/recursiv/provider-health"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const unauthorized = authorizeRecursivJob(request)
  if (unauthorized) return unauthorized

  const report = await runProviderHealthCheck({ persist: true })
  return NextResponse.json({ ok: report.summary.error === 0, job: "provider-health", ...report })
}
