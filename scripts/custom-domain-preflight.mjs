import dns from "node:dns/promises"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const DEFAULT_SLUG_HOST = "invertedworld.on.recursiv.io"
const DEFAULT_CUSTOM_DOMAIN = "www.inverted.world"
const DEFAULT_EXPECTED_TEXT = "Inverted World"
const DEFAULT_LEGACY_PROVIDER = "vercel"
const DEFAULT_VERCEL_IPS = ["76.76.21.21", "64.29.17.1", "64.29.17.65"]
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

  const [recursivHttp, customHttp, customDns, recursivProductRoutes, customDomainProductRoutes] = await Promise.all([
    probeHttp(recursivUrl, expectedText, legacyProvider),
    probeHttp(customDomainUrl, expectedText, legacyProvider),
    probeDns(customHostname, legacyProvider, legacyIps),
    probeProductRoutes(recursivUrl, routes, legacyProvider),
    probeProductRoutes(customDomainUrl, routes, legacyProvider),
  ])

  const recursivProductRoutesReady = productRoutesReady(recursivProductRoutes)
  const customDomainProductRoutesReady = productRoutesReady(customDomainProductRoutes)
  const recursivHostedUrlProven = Boolean(
    recursivHttp.ok && (expectedText ? recursivHttp.containsExpectedText : true) && recursivProductRoutesReady,
  )
  const customDomainLooksLegacy = Boolean(customHttp.looksLikeLegacyProvider || customDns.looksLikeLegacyProvider)
  const customDomainAlreadyOnRecursiv = Boolean(
    customHttp.ok &&
      !customDomainLooksLegacy &&
      (expectedText ? customHttp.containsExpectedText : true) &&
      customDomainProductRoutesReady,
  )
  const dnsChangeReady = Boolean(recursivHostedUrlProven && bindingProven)
  const legacyCleanupReady = Boolean(bindingProven && customDomainAlreadyOnRecursiv)

  const nextActions = []
  if (!recursivHostedUrlProven) {
    nextActions.push("Do not create or change custom-domain DNS until the Recursiv-hosted URL returns the expected app.")
    if (!recursivProductRoutesReady) nextActions.push("Fix the failing Recursiv-hosted product route checks before domain work.")
  } else if (!bindingProven) {
    nextActions.push("Create and prove the Recursiv custom-domain binding before changing DNS.")
  } else if (!customDomainAlreadyOnRecursiv) {
    nextActions.push(`Change only ${customHostname} to the Recursiv target, then rerun this proof.`)
    if (!customDomainProductRoutesReady) nextActions.push("After DNS propagation, rerun proof until the custom domain product routes match the Recursiv app.")
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
      bindingProven,
      requireMode,
    },
    recursivHttp,
    recursivProductRoutes,
    customDomain: {
      http: customHttp,
      dns: customDns,
      productRoutes: customDomainProductRoutes,
    },
    decision: {
      recursivHostedUrlProven,
      recursivProductRoutesReady,
      customDomainLooksLegacy,
      customDomainProductRoutesReady,
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
