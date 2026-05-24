import dns from "node:dns/promises"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const DEFAULT_SLUG_HOST = "invertedworld.on.recursiv.io"
const DEFAULT_CUSTOM_DOMAIN = "www.inverted.world"
const DEFAULT_EXPECTED_TEXT = "Inverted World"
const DEFAULT_LEGACY_PROVIDER = "vercel"
const DEFAULT_VERCEL_IPS = ["76.76.21.21", "64.29.17.1", "64.29.17.65", "216.198.79.1", "216.198.79.65"]
const TIMEOUT_MS = Number(process.env.CUSTOM_DOMAIN_PREFLIGHT_TIMEOUT_MS || "20000")

function argValue(name) {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (exact) return exact.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) return process.argv[index + 1]
  return undefined
}

function argValues(name) {
  const values = []
  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index]
    if (arg.startsWith(`${name}=`)) {
      values.push(arg.slice(name.length + 1))
    } else if (arg === name && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) {
      values.push(process.argv[index + 1])
      index += 1
    }
  }
  return values
}

function normalizeUrl(value) {
  const raw = String(value || "").trim()
  if (!raw) return ""
  return raw.includes("://") ? raw : `https://${raw}`
}

function splitList(values) {
  return values
    .flatMap((value) => String(value || "").split(/[,\s]+/))
    .map((value) => value.trim())
    .filter(Boolean)
}

function defaultLegacyIps(legacyProvider) {
  return lowerIncludes(legacyProvider, "vercel") ? DEFAULT_VERCEL_IPS : []
}

function normalizeHostname(value) {
  const raw = normalizeUrl(value)
  if (!raw) return ""
  return new URL(raw).hostname
}

function lowerIncludes(value, needle) {
  return String(value || "").toLowerCase().includes(String(needle || "").toLowerCase())
}

function normalizeRoutePath(value) {
  const raw = String(value || "").trim()
  if (!raw) return "/"
  if (/^https?:\/\//i.test(raw)) {
    const parsed = new URL(raw)
    return `${parsed.pathname || "/"}${parsed.search || ""}`
  }
  return raw.startsWith("/") ? raw : `/${raw}`
}

function parseRouteSpec(value, defaultExpectedText) {
  const [rawPath, ...expectedParts] = String(value || "").split("::")
  const routePath = normalizeRoutePath(rawPath)
  const expectedText = expectedParts.join("::").trim() || defaultExpectedText
  return { path: routePath, expectedText }
}

function productRouteSpecs(defaultExpectedText) {
  const envRoutes = String(process.env.CUSTOM_DOMAIN_PREFLIGHT_PATHS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  return [...envRoutes, ...argValues("--path")].map((value) => parseRouteSpec(value, defaultExpectedText))
}

function parseJsonCheckSpec(value) {
  const [rawPath, rawJsonPath, rawOperator, ...expectedParts] = String(value || "").split("::")
  const routePath = normalizeRoutePath(rawPath)
  const jsonPath = String(rawJsonPath || "").trim()
  const operator = String(rawOperator || "exists").trim().toLowerCase()
  const expected = expectedParts.join("::").trim()

  if (!jsonPath) throw new Error(`JSON check is missing a path: ${value}`)

  return {
    path: routePath,
    jsonPath,
    operator,
    expected: expected || undefined,
  }
}

function jsonCheckSpecs() {
  const envChecks = String(process.env.CUSTOM_DOMAIN_PREFLIGHT_JSON_CHECKS || "")
    .split(/\n+/)
    .map((value) => value.trim())
    .filter(Boolean)
  return [...envChecks, ...argValues("--json-check")].map(parseJsonCheckSpec)
}

function parseStatusCheckSpec(value) {
  const [rawPath, rawStatus, ...labelParts] = String(value || "").split("::")
  const routePath = normalizeRoutePath(rawPath)
  const expectedStatus = Number(rawStatus)

  if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) {
    throw new Error(`Status check must include an HTTP status code, for example /removed::404: ${value}`)
  }

  return {
    path: routePath,
    expectedStatus,
    label: labelParts.join("::").trim() || undefined,
  }
}

function statusCheckSpecs() {
  const envChecks = String(process.env.CUSTOM_DOMAIN_PREFLIGHT_STATUS_CHECKS || "")
    .split(/\n+/)
    .map((value) => value.trim())
    .filter(Boolean)
  return [...envChecks, ...argValues("--status-check")].map(parseStatusCheckSpec)
}

