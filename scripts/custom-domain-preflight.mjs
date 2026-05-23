import dns from "node:dns/promises"

const DEFAULT_SLUG_HOST = "invertedworld.on.recursiv.io"
const DEFAULT_CUSTOM_DOMAIN = "www.inverted.world"
const DEFAULT_EXPECTED_TEXT = "Inverted World"
const DEFAULT_LEGACY_PROVIDER = "vercel"
const TIMEOUT_MS = Number(process.env.CUSTOM_DOMAIN_PREFLIGHT_TIMEOUT_MS || "20000")

function argValue(name) {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (exact) return exact.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) return process.argv[index + 1]
  return undefined
}

function normalizeUrl(value) {
  const raw = String(value || "").trim()
  if (!raw) return ""
  return raw.includes("://") ? raw : `https://${raw}`
}

function normalizeHostname(value) {
  const raw = normalizeUrl(value)
  if (!raw) return ""
  return new URL(raw).hostname
}

function lowerIncludes(value, needle) {
  return String(value || "").toLowerCase().includes(String(needle || "").toLowerCase())
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
    const isHtml = contentType.includes("text/html")
    const html = isHtml ? await response.text() : ""
    const title = html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim()
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
      containsExpectedText: expectedText ? html.toLowerCase().includes(expectedText.toLowerCase()) : undefined,
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

async function probeDns(hostname, legacyProvider) {
  const [cname, a, aaaa] = await Promise.all([
    dns.resolveCname(hostname).catch(() => []),
    dns.resolve4(hostname).catch(() => []),
    dns.resolve6(hostname).catch(() => []),
  ])
  return {
    hostname,
    cname,
    a,
    aaaa,
    looksLikeLegacyProvider: cname.some((value) => lowerIncludes(value, legacyProvider)),
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
  --binding-proven           Set only after the Recursiv project/domain binding has been proven.
`
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
  const bindingProven = process.argv.includes("--binding-proven") || process.env.CUSTOM_DOMAIN_BINDING_PROVEN === "1"
  const customHostname = normalizeHostname(customDomainUrl)

  const [recursivHttp, customHttp, customDns] = await Promise.all([
    probeHttp(recursivUrl, expectedText, legacyProvider),
    probeHttp(customDomainUrl, expectedText, legacyProvider),
    probeDns(customHostname, legacyProvider),
  ])

  const recursivHostedUrlProven = Boolean(recursivHttp.ok && (expectedText ? recursivHttp.containsExpectedText : true))
  const customDomainLooksLegacy = Boolean(customHttp.looksLikeLegacyProvider || customDns.looksLikeLegacyProvider)
  const customDomainAlreadyOnRecursiv = Boolean(customHttp.ok && !customDomainLooksLegacy && (expectedText ? customHttp.containsExpectedText : true))
  const dnsChangeReady = Boolean(recursivHostedUrlProven && bindingProven)

  const nextActions = []
  if (!recursivHostedUrlProven) {
    nextActions.push("Do not create or change custom-domain DNS until the Recursiv-hosted URL returns the expected app.")
  } else if (!bindingProven) {
    nextActions.push("Create and prove the Recursiv custom-domain binding before changing DNS.")
  } else if (!customDomainAlreadyOnRecursiv) {
    nextActions.push(`Change only ${customHostname} to the Recursiv target, then rerun this proof.`)
  } else {
    nextActions.push("Custom domain appears to serve the Recursiv app; monitor before removing the legacy host binding.")
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        inputs: {
          recursivUrl,
          customDomainUrl,
          customHostname,
          expectedText,
          legacyProvider,
          bindingProven,
        },
        recursivHttp,
        customDomain: {
          http: customHttp,
          dns: customDns,
        },
        decision: {
          recursivHostedUrlProven,
          customDomainLooksLegacy,
          customDomainAlreadyOnRecursiv,
          dnsChangeReady,
          keepDnsOnLegacy: !customDomainAlreadyOnRecursiv,
        },
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
