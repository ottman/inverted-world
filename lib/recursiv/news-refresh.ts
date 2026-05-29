import { queryInvertedWorldDatabase } from "@/lib/recursiv/database"
import { runFullPipelineInRecursiv } from "@/lib/recursiv/ingestion"
import { checkRecursivRateLimit, durableRateLimitKey } from "@/lib/recursiv/rate-limit"

type NewsRefreshStateRow = {
  latest_worldwire_at?: string
  latest_pipeline_completed_at?: string
  latest_running_started_at?: string
}

export type NewsRefreshKickoff = {
  checkedAt: string
  started: boolean
  status: "fresh" | "started" | "already-running" | "recent-attempt" | "unavailable" | "error"
  latestWorldwireAt?: string
  latestPipelineCompletedAt?: string
  latestRunningStartedAt?: string
  staleAfterMinutes: number
  error?: string
}

const NEWS_REFRESH_STALE_AFTER_MINUTES = Math.max(
  15,
  Math.trunc(Number(process.env.NEWS_REFRESH_STALE_AFTER_MINUTES || "65")) || 65,
)
const NEWS_REFRESH_MIN_ATTEMPT_MINUTES = Math.max(
  10,
  Math.trunc(Number(process.env.NEWS_REFRESH_MIN_ATTEMPT_MINUTES || "45")) || 45,
)

let refreshPromise: Promise<unknown> | null = null
let lastAttemptAt = 0

function timeValue(value?: string) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function mostRecentTime(...values: Array<string | undefined>) {
  return Math.max(0, ...values.map(timeValue))
}

async function getNewsRefreshState() {
  const rows = await queryInvertedWorldDatabase<NewsRefreshStateRow>(`
    SELECT
      (SELECT max(captured_at)::text FROM coverage_snapshots WHERE source = 'worldwire') AS latest_worldwire_at,
      (
        SELECT max(completed_at)::text
        FROM pipeline_runs
        WHERE job_name = 'full-pipeline'
          AND status IN ('succeeded', 'partial_failure')
      ) AS latest_pipeline_completed_at,
      (
        SELECT max(started_at)::text
        FROM pipeline_runs
        WHERE job_name = 'full-pipeline'
          AND status = 'running'
          AND started_at > now() - interval '30 minutes'
      ) AS latest_running_started_at
  `)

  return rows?.[0] ?? null
}

export async function maybeStartNewsRefresh(reason = "news-read"): Promise<NewsRefreshKickoff> {
  const checkedAt = new Date().toISOString()
  const staleAfterMs = NEWS_REFRESH_STALE_AFTER_MINUTES * 60 * 1000
  const minAttemptMs = NEWS_REFRESH_MIN_ATTEMPT_MINUTES * 60 * 1000

  try {
    const state = await getNewsRefreshState()
    if (!state) {
      return {
        checkedAt,
        started: false,
        status: "unavailable",
        staleAfterMinutes: NEWS_REFRESH_STALE_AFTER_MINUTES,
      }
    }

    const latestContentAt = mostRecentTime(state.latest_worldwire_at, state.latest_pipeline_completed_at)
    const runningStartedAt = timeValue(state.latest_running_started_at)
    const base = {
      checkedAt,
      latestWorldwireAt: state.latest_worldwire_at,
      latestPipelineCompletedAt: state.latest_pipeline_completed_at,
      latestRunningStartedAt: state.latest_running_started_at,
      staleAfterMinutes: NEWS_REFRESH_STALE_AFTER_MINUTES,
    }

    if (runningStartedAt) {
      return { ...base, started: false, status: "already-running" }
    }
    if (latestContentAt && Date.now() - latestContentAt < staleAfterMs) {
      return { ...base, started: false, status: "fresh" }
    }
    if (refreshPromise) {
      return { ...base, started: false, status: "already-running" }
    }
    if (lastAttemptAt && Date.now() - lastAttemptAt < minAttemptMs) {
      return { ...base, started: false, status: "recent-attempt" }
    }

    // Durable cross-instance gate: the checks above are per-instance, so on a horizontally
    // scaled deployment many instances (or a flood of public /api/front-page hits) could each
    // race past them and fire the expensive pipeline. Allow at most one kickoff per attempt
    // window globally. Only reached once the cheap checks have already decided to trigger, so
    // it adds a single DB write per genuine refresh, not per request.
    const durableSlot = await checkRecursivRateLimit(
      durableRateLimitKey("news-refresh", "global"),
      { windowMs: minAttemptMs, max: 1 },
      { reason },
    )
    if (durableSlot.ok === false) {
      return { ...base, started: false, status: "recent-attempt" }
    }

    lastAttemptAt = Date.now()
    refreshPromise = runFullPipelineInRecursiv({
      mode: "scheduled",
      staleAfterMinutes: 30,
      profileReader: true,
    })
      .catch((error) => {
        console.error(`[news-refresh] ${reason} failed`, error)
      })
      .finally(() => {
        refreshPromise = null
      })

    return { ...base, started: true, status: "started" }
  } catch (error) {
    return {
      checkedAt,
      started: false,
      status: "error",
      staleAfterMinutes: NEWS_REFRESH_STALE_AFTER_MINUTES,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