function jsonPathSegments(jsonPath) {
  const normalized = String(jsonPath || "")
    .replace(/^\$\./, "")
    .replace(/^\$/, "")
    .replace(/\[(\d+)\]/g, ".$1")
  return normalized
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function valueAtJsonPath(data, jsonPath) {
  const segments = jsonPathSegments(jsonPath)
  if (!segments.length) return data

  let current = data
  for (const segment of segments) {
    if (current === undefined || current === null) return undefined
    if (segment === "length") {
      if (Array.isArray(current) || typeof current === "string") {
        current = current.length
        continue
      }
      if (typeof current === "object") {
        current = Object.keys(current).length
        continue
      }
      return undefined
    }
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)]
      continue
    }
    if (typeof current === "object" && segment in current) {
      current = current[segment]
      continue
    }
    return undefined
  }
  return current
}

function numericValue(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

function booleanish(value) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") return !["", "0", "false", "no", "null", "undefined"].includes(value.trim().toLowerCase())
  return Boolean(value)
}

function primitivePreview(value) {
  if (value === undefined) return undefined
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value
  if (Array.isArray(value)) return { type: "array", length: value.length }
  if (typeof value === "object") return { type: "object", keys: Object.keys(value).slice(0, 8) }
  return String(value)
}

function evaluateJsonCheck(data, spec) {
  const value = valueAtJsonPath(data, spec.jsonPath)
  const expected = spec.expected
  const operator = spec.operator
  let ok = false

  if (operator === "exists") {
    ok = value !== undefined && value !== null
  } else if (operator === "truthy") {
    ok = booleanish(value)
  } else if (operator === "falsy") {
    ok = !booleanish(value)
  } else if (operator === "eq") {
    ok = String(value) === String(expected)
  } else if (operator === "neq") {
    ok = String(value) !== String(expected)
  } else if (operator === "contains" || operator === "includes") {
    ok = Array.isArray(value) ? value.map(String).includes(String(expected)) : String(value || "").includes(String(expected))
  } else if (["gt", "gte", "lt", "lte"].includes(operator)) {
    const actualNumber = numericValue(value)
    const expectedNumber = numericValue(expected)
    ok =
      actualNumber !== undefined &&
      expectedNumber !== undefined &&
      ((operator === "gt" && actualNumber > expectedNumber) ||
        (operator === "gte" && actualNumber >= expectedNumber) ||
        (operator === "lt" && actualNumber < expectedNumber) ||
        (operator === "lte" && actualNumber <= expectedNumber))
  } else {
    throw new Error(`Unsupported JSON check operator: ${operator}`)
  }

  return {
    ...spec,
    found: value !== undefined && value !== null,
    value: primitivePreview(value),
    ok,
  }
}

async function probeHttp(url, expectedText, legacyProvider) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "RecursivCustomDomainPreflight/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const contentType = response.headers.get("content-type") || ""
    const shouldReadBody = /text\/html|text\/plain|application\/json|application\/ld\+json/i.test(contentType)
    const bodyText = shouldReadBody ? await response.text() : ""
    const title = bodyText.match(/<title>(.*?)<\/title>/i)?.[1]?.trim()
    const server = response.headers.get("server") || ""
    const xVercelId = response.headers.get("x-vercel-id") || ""
    const providerSignals = [server, xVercelId, response.headers.get("x-matched-path") || ""].filter(Boolean)

    return {
      url,
      status: response.status,
      ok: response.ok,
      redirected: response.status >= 300 && response.status < 400,
      location: response.headers.get("location") || undefined,
      server: server || undefined,
      xVercelId: xVercelId || undefined,
      title,
      containsExpectedText: expectedText ? bodyText.toLowerCase().includes(expectedText.toLowerCase()) : undefined,
      looksLikeLegacyProvider: providerSignals.some((value) => lowerIncludes(value, legacyProvider)),
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

async function probeProductRoutes(baseUrl, routes, legacyProvider) {
  return Promise.all(
    routes.map(async (route) => ({
      path: route.path,
      expectedText: route.expectedText,
      ...(await probeHttp(new URL(route.path, baseUrl).toString(), route.expectedText, legacyProvider)),
    })),
  )
}

function productRoutesReady(routes) {
  return routes.every((route) => route.ok && (route.expectedText ? route.containsExpectedText : true))
}

async function probeJsonCheckRoute(baseUrl, routePath, checks) {
  const url = new URL(routePath, baseUrl).toString()
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "RecursivCustomDomainPreflight/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const contentType = response.headers.get("content-type") || ""
    const bodyText = await response.text()
    let data
    let parseOk = false
    try {
      data = JSON.parse(bodyText)
      parseOk = true
    } catch {
      parseOk = false
    }

    return {
      path: routePath,
      url,
      status: response.status,
      ok: response.ok,
      contentType,
      parseOk,
      checks: parseOk ? checks.map((check) => evaluateJsonCheck(data, check)) : checks.map((check) => ({ ...check, ok: false })),
      durationMs: Date.now() - started,
    }
  } catch (error) {
    return {
      path: routePath,
      url,
      status: 0,
      ok: false,
      parseOk: false,
      message: error instanceof Error ? error.message : String(error),
      checks: checks.map((check) => ({ ...check, ok: false })),
      durationMs: Date.now() - started,
    }
  }
}

