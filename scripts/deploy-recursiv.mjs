import { execFileSync } from "node:child_process"
import fs from "node:fs"

const DEFAULT_BASE_URL = "https://api.recursiv.io/api/v1"
const LOCAL_RECURSIV_KEY = "/private/tmp/inverted-world-recursiv-key"
const DEFAULT_DEPLOY_TIMEOUT_MS = 30000
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000
const LOCAL_RATE_LIMIT_COOLDOWN_FILE = "/private/tmp/inverted-world-recursiv-api-cooldown.json"

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  const content = fs.readFileSync(file, "utf8")
  for (const line of content.split(/\r?\n/)) {
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

function requireEnv(name, fallback) {
  const value = process.env[name] || fallback
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function readFileIfPresent(file) {
  return file && fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : ""
}

function keyCandidates() {
  return [
    { source: "RECURSIV_API_KEY_FILE", value: readFileIfPresent(process.env.RECURSIV_API_KEY_FILE || "") },
    { source: LOCAL_RECURSIV_KEY, value: readFileIfPresent(LOCAL_RECURSIV_KEY) },
    { source: "RECURSIV_SERVER_API_KEY", value: process.env.RECURSIV_SERVER_API_KEY },
    { source: "RECURSIV_API_KEY", value: process.env.RECURSIV_API_KEY },
    { source: "SOCIAL_DEV_API_KEY", value: process.env.SOCIAL_DEV_API_KEY },
  ].filter((candidate) => Boolean(candidate.value))
}

function readApiKey() {
  const preferredSource = process.env.RECURSIV_DEPLOY_KEY_SOURCE
  const candidates = keyCandidates()
  if (preferredSource) {
    const preferred = candidates.find((candidate) => candidate.source === preferredSource)
    if (!preferred) throw new Error(`RECURSIV_DEPLOY_KEY_SOURCE did not match an available key source: ${preferredSource}`)
    return preferred
  }
  return candidates[0]
}

function timeoutMs() {
  return Math.max(
    5000,
    Math.min(Math.trunc(Number(process.env.RECURSIV_DEPLOY_TIMEOUT_MS || DEFAULT_DEPLOY_TIMEOUT_MS)) || DEFAULT_DEPLOY_TIMEOUT_MS, 120000),
  )
}

function cooldownFile() {
  return process.env.RECURSIV_DEPLOY_COOLDOWN_FILE || LOCAL_RATE_LIMIT_COOLDOWN_FILE
}

function cooldownBypassEnabled() {
  return process.env.RECURSIV_DEPLOY_IGNORE_COOLDOWN === "1" || process.argv.includes("--ignore-cooldown")
}

function clearCooldownFile() {
  const file = cooldownFile()
  if (fs.existsSync(file)) fs.unlinkSync(file)
}

function readCooldown() {
  const file = cooldownFile()
  if (!fs.existsSync(file)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

function writeCooldown(cooldown) {
  fs.writeFileSync(cooldownFile(), `${JSON.stringify(cooldown, null, 2)}\n`, { mode: 0o600 })
}

function cooldownMsForError(error) {
  const retryAfter = Number(error?.retryAfter)
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, DEFAULT_RATE_LIMIT_COOLDOWN_MS)
  const message = String(error?.message || "")
  if (/per-minute/i.test(message)) return 90 * 1000
  return DEFAULT_RATE_LIMIT_COOLDOWN_MS
}

function recordRateLimit(error) {
  if (error?.status !== 429) return null
  const now = Date.now()
  const cooldownMs = cooldownMsForError(error)
  const cooldown = {
    recordedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + cooldownMs).toISOString(),
    status: error.status,
    code: error.code || "rate_limit_exceeded",
    message: error instanceof Error ? error.message : String(error),
  }
  writeCooldown(cooldown)
  return cooldown
}

function assertNotInCooldown(action) {
  if (cooldownBypassEnabled()) return
  const cooldown = readCooldown()
  if (!cooldown?.expiresAt) return

  const expiresAtMs = new Date(cooldown.expiresAt).getTime()
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    clearCooldownFile()
    return
  }

  const error = new Error(`Recursiv deployment API cooldown is active until ${cooldown.expiresAt}`)
  error.status = 429
  error.code = "rate_limit_cooldown"
  error.cooldown = {
    ...cooldown,
    action,
    remainingSeconds: Math.ceil((expiresAtMs - Date.now()) / 1000),
  }
  throw error
}

function currentCommitHash() {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim()
  } catch {
    return undefined
  }
}

