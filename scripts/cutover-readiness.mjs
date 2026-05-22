import dns from "node:dns/promises"
import fs from "node:fs"
import { Recursiv } from "@recursiv/sdk"

const LOCAL_RECURSIV_KEY = "/private/tmp/inverted-world-recursiv-key"
const DEFAULT_BASE_URL = "https://api.recursiv.io/api/v1"
const DEFAULT_SITE_URL = "https://invertedworld.on.recursiv.io"
const DEFAULT_CUSTOM_DOMAIN = "https://www.inverted.world"
const DEFAULT_DATABASE_NAME = "inverted_world_research"

const EXPECTED_JOBS = [
  "inverted-world-youtube-archive-sync",
  "inverted-world-topic-pulse",
  "inverted-world-article-generation",
  "inverted-world-claim-dossiers",
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

function latestByCreatedAt(items) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.created_at || left.started_at || 0).getTime()
    const rightTime = new Date(right.created_at || right.started_at || 0).getTime()
    return rightTime - leftTime
  })[0]
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
      hasRecursivDossierCopy: /Claim Dossiers|Tales From The Inverted World|Power Web/i.test(text),
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

  if (!apiKey || !projectId) throw new Error("Missing Recursiv project id or API key for cutover readiness")

  const sdk = new Recursiv({
    apiKey,
    baseUrl: process.env.RECURSIV_BASE_URL || DEFAULT_BASE_URL,
    timeout: 120000,
    maxRetries: 1,
  })

  const [project, deploymentsResponse, jobsResponse, recursivHttp, customHttp, customDns, providerHealth, pipelineRuns] =
    await Promise.all([
      sdk.projects.get(projectId).then((response) => response.data),
      sdk.deployments.list({ project_id: projectId }).then((response) => response.data),
      sdk.jobs.list().then((response) => response.data),
      probeHttp(recursivUrl),
      probeHttp(customDomainUrl),
      probeDns(customHostname),
      fetchProviderHealth(sdk, projectId, databaseName),
      fetchPipelineSummary(sdk, projectId, databaseName),
    ])

  let latestDeployment = latestByCreatedAt(deploymentsResponse || [])
  let deploymentStatusSync = null
  if (latestDeployment?.id && shouldSyncDeploymentStatus(latestDeployment)) {
    try {
      const { data: syncResult } = await sdk.deployments.syncStatus(latestDeployment.id)
      const { data: statusResult } = await sdk.deployments.getStatus(latestDeployment.id)
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
  const invertedWorldJobs = (jobsResponse || []).filter((job) => String(job.name || "").startsWith("inverted-world-"))
  const activeJobNames = new Set(invertedWorldJobs.filter((job) => job.status === "active").map((job) => job.name))
  const missingJobs = EXPECTED_JOBS.filter((name) => !activeJobNames.has(name))
  const jobLastErrors = invertedWorldJobs
    .filter((job) => job.last_error)
    .map((job) => ({ name: job.name, lastError: String(job.last_error).slice(0, 220) }))
  const customLooksVercel = Boolean(
    customHttp.server?.toLowerCase().includes("vercel") ||
      customHttp.xVercelId ||
      customDns.cname.some((value) => value.toLowerCase().includes("vercel")),
  )
  const recursivHostingProven = Boolean(
    latestDeployment?.status === "completed" &&
      recursivHttp.ok &&
      recursivHttp.contentSignals?.hasInvertedWorld &&
      recursivHttp.contentSignals?.hasRecursivDossierCopy,
  )
  const providerBlocking = providerHealth?.blockingProviders || REQUIRED_PROVIDERS
  const providerHealthFresh = providerHealth?.ageMinutes !== null && Number(providerHealth?.ageMinutes) <= 360
  const scheduledJobsReady = missingJobs.length === 0
  const backendReady = providerBlocking.length === 0 && scheduledJobsReady && providerHealthFresh
  const dnsCutoverReady = recursivHostingProven && backendReady
  const keepDnsOnVercel = !dnsCutoverReady

  const checks = {
    recursivHosting: statusText(recursivHostingProven),
    providerHealthFresh: statusText(providerHealthFresh),
    requiredProviders: statusText(providerBlocking.length === 0),
    scheduledJobs: statusText(scheduledJobsReady),
    customDomainStillLegacy: customLooksVercel ? "pass" : "unknown",
    dnsCutoverReady: statusText(dnsCutoverReady),
  }

  const nextActions = []
  if (!recursivHostingProven) nextActions.push("Do not touch DNS until invertedworld.on.recursiv.io returns the expected app from a completed deployment.")
  if (providerBlocking.length) nextActions.push(`Resolve required hosted provider blockers: ${providerBlocking.join(", ")}.`)
  if (missingJobs.length) nextActions.push(`Provision missing Recursiv jobs: ${missingJobs.join(", ")}.`)
  if (jobLastErrors.length) nextActions.push("Review stale scheduled-job last_error values and rerun/clear jobs after provider blockers are fixed.")
  if (dnsCutoverReady) {
    nextActions.push("Create/prove the Recursiv custom-domain binding for www.inverted.world, then update DNS intentionally.")
  } else {
    nextActions.push("Keep www.inverted.world on the legacy host until the failed gates pass.")
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
          repoUrl: project.repo_url,
        },
        checks,
        decision: {
          recursivHostingProven,
          backendReady,
          dnsCutoverReady,
          keepDnsOnVercel,
        },
        recursivUrl: recursivHttp,
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
          activeCount: invertedWorldJobs.filter((job) => job.status === "active").length,
          missingJobs,
          lastErrors: jobLastErrors,
        },
        providerHealth,
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