async function probeJsonChecks(baseUrl, checks) {
  const grouped = new Map()
  for (const check of checks) {
    const current = grouped.get(check.path) || []
    current.push(check)
    grouped.set(check.path, current)
  }

  return Promise.all([...grouped.entries()].map(([routePath, routeChecks]) => probeJsonCheckRoute(baseUrl, routePath, routeChecks)))
}

function jsonChecksReady(routes) {
  return routes.every((route) => route.ok && route.parseOk && route.checks.every((check) => check.ok))
}

async function probeStatusCheck(baseUrl, check, legacyProvider) {
  const url = new URL(check.path, baseUrl).toString()
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "RecursivCustomDomainPreflight/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const server = response.headers.get("server") || ""
    const xVercelId = response.headers.get("x-vercel-id") || ""
    const providerSignals = [server, xVercelId, response.headers.get("x-matched-path") || ""].filter(Boolean)

    return {
      ...check,
      url,
      status: response.status,
      ok: response.status === check.expectedStatus,
      httpOk: response.ok,
      redirected: response.status >= 300 && response.status < 400,
      location: response.headers.get("location") || undefined,
      server: server || undefined,
      xVercelId: xVercelId || undefined,
      contentType: response.headers.get("content-type") || undefined,
      looksLikeLegacyProvider: providerSignals.some((value) => lowerIncludes(value, legacyProvider)),
      durationMs: Date.now() - started,
    }
  } catch (error) {
    return {
      ...check,
      url,
      status: 0,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    }
  }
}

async function probeStatusChecks(baseUrl, checks, legacyProvider) {
  return Promise.all(checks.map((check) => probeStatusCheck(baseUrl, check, legacyProvider)))
}

function statusChecksReady(checks) {
  return checks.every((check) => check.ok)
}

async function probeDns(hostname, legacyProvider, legacyIps) {
  const [cname, a, aaaa] = await Promise.all([
    dns.resolveCname(hostname).catch(() => []),
    dns.resolve4(hostname).catch(() => []),
    dns.resolve6(hostname).catch(() => []),
  ])
  const legacyIpSet = new Set(legacyIps)
  return {
    hostname,
    cname,
    a,
    aaaa,
    legacyIpsMatched: a.filter((value) => legacyIpSet.has(value)),
    looksLikeLegacyProvider:
      cname.some((value) => lowerIncludes(value, legacyProvider)) || a.some((value) => legacyIpSet.has(value)),
  }
}

