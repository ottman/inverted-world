import dns from "node:dns/promises"
import fs from "node:fs"
import { Recursiv } from "@recursiv/sdk"

const LOCAL_RECURSIV_KEY = "/private/tmp/inverted-world-recursiv-key"
const DEFAULT_BASE_URL = "https://api.recursiv.io/api/v1"
const DEFAULT_SITE_URL = "https://invertedworld.on.recursiv.io"
const DEFAULT_CUSTOM_DOMAIN = "https://www.inverted.world"
const DEFAULT_DATABASE_NAME = "inverted_world_research"
const READINESS_TIMEOUT_MS = Number(process.env.CUTOVER_READINESS_TIMEOUT_MS || "30000")

const EXPECTED_JOBS = [
  "inverted-world-youtube-archive-sync",
  "inverted-world-topic-pulse",
  "inverted-world-article-generation",
  "inverted-world-claim-dossiers",
  "inverted-world-source-documents",
  "inverted-world-media-library",
  "inverted-world-image-generation",
  "inverted-world-publishing",
  "inverted-world-front-page-edition",
  "inverted-world-full-pipeline",
  "inverted-world-pipeline-maintenance",
  "inverted-world-provider-health",
]

const REQUIRED_PROVIDERS = [
  "recursiv-database",
  "x-api",
  "exa",
  "youtube-rss",
  "youtube-data-api",
  "firecrawl",
  "openai",
  "cron-secret",
  "recursiv-agent",
]

const RECURSIV_BACKED_SOURCE_MODES = new Set(["recursiv-database", "recursiv-snapshot"])

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    const value = rawValue.replace(/^["']|["']$/g, "")
    if (process.env[key] || !value) continue
    process.env[key] = value
  }
}

function readFileIfPresent(file) {
  return file && fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : ""
}

function readRecursivKey() {
  return (
    readFileIfPresent(process.env.RECURSIV_API_KEY_FILE || "") ||
    readFileIfPresent(LOCAL_RECURSIV_KEY) ||
    process.env.RECURSIV_SERVER_API_KEY ||
    process.env.RECURSIV_API_KEY ||
    process.env.SOCIAL_DEV_API_KEY ||
    ""
  )
}

function statusText(ok) {
  return ok ? "pass" : "fail"
}

function statusTextOrUnknown(value) {
  if (value === null || value === undefined) return "unknown"
  return statusText(Boolean(value))
}

function dataSourceStatus(sourceMode) {
  if (sourceMode === "recursiv-database") return "live-database"
  if (sourceMode === "recursiv-snapshot") return "recursiv-export-snapshot"
  if (sourceMode) return String(sourceMode)
  return "unknown"
}

function latestByCreatedAt(items) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.created_at || left.started_at || 0).getTime()
    const rightTime = new Date(right.created_at || right.started_at || 0).getTime()
    return rightTime - leftTime
  })[0]
}

async function withTimeout(promise, label, fallback, warnings, timeoutMs = READINESS_TIMEOUT_MS) {
  let timeout
  const timedOut = Symbol(`${label} timeout`)
  try {
    const result = await Promise.race([
      promise,
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(timedOut), timeoutMs)
      }),
    ])
    if (result === timedOut) {
      warnings.push(`${label} timed out after ${timeoutMs}ms`)
      return fallback
    }
    return result
  } catch (error) {
    warnings.push(`${label} failed: ${error instanceof Error ? error.message : String(error)}`)
    return fallback
  } finally {
    clearTimeout(timeout)
  }
}

function shouldSyncDeploymentStatus(deployment) {
  return ["building", "deploying", "pending", "queued"].includes(String(deployment?.status || "").toLowerCase())
}