function latestByCreatedAt(items) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.created_at || left.started_at || 0).getTime()
    const rightTime = new Date(right.created_at || right.started_at || 0).getTime()
    return rightTime - leftTime
  })[0]
}

function deploymentSummary(deployment) {
  if (!deployment) return null
  return {
    id: deployment.id || deployment.deployment_id,
    status: deployment.status,
    deploymentUrl: deployment.deployment_url,
    coolifyAppUuid: deployment.coolify_app_uuid,
    coolifyDomain: deployment.coolify_domain,
    startedAt: deployment.started_at,
    completedAt: deployment.completed_at,
    errorMessage: deployment.error_message,
  }
}

async function requestRecursiv(path, options) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs)
  const url = `${options.baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${options.apiKey}`,
        ...(options.body ? { "content-type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    const text = await response.text()
    let parsed = {}
    try {
      parsed = text ? JSON.parse(text) : {}
    } catch {
      parsed = { text: text.slice(0, 300) }
    }

    if (!response.ok) {
      const rawError = parsed.error
      const errorMessage =
        typeof rawError === "string"
          ? rawError
          : rawError?.message || parsed.message || `HTTP ${response.status} ${response.statusText}`
      const error = new Error(errorMessage)
      error.status = response.status
      error.code = typeof rawError === "object" ? rawError?.code : undefined
      error.retryAfter = response.headers.get("retry-after")
      throw error
    }

    return parsed
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(`Recursiv deployment API request timed out after ${options.timeoutMs}ms`)
      timeoutError.code = "request_timeout"
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  if (process.argv.includes("--clear-cooldown")) {
    clearCooldownFile()
    console.log(JSON.stringify({ ok: true, action: "clear-cooldown", cooldownFile: cooldownFile() }, null, 2))
    return
  }

  const baseUrl = process.env.RECURSIV_BASE_URL || DEFAULT_BASE_URL
  const apiKey = readApiKey()
  const projectId = requireEnv("RECURSIV_PROJECT_ID")
  const branch = process.env.RECURSIV_DEPLOY_BRANCH || "main"
  const commitHash = process.env.RECURSIV_DEPLOY_COMMIT || currentCommitHash()
  const requestTimeoutMs = timeoutMs()
  if (!apiKey?.value) throw new Error("Missing RECURSIV_SERVER_API_KEY or RECURSIV_API_KEY")
  const action = process.argv.includes("--status") ? "status" : process.argv.includes("--update-project") ? "update-project" : "deploy"
  assertNotInCooldown(action)

  const requestOptions = {
    baseUrl,
    apiKey: apiKey.value,
    timeoutMs: requestTimeoutMs,
  }

  if (process.argv.includes("--status")) {
    const response = await requestRecursiv(`/deployments?project_id=${encodeURIComponent(projectId)}`, requestOptions)
    const deployments = Array.isArray(response.data) ? response.data : []
    const latestDeployment = latestByCreatedAt(deployments)
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: "status",
          keySource: apiKey.source,
          deploymentCount: deployments.length,
          latestDeployment: deploymentSummary(latestDeployment),
        },
        null,
        2,
      ),
    )
    return
  }

  if (process.argv.includes("--update-project")) {
    await requestRecursiv(`/projects/${encodeURIComponent(projectId)}`, {
      ...requestOptions,
      method: "PATCH",
      body: {
        name: "Inverted World",
        slug: process.env.RECURSIV_PROJECT_SLUG || "invertedworld",
        description: "Recursiv-hosted AI news/archive product for Tales From the Inverted World.",
        repo_url: "https://github.com/ottman/inverted-world.git",
      },
    })
    console.log(JSON.stringify({ ok: true, action: "update-project", keySource: apiKey.source }, null, 2))
  }

  const response = await requestRecursiv("/deployments", {
    ...requestOptions,
    method: "POST",
    body: {
      project_id: projectId,
      branch,
      commit_hash: commitHash,
      commit_message: `Deploy inverted-world ${branch}${commitHash ? ` ${commitHash}` : ""}`,
    },
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: "deploy",
        keySource: apiKey.source,
        branch,
        commitHash,
        deployment: deploymentSummary(response.data),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  const cooldown = error?.code === "rate_limit_cooldown" ? error.cooldown : recordRateLimit(error)
  console.error(
    JSON.stringify(
      {
        ok: false,
        status: error?.status,
        code: error?.code,
        message: error instanceof Error ? error.message : String(error),
        ...(cooldown ? { cooldown } : {}),
      },
      null,
      2,
    ),
  )
  process.exit(1)
})