function usage() {
  return `Usage:
  pnpm recursiv:domain:preflight
  pnpm recursiv:domain:preflight -- --slug=customer.on.recursiv.io --custom-domain=www.customer.com --expected-text="Customer"

Options:
  --slug, --recursiv-url     Recursiv platform URL or host. Defaults to ${DEFAULT_SLUG_HOST}.
  --custom-domain            Custom hostname or URL. Defaults to ${DEFAULT_CUSTOM_DOMAIN}.
  --expected-text            Text that should appear on the Recursiv-hosted app. Defaults to ${DEFAULT_EXPECTED_TEXT}.
  --legacy-provider          Header/DNS provider string to flag as legacy. Defaults to ${DEFAULT_LEGACY_PROVIDER}.
  --legacy-ip                Legacy provider IP to flag. Repeatable. Defaults to known Vercel IPs when provider is Vercel.
  --path                     Product route to prove on the slug host and custom domain. Repeatable. Use /path::expected text to override expected text.
  --status-check             Route and expected HTTP status. Repeatable. Use /path::404 for intentionally removed routes.
  --json-check               Structured API gate. Repeatable. Format: /api/path::json.path::operator::expected.
                             Operators: exists, truthy, falsy, eq, neq, contains, includes, gt, gte, lt, lte.
                             Use .length for array/string/object counts, for example /api/articles::count::gte::12.
  --binding-proven           Set only after the Recursiv project/domain binding has been proven.
  --output                   Write the redacted JSON proof packet to a file.
  --require=hosted           Exit nonzero unless the Recursiv slug host is proven.
  --require=dns-change       Exit nonzero unless hosted proof and binding proof are both present.
  --require=cutover          Exit nonzero unless the custom domain is already serving the Recursiv app.
	`
}