async function probeHttp(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    })
    const contentType = response.headers.get("content-type") || ""
    const text = contentType.includes("text/html") ? await response.text() : ""
    const title = text.match(/<title>(.*?)<\/title>/i)?.[1]?.trim()
    const contentSignals = {
      hasInvertedWorld: /inverted\.world|Inverted World|Tales From The Inverted World/i.test(text),
      hasCoreProductCopy: /Tales From The Inverted World|Latest Stories|How It Works|Power Web|Ask This Story/i.test(text),
    }

    return {
      url,
      status: response.status,
      ok: response.ok,
      redirected: response.status >= 300 && response.status < 400,
      location: response.headers.get("location") || undefined,
      server: response.headers.get("server") || undefined,
      xVercelId: response.headers.get("x-vercel-id") || undefined,
      cacheStatus: response.headers.get("x-vercel-cache") || response.headers.get("cf-cache-status") || undefined,
      title,
      contentSignals,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    return {
      url,
      status: 0,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    }
  }
}

async function probeJson(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      signal: AbortSignal.timeout(20000),
    })
    const body = await response.json().catch(() => ({}))

    return {
      url,
      status: response.status,
      ok: response.ok,
      sourceMode: body.sourceMode,
      totalCount: Number(body.totalCount || 0),
      hasMore: Boolean(body.hasMore),
      warningCount: Array.isArray(body.warnings) ? body.warnings.length : 0,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    return {
      url,
      status: 0,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    }
  }
}

async function probeDocumentsApi(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      signal: AbortSignal.timeout(20000),
    })
    const body = await response.json().catch(() => ({}))
    const documents = Array.isArray(body.documents) ? body.documents : []
    const topics = Array.isArray(body.topics) ? body.topics : []
    const kinds = body.kinds && typeof body.kinds === "object" ? body.kinds : {}

    return {
      url,
      status: response.status,
      ok: response.ok,
      sourceMode: body.sourceMode,
      count: Number(body.count || documents.length || 0),
      totalCount: Number(body.totalCount || documents.length || 0),
      topicCount: topics.length,
      kindCount: Object.keys(kinds).length,
      firstDocumentUrl: typeof documents[0]?.url === "string" ? documents[0].url : undefined,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    return {
      url,
      status: 0,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    }
  }
}

async function probeDns(hostname) {
  const [cname, a, aaaa] = await Promise.all([
    dns.resolveCname(hostname).catch(() => []),
    dns.resolve4(hostname).catch(() => []),
    dns.resolve6(hostname).catch(() => []),
  ])

  return { hostname, cname, a, aaaa }
}

async function fetchProviderHealth(sdk, projectId, databaseName) {
  const { data } = await sdk.databases.query({
    project_id: projectId,
    database_name: databaseName,
    sql: `SELECT status, completed_at, duration_ms, results, metadata
      FROM pipeline_runs
      WHERE job_name = 'provider-health'
      ORDER BY completed_at DESC NULLS LAST, started_at DESC
      LIMIT 1`,
  })
  const row = data.rows?.[0]
  if (!row) return null
  const providers = Array.isArray(row.results) ? row.results : []
  const byProvider = new Map(providers.map((item) => [item.provider, item]))
  const blockingProviders = REQUIRED_PROVIDERS.filter((provider) => byProvider.get(provider)?.status !== "ok")
  const completedAtMs = row.completed_at ? new Date(row.completed_at).getTime() : 0

  return {
    status: row.status,
    completedAt: row.completed_at,
    durationMs: Number(row.duration_ms || 0),
    summary: row.metadata?.summary || {},
    ageMinutes: completedAtMs ? Math.round((Date.now() - completedAtMs) / 60000) : null,
    blockingProviders,
  }
}

