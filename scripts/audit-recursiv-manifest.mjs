import fs from "node:fs"
import path from "node:path"

const REQUIRED_TABLES = [
  "channel_items",
  "coverage_snapshots",
  "x_signals",
  "article_drafts",
  "generated_assets",
  "claim_dossiers",
  "claim_sources",
  "source_documents",
  "media_items",
  "claim_chat_messages",
  "front_page_editions",
  "pipeline_runs",
]

const REQUIRED_JOB_ENDPOINT_OPTIONS = {
  "inverted-world-topic-pulse": ["async=1", "profileReader=1"],
  "inverted-world-full-pipeline": ["async=1", "profileReader=1"],
}

function read(file) {
  return fs.readFileSync(file, "utf8")
}

function extractConstArray(content, name) {
  const start = content.indexOf(`const ${name} = [`)
  if (start < 0) return ""
  const end = content.indexOf("\n]", start)
  return end < 0 ? "" : content.slice(start, end + 2)
}

function quotedItems(block) {
  return [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

function createTableNames(content) {
  return [...content.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/gi)].map((match) => match[1])
}

function provisionJobs(block) {
  const names = [...block.matchAll(/name:\s*"([^"]+)"/g)].map((match) => match[1])
  const endpoints = [...block.matchAll(/endpoint:\s*"([^"]+)"/g)].map((match) => match[1])
  return names.map((name, index) => ({ name, endpoint: endpoints[index] || "" }))
}

function difference(left, right) {
  const rightSet = new Set(right)
  return left.filter((item) => !rightSet.has(item))
}

function routeFileForEndpoint(endpoint) {
  const pathname = endpoint.split("?")[0]
  return path.join("app", pathname, "route.ts")
}

function pass(label, details = {}) {
  return { label, ok: true, ...details }
}

function fail(label, details = {}) {
  return { label, ok: false, ...details }
}

function main() {
  const schema = read("lib/recursiv/schema.ts")
  const provision = read("scripts/provision-recursiv-backend.mjs")
  const cutover = read("scripts/cutover-readiness.mjs")
  const packageJson = JSON.parse(read("package.json"))

  const schemaTableList = quotedItems(extractConstArray(schema, "INVERTED_WORLD_TABLES"))
  const schemaCreateTables = createTableNames(schema)
  const provisionCreateTables = createTableNames(provision)
  const jobs = provisionJobs(extractConstArray(provision, "JOBS"))
  const provisionJobNames = jobs.map((job) => job.name)
  const expectedCutoverJobs = quotedItems(extractConstArray(cutover, "EXPECTED_JOBS"))

  const checks = []
  checks.push(
    difference(REQUIRED_TABLES, schemaTableList).length
      ? fail("schema table list includes required tables", { missing: difference(REQUIRED_TABLES, schemaTableList) })
      : pass("schema table list includes required tables", { count: schemaTableList.length }),
  )
  checks.push(
    difference(REQUIRED_TABLES, schemaCreateTables).length
      ? fail("schema SQL creates required tables", { missing: difference(REQUIRED_TABLES, schemaCreateTables) })
      : pass("schema SQL creates required tables", { count: schemaCreateTables.length }),
  )
  checks.push(
    difference(REQUIRED_TABLES, provisionCreateTables).length
      ? fail("provision SQL creates required tables", { missing: difference(REQUIRED_TABLES, provisionCreateTables) })
      : pass("provision SQL creates required tables", { count: provisionCreateTables.length }),
  )

  const missingFromCutover = difference(provisionJobNames, expectedCutoverJobs)
  const missingFromProvision = difference(expectedCutoverJobs, provisionJobNames)
  checks.push(
    missingFromCutover.length || missingFromProvision.length
      ? fail("provision jobs match cutover expected jobs", { missingFromCutover, missingFromProvision })
      : pass("provision jobs match cutover expected jobs", { count: provisionJobNames.length }),
  )

  const missingRouteFiles = jobs
    .map((job) => ({ job: job.name, endpoint: job.endpoint, routeFile: routeFileForEndpoint(job.endpoint) }))
    .filter((job) => !fs.existsSync(job.routeFile))
  checks.push(
    missingRouteFiles.length
      ? fail("scheduled job endpoints have route files", { missingRouteFiles })
      : pass("scheduled job endpoints have route files", { count: jobs.length }),
  )

  const endpointOptionFindings = jobs.flatMap((job) => {
    const requiredOptions = REQUIRED_JOB_ENDPOINT_OPTIONS[job.name] || ["async=1"]
    const missingOptions = requiredOptions.filter((option) => !job.endpoint.includes(option))
    return missingOptions.length ? [{ job: job.name, endpoint: job.endpoint, missingOptions }] : []
  })
  checks.push(
    endpointOptionFindings.length
      ? fail("scheduled job endpoints include required async/profile options", { findings: endpointOptionFindings })
      : pass("scheduled job endpoints include required async/profile options", { count: jobs.length }),
  )

  checks.push(
    packageJson.scripts?.["recursiv:manifest:audit"] === "node scripts/audit-recursiv-manifest.mjs"
      ? pass("package script exposes manifest audit")
      : fail("package script exposes manifest audit"),
  )

  const findings = checks.filter((check) => !check.ok)
  const report = {
    ok: findings.length === 0,
    checkedAt: new Date().toISOString(),
    requiredTables: REQUIRED_TABLES.length,
    provisionedJobs: jobs.length,
    checks,
  }

  console.log(JSON.stringify(report, null, 2))
  if (findings.length) process.exit(1)
}

main()