async function writeJsonOutput(outputPath, report) {
  const resolved = path.resolve(outputPath)
  await mkdir(path.dirname(resolved), { recursive: true })
  await writeFile(resolved, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  return resolved
}

function requirementPassed(requireMode, decision) {
  if (!requireMode || requireMode === "none") return true
  if (requireMode === "hosted") return decision.recursivHostedUrlProven
  if (requireMode === "dns-change") return decision.dnsChangeReady
  if (requireMode === "cutover") return decision.customDomainAlreadyOnRecursiv
  throw new Error(`Unsupported --require value: ${requireMode}`)
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log(usage())
    return
  }

  const recursivUrl = normalizeUrl(argValue("--recursiv-url") || argValue("--slug") || process.env.RECURSIV_SITE_URL || DEFAULT_SLUG_HOST)
  const customDomainUrl = normalizeUrl(argValue("--custom-domain") || process.env.CUSTOM_DOMAIN || DEFAULT_CUSTOM_DOMAIN)
  const expectedText = argValue("--expected-text") || process.env.CUSTOM_DOMAIN_EXPECTED_TEXT || DEFAULT_EXPECTED_TEXT
  const legacyProvider = argValue("--legacy-provider") || process.env.LEGACY_PROVIDER || DEFAULT_LEGACY_PROVIDER
  const legacyIps = splitList([
    ...argValues("--legacy-ip"),
    process.env.LEGACY_PROVIDER_IPS,
    ...defaultLegacyIps(legacyProvider),
  ])
  const bindingProven = process.argv.includes("--binding-proven") || process.env.CUSTOM_DOMAIN_BINDING_PROVEN === "1"
  const outputPath = argValue("--output") || process.env.CUSTOM_DOMAIN_PREFLIGHT_OUTPUT
  const requireMode = argValue("--require") || process.env.CUSTOM_DOMAIN_PREFLIGHT_REQUIRE || "none"
  const customHostname = normalizeHostname(customDomainUrl)
  const routes = productRouteSpecs(expectedText)
  const jsonChecks = jsonCheckSpecs()
  const statusChecks = statusCheckSpecs()

  const [
    recursivHttp,
    customHttp,
    customDns,
    recursivProductRoutes,
    customDomainProductRoutes,
    recursivJsonChecks,
    customDomainJsonChecks,
    recursivStatusChecks,
    customDomainStatusChecks,
  ] = await Promise.all([
    probeHttp(recursivUrl, expectedText, legacyProvider),
    probeHttp(customDomainUrl, expectedText, legacyProvider),
    probeDns(customHostname, legacyProvider, legacyIps),
    probeProductRoutes(recursivUrl, routes, legacyProvider),
    probeProductRoutes(customDomainUrl, routes, legacyProvider),
    probeJsonChecks(recursivUrl, jsonChecks),
    probeJsonChecks(customDomainUrl, jsonChecks),
    probeStatusChecks(recursivUrl, statusChecks, legacyProvider),
    probeStatusChecks(customDomainUrl, statusChecks, legacyProvider),
  ])

  const recursivProductRoutesReady = productRoutesReady(recursivProductRoutes)
  const customDomainProductRoutesReady = productRoutesReady(customDomainProductRoutes)
  const recursivJsonChecksReady = jsonChecksReady(recursivJsonChecks)
  const customDomainJsonChecksReady = jsonChecksReady(customDomainJsonChecks)
  const recursivStatusChecksReady = statusChecksReady(recursivStatusChecks)
  const customDomainStatusChecksReady = statusChecksReady(customDomainStatusChecks)
  const recursivHostedUrlProven = Boolean(
    recursivHttp.ok &&
      (expectedText ? recursivHttp.containsExpectedText : true) &&
      recursivProductRoutesReady &&
      recursivJsonChecksReady &&
      recursivStatusChecksReady,
  )
  const customDomainLooksLegacy = Boolean(customHttp.looksLikeLegacyProvider || customDns.looksLikeLegacyProvider)
  const customDomainAlreadyOnRecursiv = Boolean(
    customHttp.ok &&
      !customDomainLooksLegacy &&
      (expectedText ? customHttp.containsExpectedText : true) &&
      customDomainProductRoutesReady &&
      customDomainJsonChecksReady &&
      customDomainStatusChecksReady,
  )
  const dnsChangeReady = Boolean(recursivHostedUrlProven && bindingProven)
  const legacyCleanupReady = Boolean(bindingProven && customDomainAlreadyOnRecursiv)

  const nextActions = []
  if (!recursivHostedUrlProven) {
    nextActions.push("Do not create or change custom-domain DNS until the Recursiv-hosted URL returns the expected app.")
    if (!recursivProductRoutesReady) nextActions.push("Fix the failing Recursiv-hosted product route checks before domain work.")
    if (!recursivJsonChecksReady) nextActions.push("Fix the failing Recursiv-hosted structured JSON checks before domain work.")
    if (!recursivStatusChecksReady) nextActions.push("Fix the failing Recursiv-hosted status-code checks before domain work.")
  } else if (!bindingProven) {
    nextActions.push("Create and prove the Recursiv custom-domain binding before changing DNS.")
  } else if (!customDomainAlreadyOnRecursiv) {
    nextActions.push(`Change only ${customHostname} to the Recursiv target, then rerun this proof.`)
    if (!customDomainProductRoutesReady) nextActions.push("After DNS propagation, rerun proof until the custom domain product routes match the Recursiv app.")
    if (!customDomainJsonChecksReady) nextActions.push("After DNS propagation, rerun proof until the custom domain structured JSON checks match the Recursiv app.")
    if (!customDomainStatusChecksReady) nextActions.push("After DNS propagation, rerun proof until the custom domain status-code checks match the Recursiv app.")
  } else {
    nextActions.push("Custom domain appears to serve the Recursiv app; monitor before removing the legacy host binding.")
  }

  const report = {
    generatedAt: new Date().toISOString(),
    inputs: {
      recursivUrl,
      customDomainUrl,
      customHostname,
      expectedText,
      legacyProvider,
      legacyIps,
      productRoutes: routes,
      jsonChecks,
      statusChecks,
      bindingProven,
      requireMode,
    },
    recursivHttp,
    recursivProductRoutes,
    recursivJsonChecks,
    recursivStatusChecks,
    customDomain: {
      http: customHttp,
      dns: customDns,
      productRoutes: customDomainProductRoutes,
      jsonChecks: customDomainJsonChecks,
      statusChecks: customDomainStatusChecks,
    },
    decision: {
      recursivHostedUrlProven,
      recursivProductRoutesReady,
      recursivJsonChecksReady,
      recursivStatusChecksReady,
      customDomainLooksLegacy,
      customDomainProductRoutesReady,
      customDomainJsonChecksReady,
      customDomainStatusChecksReady,
      customDomainAlreadyOnRecursiv,
      dnsChangeReady,
      legacyCleanupReady,
      keepDnsOnLegacy: !customDomainAlreadyOnRecursiv,
    },
    nextActions,
  }

  if (outputPath) {
    report.outputPath = await writeJsonOutput(outputPath, report)
  }

  console.log(JSON.stringify(report, null, 2))

  if (!requirementPassed(requireMode, report.decision)) {
    process.exitCode = 1
    console.error(
      JSON.stringify({
        error: "custom_domain_requirement_not_met",
        requireMode,
        decision: report.decision,
      },
      null,
      2,
    ),
    )
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