async function fetchPipelineSummary(sdk, projectId, databaseName) {
  const { data } = await sdk.databases.query({
    project_id: projectId,
    database_name: databaseName,
    sql: `SELECT job_name, status, completed_at, duration_ms, error, metadata
      FROM pipeline_runs
      WHERE job_name IN ('full-pipeline', 'provider-health')
      ORDER BY completed_at DESC NULLS LAST, started_at DESC
      LIMIT 5`,
  })
  return data.rows || []
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const apiKey = readRecursivKey()
  const projectId = process.env.RECURSIV_PROJECT_ID
  const databaseName = process.env.RECURSIV_DATABASE_NAME || DEFAULT_DATABASE_NAME
  const recursivUrl = process.env.INVERTED_WORLD_SITE_URL || DEFAULT_SITE_URL
  const customDomainUrl = process.env.INVERTED_WORLD_CUSTOM_DOMAIN || DEFAULT_CUSTOM_DOMAIN
  const customHostname = new URL(customDomainUrl).hostname
  const archiveApiUrl = new URL("/api/archive?limit=1000", recursivUrl).toString()
  const documentsApiUrl = new URL("/api/documents", recursivUrl).toString()
  const readinessWarnings = []

  if (!apiKey || !projectId) throw new Error("Missing Recursiv project id or API key for cutover readiness")

  const sdk = new Recursiv({
    apiKey,
    baseUrl: process.env.RECURSIV_BASE_URL || DEFAULT_BASE_URL,
    timeout: READINESS_TIMEOUT_MS,
    maxRetries: 0,
  })

  const [project, deploymentsResponse, jobsResponse, recursivHttp, archiveApi, documentsApi, customHttp, customDns, providerHealth, pipelineRuns] =
    await Promise.all([
      withTimeout(
        sdk.projects.get(projectId).then((response) => response.data),
        "Recursiv project lookup",
        null,
        readinessWarnings,
      ),
      withTimeout(
        sdk.deployments.list({ project_id: projectId }).then((response) => response.data),
        "Recursiv deployment list",
        null,
        readinessWarnings,
      ),
      withTimeout(
        sdk.jobs.list().then((response) => response.data),
        "Recursiv jobs list",
        null,
        readinessWarnings,
      ),
      probeHttp(recursivUrl),
      probeJson(archiveApiUrl),
      probeDocumentsApi(documentsApiUrl),
      probeHttp(customDomainUrl),
      probeDns(customHostname),
      withTimeout(fetchProviderHealth(sdk, projectId, databaseName), "provider-health database query", null, readinessWarnings),
      withTimeout(fetchPipelineSummary(sdk, projectId, databaseName), "pipeline summary database query", [], readinessWarnings),
    ])

  const deploymentLookupAvailable = Array.isArray(deploymentsResponse)
  const jobsLookupAvailable = Array.isArray(jobsResponse)
  let latestDeployment = latestByCreatedAt(deploymentLookupAvailable ? deploymentsResponse : [])
  let deploymentStatusSync = null
  if (latestDeployment?.id && shouldSyncDeploymentStatus(latestDeployment)) {
    try {
      const { data: syncResult } = await withTimeout(
        sdk.deployments.syncStatus(latestDeployment.id),
        "deployment status sync",
        { data: {} },
        readinessWarnings,
      )
      const { data: statusResult } = await withTimeout(
        sdk.deployments.getStatus(latestDeployment.id),
        "deployment status lookup",
        { data: {} },
        readinessWarnings,
      )
      latestDeployment = { ...latestDeployment, ...statusResult }
      deploymentStatusSync = {
        ok: true,
        status: syncResult?.status || statusResult?.status || latestDeployment.status,
      }
    } catch (error) {
      deploymentStatusSync = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  const invertedWorldJobs = jobsLookupAvailable ? jobsResponse.filter((job) => String(job.name || "").startsWith("inverted-world-")) : []
  const activeJobNames = new Set(invertedWorldJobs.filter((job) => job.status === "active").map((job) => job.name))
  const missingJobs = jobsLookupAvailable ? EXPECTED_JOBS.filter((name) => !activeJobNames.has(name)) : []
  const jobLastErrors = invertedWorldJobs
    .filter((job) => job.last_error)
    .map((job) => ({ name: job.name, lastError: String(job.last_error).slice(0, 220) }))
  const customLooksVercel = Boolean(
    customHttp.server?.toLowerCase().includes("vercel") ||
      customHttp.xVercelId ||
      customDns.cname.some((value) => value.toLowerCase().includes("vercel")),
  )
  const recursivHostedUrlProven = Boolean(
    recursivHttp.ok && recursivHttp.contentSignals?.hasInvertedWorld && recursivHttp.contentSignals?.hasCoreProductCopy,
  )
  const recursivDeploymentCompleted = Boolean(latestDeployment?.status === "completed")
  const recursivHostingProven = Boolean(recursivHostedUrlProven && recursivDeploymentCompleted)
  const recursivArchiveDataReady = Boolean(
    archiveApi.ok &&
      RECURSIV_BACKED_SOURCE_MODES.has(archiveApi.sourceMode) &&
      Number(archiveApi.totalCount || 0) >= 100 &&
      Number(archiveApi.warningCount || 0) === 0,
  )
  const recursivArchiveLiveDatabaseReady = Boolean(archiveApi.ok && archiveApi.sourceMode === "recursiv-database")
  const recursivArchiveSnapshotReady = Boolean(archiveApi.ok && archiveApi.sourceMode === "recursiv-snapshot")
  const documentsApiReady = Boolean(
    documentsApi.ok &&
      RECURSIV_BACKED_SOURCE_MODES.has(documentsApi.sourceMode) &&
      Number(documentsApi.totalCount || 0) >= 10 &&
      Number(documentsApi.topicCount || 0) >= 6 &&
      Number(documentsApi.kindCount || 0) >= 4,
  )
  const providerHealthAvailable = Boolean(providerHealth)
  const providerBlocking = providerHealth?.blockingProviders || REQUIRED_PROVIDERS
  const providerHealthFresh = providerHealth?.ageMinutes !== null && Number(providerHealth?.ageMinutes) <= 360
  const scheduledJobsReady = jobsLookupAvailable && missingJobs.length === 0
  const publicHostingReady = recursivHostingProven && recursivArchiveDataReady && documentsApiReady && scheduledJobsReady && providerHealthFresh
  const fullAiProductReady = publicHostingReady && providerBlocking.length === 0
  const customDomainRecursivProven = Boolean(customHttp.ok && !customLooksVercel && customHttp.contentSignals?.hasCoreProductCopy)
  const dnsCutoverReady = publicHostingReady && customDomainRecursivProven
  const keepDnsOnVercel = !dnsCutoverReady

  const checks = {
    recursivHostedUrl: statusText(recursivHostedUrlProven),
    recursivDeploymentCompleted: deploymentLookupAvailable ? statusText(recursivDeploymentCompleted) : "unknown",
    recursivHosting: statusText(recursivHostingProven),
    recursivArchiveData: statusText(recursivArchiveDataReady),
    recursivArchiveLiveDatabase: statusText(recursivArchiveLiveDatabaseReady),
    recursivArchiveSnapshot: statusText(recursivArchiveSnapshotReady),
    documentsApi: statusText(documentsApiReady),
    providerHealthFresh: providerHealthAvailable ? statusText(providerHealthFresh) : "unknown",
    fullAiProviders: providerHealthAvailable ? statusText(providerBlocking.length === 0) : "unknown",
    scheduledJobs: jobsLookupAvailable ? statusText(scheduledJobsReady) : "unknown",
    publicHostingReady: statusText(publicHostingReady),
    customDomainRecursivProven: statusTextOrUnknown(customDomainRecursivProven),
    customDomainStillLegacy: customLooksVercel ? "pass" : "unknown",
    dnsCutoverReady: statusText(dnsCutoverReady),
  }

  const nextActions = []
  if (!recursivHostedUrlProven) nextActions.push("Do not touch DNS until invertedworld.on.recursiv.io returns the expected app.")
  if (recursivHostedUrlProven && !recursivDeploymentCompleted) {
    nextActions.push("HTTP proof for invertedworld.on.recursiv.io is green, but Recursiv deployment completion could not be proven; rerun cutover after the Recursiv API key is healthy.")
  }
  if (!recursivArchiveDataReady) {
    nextActions.push("Do not touch DNS until /api/archive is reading Recursiv-backed data, either live database or Recursiv-exported snapshot, with a complete-enough archive and no warnings.")
  }
  if (recursivArchiveSnapshotReady && !recursivArchiveLiveDatabaseReady) {
    nextActions.push("Public archive data is Recursiv-backed through an exported snapshot while the runtime database key is unhealthy; fix the Recursiv runtime key before calling the full product live-database ready.")
  }
  if (!documentsApiReady) nextActions.push("Do not touch DNS until /api/documents returns the machine-readable source shelf with topic and kind coverage.")
  if (!providerHealthAvailable) {
    nextActions.push("Provider health could not be audited from Recursiv because the API key is unavailable or rate-limited; rerun readiness after the key is healthy.")
  } else if (providerBlocking.length) {
    nextActions.push(`Resolve full AI product provider blockers: ${providerBlocking.join(", ")}.`)
  }
  if (!jobsLookupAvailable) {
    nextActions.push("Scheduled jobs could not be audited from Recursiv because the API key is unavailable or rate-limited; rerun readiness after the key is healthy.")
  } else if (missingJobs.length) {
    nextActions.push(`Provision missing Recursiv jobs: ${missingJobs.join(", ")}.`)
  }
  if (jobLastErrors.length) nextActions.push("Review stale scheduled-job last_error values and rerun/clear jobs after provider blockers are fixed.")
  if (publicHostingReady && !customDomainRecursivProven) {
    nextActions.push("Recursiv public hosting is ready for the custom-domain planning step; create/prove the Recursiv www.inverted.world binding before changing DNS.")
  } else if (dnsCutoverReady) {
    nextActions.push("Recursiv custom-domain proof is green; update DNS intentionally, then remove the legacy Vercel binding after HTTP proof stays green.")
  } else {
    nextActions.push("Keep www.inverted.world on the legacy host until the failed gates pass.")
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        project: {
          id: project?.id || projectId,
          name: project?.name,
          slug: project?.slug,
          repoUrl: project?.repo_url,
        },
        checks,
        readinessWarnings,
        decision: {
          recursivHostingProven,
          recursivHostedUrlProven,
          recursivDeploymentCompleted,
          recursivArchiveDataReady,
          recursivArchiveLiveDatabaseReady,
          recursivArchiveSnapshotReady,
          publicHostingReady,
          fullAiProductReady,
          customDomainRecursivProven,
          dnsCutoverReady,
          keepDnsOnVercel,
        },
        recursivUrl: recursivHttp,
        recursivArchiveApi: archiveApi,
        recursivArchiveDataSource: dataSourceStatus(archiveApi.sourceMode),
        documentsApi,
        documentsDataSource: dataSourceStatus(documentsApi.sourceMode),
        customDomain: {
          http: customHttp,
          dns: customDns,
          looksLikeLegacyVercel: customLooksVercel,
        },
        deployment: latestDeployment
          ? {
              id: latestDeployment.id,
              status: latestDeployment.status,
              statusSync: deploymentStatusSync,
              deploymentUrl: latestDeployment.deployment_url,
              coolifyDomain: latestDeployment.coolify_domain,
              completedAt: latestDeployment.completed_at,
              errorMessage: latestDeployment.error_message,
            }
          : null,
        jobs: {
          expectedCount: EXPECTED_JOBS.length,
          lookupAvailable: jobsLookupAvailable,
          activeCount: invertedWorldJobs.filter((job) => job.status === "active").length,
          missingJobs,
          lastErrors: jobLastErrors,
        },
        providerHealth,
        providerHealthAvailable,
        recentPipelineRuns: pipelineRuns.map((run) => ({
          jobName: run.job_name,
          status: run.status,
          completedAt: run.completed_at,
          durationMs: run.duration_ms,
          error: run.error ? String(run.error).slice(0, 220) : "",
        })),
        nextActions,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
