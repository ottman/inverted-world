import { NextRequest, NextResponse } from "next/server"
import { authorizeRecursivJob } from "@/lib/recursiv/job-auth"
import { checkRateLimit, rateLimitResponse, requestClientId } from "@/lib/api-security"

type JobResult = Record<string, unknown>

type JobRunnerOptions<T> = {
  ok?: (result: T) => boolean
}

const runningJobs = new Map<string, Promise<unknown>>()

function wantsAsync(request: NextRequest) {
  const url = new URL(request.url)
  const value = url.searchParams.get("async")?.toLowerCase()
  return value === "1" || value === "true" || value === "yes"
}

function objectResult(value: unknown): JobResult {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JobResult
  return { result: value }
}

export async function runRecursivJob<T>(
  request: NextRequest,
  job: string,
  handler: () => Promise<T>,
  options: JobRunnerOptions<T> = {},
) {
  const unauthorized = authorizeRecursivJob(request)
  if (unauthorized) return unauthorized

  // Defense-in-depth: even an authenticated caller can't hammer the (expensive, spend-triggering)
  // job endpoints. Legit cron hits each job at most ~hourly, so these caps only bite abuse.
  const clientId = requestClientId(request)
  const perClient = checkRateLimit(`job:${job}:${clientId}`, { max: 30, windowMs: 60_000 })
  if (!perClient.ok) return rateLimitResponse(perClient)
  const perJob = checkRateLimit(`job-global:${job}`, { max: 60, windowMs: 60_000 })
  if (!perJob.ok) return rateLimitResponse(perJob)

  if (!wantsAsync(request)) {
    const result = await handler()
    return NextResponse.json({
      ok: options.ok ? options.ok(result) : true,
      job,
      ...objectResult(result),
    })
  }

  const existing = runningJobs.get(job)
  if (existing) {
    return NextResponse.json({
      ok: true,
      job,
      mode: "async",
      status: "already-running",
    })
  }

  const promise = Promise.resolve().then(handler)
  runningJobs.set(job, promise)
  promise
    .catch((error) => {
      console.error(`[recursiv-job] ${job} async run failed`, error)
    })
    .finally(() => {
      if (runningJobs.get(job) === promise) runningJobs.delete(job)
    })

  return NextResponse.json({
    ok: true,
    job,
    mode: "async",
    status: "started",
  })
}
