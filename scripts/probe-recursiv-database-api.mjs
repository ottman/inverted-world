import fs from "node:fs"

const DEFAULT_BASE_URL = "https://api.recursiv.io/api/v1"
const DEFAULT_DATABASE_NAME = "inverted_world_research"
const LOCAL_RECURSIV_KEY = "/private/tmp/inverted-world-recursiv-key"

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  const content = fs.readFileSync(file, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (!process.env[key]) process.env[key] = rawValue.replace(/^["']|["']$/g, "")
  }
}

function readOptionalFile(file) {
  if (!file || !fs.existsSync(file)) return ""
  return fs.readFileSync(file, "utf8").trim()
}

function readApiKey() {
  const localKey = readOptionalFile(process.env.RECURSIV_API_KEY_FILE || LOCAL_RECURSIV_KEY)
  if (localKey) {
    return {
      value: localKey,
      source: process.env.RECURSIV_API_KEY_FILE || LOCAL_RECURSIV_KEY,
    }
  }

  for (const [source, value] of [
    ["RECURSIV_SERVER_API_KEY", process.env.RECURSIV_SERVER_API_KEY],
    ["RECURSIV_API_KEY", process.env.RECURSIV_API_KEY],
    ["SOCIAL_DEV_API_KEY", process.env.SOCIAL_DEV_API_KEY],
  ]) {
    if (value) return { value, source }
  }

  throw new Error(`Missing Recursiv API key. Set RECURSIV_API_KEY_FILE, RECURSIV_SERVER_API_KEY, or write the key to ${LOCAL_RECURSIV_KEY}.`)
}

function queryString(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value))
  }
  return search.toString()
}

function cleanErrorBody(body) {
  if (!body || typeof body !== "object") return body
  const error = body.error
  if (!error || typeof error !== "object") return body
  return {
    error: {
      type: error.type,
      code: error.code,
      message: error.message,
      details: error.details,
    },
  }
}

function summarizeListBody(body) {
  const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body?.data?.items) ? body.data.items : []
  if (!rows.length) return cleanErrorBody(body)
  return {
    data: rows.map((row) => ({
      name: row.name,
      status: row.status,
      project_id: row.project_id,
      has_neon_project_id: Boolean(row.neon_project_id),
      has_host: Boolean(row.host),
    })),
  }
}

function summarizeQueryBody(body) {
  if (!body || typeof body !== "object") return body
  if (body.error) return cleanErrorBody(body)
  return {
    data: {
      columns: body.data?.columns,
      rowCount: body.data?.rowCount,
      rows: Array.isArray(body.data?.rows) ? body.data.rows.slice(0, 3) : undefined,
    },
  }
}

function summarizeCredentialsBody(body) {
  if (!body || typeof body !== "object") return body
  if (body.error) return cleanErrorBody(body)

  const url = body.data?.url
  let host
  try {
    host = url ? new URL(url).host : undefined
  } catch {
    host = undefined
  }

  return {
    data: {
      credentialsAvailable: Boolean(url),
      host,
    },
  }
}

async function fetchJson({ label, baseUrl, apiKey, path, method = "GET", body }) {
  const started = Date.now()
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${apiKey}`,
    "user-agent": "InvertedWorldDatabaseProbe/1.0",
  }
  if (body) headers["content-type"] = "application/json"

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  })
  const text = await response.text()
  let parsed
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = { text: text.slice(0, 300) }
  }

  return {
    label,
    status: response.status,
    ok: response.ok,
    ms: Date.now() - started,
    body:
      label === "list"
        ? summarizeListBody(parsed)
        : label === "credentials"
          ? summarizeCredentialsBody(parsed)
          : label.startsWith("query")
            ? summarizeQueryBody(parsed)
            : cleanErrorBody(parsed),
  }
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const apiKey = readApiKey()
  const baseUrl = (process.env.RECURSIV_BASE_URL || process.env.NEXT_PUBLIC_RECURSIV_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "")
  const projectId = process.env.RECURSIV_PROJECT_ID || process.env.NEXT_PUBLIC_RECURSIV_PROJECT_ID
  const databaseName = process.env.RECURSIV_DATABASE_NAME || DEFAULT_DATABASE_NAME
  if (!projectId) throw new Error("Missing RECURSIV_PROJECT_ID.")

  const results = []
  results.push(
    await fetchJson({
      label: "list",
      baseUrl,
      apiKey: apiKey.value,
      path: `/databases?${queryString({ project_id: projectId })}`,
    }),
  )
  results.push(
    await fetchJson({
      label: "credentials",
      baseUrl,
      apiKey: apiKey.value,
      path: `/databases/credentials?${queryString({ project_id: projectId, name: databaseName })}`,
    }),
  )
  results.push(
    await fetchJson({
      label: "query-select-1",
      baseUrl,
      apiKey: apiKey.value,
      path: "/databases/query",
      method: "POST",
      body: { project_id: projectId, database_name: databaseName, sql: "SELECT 1 AS ok", params: [] },
    }),
  )
  results.push(
    await fetchJson({
      label: "query-count-channel-items",
      baseUrl,
      apiKey: apiKey.value,
      path: "/databases/query",
      method: "POST",
      body: { project_id: projectId, database_name: databaseName, sql: "SELECT COUNT(*)::int AS count FROM channel_items", params: [] },
    }),
  )

  const credentialsError = results.find((result) => result.label === "credentials")?.body?.error
  const queryError = results.find((result) => result.label === "query-select-1")?.body?.error
  const diagnosis =
    credentialsError?.code === "credentials_not_found"
      ? "Recursiv can list the database, but its database service cannot retrieve Neon credentials. Repair the Recursiv database credentials path or provide a protected direct database URL for snapshot refresh."
      : queryError
        ? "Recursiv database query is failing. Inspect query and credentials errors before using --source=recursiv-api."
        : "Recursiv database API query path is usable."

  console.log(
    JSON.stringify(
      {
        ok: results.every((result) => result.ok),
        generatedAt: new Date().toISOString(),
        baseUrl,
        projectId,
        databaseName,
        keySource: apiKey.source,
        diagnosis,
        results,
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
