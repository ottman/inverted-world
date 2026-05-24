import dns from "node:dns/promises"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { Recursiv } from "@recursiv/sdk"

const LOCAL_RECURSIV_KEY = "/private/tmp/inverted-world-recursiv-key"
const DEFAULT_BASE_URL = "https://api.recursiv.io/api/v1"
const DEFAULT_SITE_URL = "https://invertedworld.on.recursiv.io"
const DEFAULT_CUSTOM_DOMAIN = "https://www.inverted.world"
const DEFAULT_DATABASE_NAME = "inverted_world_research"
const READINESS_TIMEOUT_MS = Number(process.env.CUTOVER_READINESS_TIMEOUT_MS || "30000")
const DOSSIER_CHAT_PROOF_SLUG = "secret-programs-the-top-secret-testimony-of-cia-s-mkultra-chief-50-years-later-national-security"
const DOSSIER_CHAT_PROOF_QUESTION = "What is actually documented here? Link me to the key sources."
const ARTICLE_CHAT_PROOF_SLUG = "uap-disclosure-the-pursue-protocol-pentagon-drops-never-before-seen-uap-files-under-presidential-order"
const ARTICLE_CHAT_PROOF_QUESTION = "What is actually documented in this article? Link the sources and archive context."
const X_SIGNAL_PROOF_TOPIC = "secret-programs"
const X_SIGNAL_MIN_POSTS = Number(process.env.CUTOVER_X_SIGNAL_MIN_POSTS || "12")
const X_SIGNAL_MAX_AGE_HOURS = Number(process.env.CUTOVER_X_SIGNAL_MAX_AGE_HOURS || "192")
const PIPELINE_MAX_AGE_HOURS = Number(process.env.CUTOVER_PIPELINE_MAX_AGE_HOURS || "36")
const ARCHIVE_REQUIRED_TOPIC_IDS = [
  "uap-disclosure",
  "secret-programs",
  "epstein-networks",
  "cryptids-paranormal",
  "ai-technocracy",
  "space-anomalies",
]
const ARCHIVE_MIN_TOTAL_COUNT = Number(process.env.CUTOVER_ARCHIVE_MIN_TOTAL_COUNT || "100")
const ARCHIVE_MIN_TOPIC_COUNT = Number(process.env.CUTOVER_ARCHIVE_MIN_TOPIC_COUNT || "12")
const ARCHIVE_MAX_DOMINANT_TOPIC_SHARE = Number(process.env.CUTOVER_ARCHIVE_MAX_DOMINANT_TOPIC_SHARE || "0.7")
const ARTICLE_MIN_COUNT = Number(process.env.CUTOVER_ARTICLE_MIN_COUNT || "12")
const ARTICLE_MIN_THUMBNAILS = Number(process.env.CUTOVER_ARTICLE_MIN_THUMBNAILS || "8")
const ARTICLE_MIN_TOPICS = Number(process.env.CUTOVER_ARTICLE_MIN_TOPICS || "4")
const ARTICLE_MIN_EXTERNAL_SOURCES = Number(process.env.CUTOVER_ARTICLE_MIN_EXTERNAL_SOURCES || "8")
const AUTOPOST_MIN_SOURCES = Number(process.env.CUTOVER_AUTOPOST_MIN_SOURCES || "8")
const AUTOPOST_MIN_HEADLINES = Number(process.env.CUTOVER_AUTOPOST_MIN_HEADLINES || "3")
const AUTOPOST_MIN_THREAD_POSTS = Number(process.env.CUTOVER_AUTOPOST_MIN_THREAD_POSTS || "3")
const AUTOPOST_MIN_IMAGES = Number(process.env.CUTOVER_AUTOPOST_MIN_IMAGES || "2")
const ARTICLE_LANE_TITLES = ["Skywatch", "Declassified", "Power Web", "High Strangeness", "Machine State", "Off-World Signals"]

const EXPECTED_JOBS = [
  "inverted-world-youtube-archive-sync",
  "inverted-world-topic-pulse",
  "inverted-world-worldwire",
  "inverted-world-article-generation",
  "inverted-world-claim-dossiers",
  "inverted-world-source-documents",
  "inverted-world-media-library",
  "inverted-world-image-generation",
  "inverted-world-publishing",
  "inverted-world-front-page-edition",
  "inverted-world-daily-autopost",
  "inverted-world-full-pipeline",
  "inverted-world-pipeline-maintenance",
  "inverted-world-provider-health",
]

const REQUIRED_PROVIDERS = [
  "recursiv-database",
  "x-api",
  "exa",
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

function readArgValue(name) {
  const exact = `--${name}`
  const prefix = `${exact}=`
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index]
    if (arg === exact) return process.argv[index + 1] || ""
    if (arg.startsWith(prefix)) return arg.slice(prefix.length)
  }
  return ""
}

function dataSourceStatus(sourceMode) {
  if (sourceMode === "recursiv-database") return "live-database"
  if (sourceMode === "recursiv-snapshot") return "recursiv-export-snapshot"
  if (sourceMode) return String(sourceMode)
  return "unknown"
}

function normalizeHostname(value) {
  const raw = String(value || "").trim().toLowerCase()
  if (!raw) return ""
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname
  } catch {
    return raw.replace(/^https?:\/\//, "").split("/")[0].split(":")[0]
  }
}

function parseDeploymentHostnames(deployment) {
  const rawValues = [
    deployment?.deployment_url,
    deployment?.coolify_domain,
    deployment?.coolifyDomain,
    deployment?.domains,
  ]
  const hostnames = new Set()
  for (const rawValue of rawValues) {
    if (!rawValue) continue
    for (const part of String(rawValue).split(",")) {
      const hostname = normalizeHostname(part)
      if (hostname) hostnames.add(hostname)
    }
  }
  return [...hostnames].sort()
}

function latestByCreatedAt(items) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.created_at || left.started_at || 0).getTime()
    const rightTime = new Date(right.created_at || right.started_at || 0).getTime()
    return rightTime - leftTime
  })[0]
}

function currentCommitHash() {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim()
  } catch {
    return undefined
  }
}

function runPublicProviderAudit() {
  try {
    const output = execFileSync("node", ["scripts/audit-public-provider-fallbacks.mjs"], {
      encoding: "utf8",
      timeout: 15_000,
    })
    return JSON.parse(output)
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout) : ""
    const stderr = error?.stderr ? String(error.stderr) : ""
    for (const text of [stdout, stderr]) {
      try {
        const parsed = JSON.parse(text)
        return { ...parsed, ok: false }
      } catch {
        // Continue to the generic error shape.
      }
    }

    return {
      ok: false,
      auditedFiles: 0,
      findings: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function runRecursivManifestAudit() {
  try {
    const output = execFileSync("node", ["scripts/audit-recursiv-manifest.mjs"], {
      encoding: "utf8",
      timeout: 15_000,
    })
    return JSON.parse(output)
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout) : ""
    const stderr = error?.stderr ? String(error.stderr) : ""
    for (const text of [stdout, stderr]) {
      try {
        const parsed = JSON.parse(text)
        return { ...parsed, ok: false }
      } catch {
        // Continue to the generic error shape.
      }
    }

    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      checks: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function normalizeCommit(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-f0-9]/g, "")
}

function commitsMatch(actual, expected) {
  const actualCommit = normalizeCommit(actual)
  const expectedCommit = normalizeCommit(expected)
  if (actualCommit.length < 7 || expectedCommit.length < 7) return null
  return actualCommit.startsWith(expectedCommit) || expectedCommit.startsWith(actualCommit)
}

function ageMinutes(value) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000))
}

function deploymentCommitHash(deployment) {
  return deployment?.commit_hash || deployment?.commitHash || deployment?.source_revision || deployment?.sourceRevision || ""
}

function releaseRevisionProof(releaseApi, latestDeployment, deploymentLookupAvailable) {
  const releaseRevision = releaseApi.deployment?.sourceRevision
  if (releaseRevision) {
    return {
      value: releaseRevision,
      source: releaseApi.deployment?.sourceRevisionSource || "release-api",
      fromReleaseApi: true,
    }
  }

  const deploymentRevision = deploymentLookupAvailable ? deploymentCommitHash(latestDeployment) : ""
  if (deploymentRevision) {
    return {
      value: deploymentRevision,
      source: "recursiv-deployment.commit_hash",
      fromReleaseApi: false,
    }
  }

  return {
    value: null,
    source: null,
    fromReleaseApi: false,
  }
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

async function probeNewsPage(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    })
    const contentType = response.headers.get("content-type") || ""
    const html = contentType.includes("text/html") ? await response.text() : ""
    const externalSourceLinks = (html.match(/href="https?:\/\/(?!www\.inverted\.world|invertedworld\.on\.recursiv\.io)[^"]+"/g) || []).length
    const contextLinks = (html.match(/href="\/news\/[^"]+"/g) || []).length
    const sourceLabels = (html.match(/target="_blank"/g) || []).length

    return {
      url,
      status: response.status,
      ok: response.ok,
      title: html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim(),
      hasSourceSheet: /source sheet|outside world, sorted by heat|original sources first/i.test(html),
      hasNewsMetrics: /ranked links|source hosts|lanes/i.test(html),
      hasEmptyState: /current source board has no ranked links/i.test(html),
      externalSourceLinks,
      contextLinks,
      sourceLabels,
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

async function probeArticleStoryPage(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    })
    const contentType = response.headers.get("content-type") || ""
    const html = contentType.includes("text/html") ? await response.text() : ""
    const externalSourceLinks = (html.match(/href="https?:\/\/(?!www\.inverted\.world|invertedworld\.on\.recursiv\.io)[^"]+"/g) || []).length
    const archiveLinks = (html.match(/href="\/archive\/[^"]+"/g) || []).length

    return {
      url,
      status: response.status,
      ok: response.ok,
      title: html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim(),
      hasSources: /<h2[^>]*>Sources<\/h2>|Sources/i.test(html),
      hasTalesContext: /Tales Context/i.test(html),
      hasAskThisStory: /Ask This Story/i.test(html),
      hasArticleChatEndpoint: /\/api\/articles\/[^"]+\/chat/.test(html),
      hasKeepReadingFallback: /Keep Reading/i.test(html),
      externalSourceLinks,
      archiveLinks,
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

async function probeXSignalPage(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    })
    const contentType = response.headers.get("content-type") || ""
    const html = contentType.includes("text/html") ? await response.text() : ""
    const outboundXLinks = (html.match(/href="https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//g) || []).length
    const postAnchors = (html.match(/id="signal-[^"]+"/g) || []).length
    const tickerAnchorLinks = (html.match(/href="#signal-[^"]+"/g) || []).length

    return {
      url,
      status: response.status,
      ok: response.ok,
      title: html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim(),
      hasLiveStream: /Live X Stream/i.test(html),
      hasRankedPosts: /ranked posts/i.test(html),
      hasOpenSearch: /Open X search/i.test(html),
      hasEmptyState: /This lane is waiting for a strong post/i.test(html),
      outboundXLinks,
      postAnchors,
      tickerAnchorLinks,
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

async function probeXSignalApi(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      signal: AbortSignal.timeout(20000),
    })
    const body = await response.json().catch(() => ({}))
    const posts = Array.isArray(body.posts) ? body.posts : []
    const createdTimes = posts
      .map((post) => new Date(post?.createdAt || post?.postedAt || "").getTime())
      .filter(Number.isFinite)
    const latestPostAt = createdTimes.length ? new Date(Math.max(...createdTimes)).toISOString() : undefined
    const sourceCount = new Set(posts.map((post) => post?.source).filter(Boolean)).size
    const xLinkCount = posts.filter((post) => /^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i.test(String(post?.url || ""))).length

    return {
      url,
      status: response.status,
      ok: response.ok,
      topicId: typeof body.topic?.id === "string" ? body.topic.id : undefined,
      freshnessWindowHours: Number(body.freshnessWindowHours || 0),
      postCount: posts.length,
      sourceCount,
      xLinkCount,
      latestPostAt,
      latestPostAgeMinutes: ageMinutes(latestPostAt),
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

async function probeRemovedRoute(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    })

    return {
      url,
      status: response.status,
      removed: response.status === 404,
      contentType: response.headers.get("content-type") || undefined,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    return {
      url,
      status: 0,
      removed: false,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    }
  }
}

async function probeArchiveApi(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      signal: AbortSignal.timeout(20000),
    })
    const body = await response.json().catch(() => ({}))
    const videos = Array.isArray(body.videos) ? body.videos : []
    const topicCounts = {}
    for (const video of videos) {
      const topicId = typeof video?.topicId === "string" ? video.topicId : typeof video?.topic_id === "string" ? video.topic_id : ""
      if (!topicId) continue
      topicCounts[topicId] = (topicCounts[topicId] || 0) + 1
    }
    const totalCount = Number(body.totalCount || videos.length || 0)
    const topicCount = Object.keys(topicCounts).length
    const requiredTopicCounts = Object.fromEntries(
      ARCHIVE_REQUIRED_TOPIC_IDS.map((topicId) => [topicId, Number(topicCounts[topicId] || 0)]),
    )
    const requiredTopicsBelowMinimum = ARCHIVE_REQUIRED_TOPIC_IDS.filter(
      (topicId) => Number(topicCounts[topicId] || 0) < ARCHIVE_MIN_TOPIC_COUNT,
    )
    const dominantTopic = Object.entries(topicCounts).sort((left, right) => Number(right[1]) - Number(left[1]))[0]
    const dominantTopicShare = totalCount > 0 && dominantTopic ? Number(dominantTopic[1]) / totalCount : 0

    return {
      url,
      status: response.status,
      ok: response.ok,
      sourceMode: body.sourceMode,
      totalCount,
      returnedVideoCount: videos.length,
      hasMore: Boolean(body.hasMore),
      warningCount: Array.isArray(body.warnings) ? body.warnings.length : 0,
      topicCount,
      topicCounts,
      requiredTopicCounts,
      requiredTopicsBelowMinimum,
      minRequiredTopicCount: Math.min(...Object.values(requiredTopicCounts)),
      dominantTopicId: dominantTopic?.[0],
      dominantTopicCount: Number(dominantTopic?.[1] || 0),
      dominantTopicShare: Number(dominantTopicShare.toFixed(3)),
      coverageThresholds: {
        requiredTopicIds: ARCHIVE_REQUIRED_TOPIC_IDS,
        minTotalCount: ARCHIVE_MIN_TOTAL_COUNT,
        minTopicCount: ARCHIVE_MIN_TOPIC_COUNT,
        maxDominantTopicShare: ARCHIVE_MAX_DOMINANT_TOPIC_SHARE,
      },
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

function hasRepeatedLanePrefix(title) {
  return ARTICLE_LANE_TITLES.some((lane) => {
    const escaped = lane.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`^(?:${escaped}\\s*:\\s*){2,}`, "i").test(String(title || ""))
  })
}

function hasTemplatedArticleBody(article) {
  const body = Array.isArray(article?.body) ? article.body.join("\n") : ""
  const deck = String(article?.deck || "")
  return /(^|\n)(Signal|Documented record|Source split|X velocity|Tales context|Viral frame):/i.test(body) || /Latest sourced reporting/i.test(deck)
}

async function probeArticlesApi(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      signal: AbortSignal.timeout(20000),
    })
    const body = await response.json().catch(() => ({}))
    const articles = Array.isArray(body.articles) ? body.articles : []
    const topicCount = new Set(articles.map((article) => article?.topicId).filter(Boolean)).size
    const thumbnailUrls = articles
      .map((article) => article?.thumbnail?.imageUrl)
      .filter((value) => typeof value === "string" && value.length > 0)
    const generatedThumbnailCount = thumbnailUrls.filter((value) => /^data:image\/svg\+xml/i.test(value) || /generated|assets|thumbnail/i.test(value)).length
    const externalSourceCount = articles.filter((article) => /^https?:\/\//i.test(String(article?.sourceUrl || ""))).length
    const repeatedLanePrefixCount = articles.filter((article) => hasRepeatedLanePrefix(article?.title)).length
    const templatedArticleCount = articles.filter(hasTemplatedArticleBody).length

    return {
      url,
      status: response.status,
      ok: response.ok,
      sourceMode: body.sourceMode,
      count: Number(body.count || articles.length || 0),
      articleCount: articles.length,
      topicCount,
      thumbnailCount: thumbnailUrls.length,
      generatedThumbnailCount,
      externalSourceCount,
      repeatedLanePrefixCount,
      templatedArticleCount,
      firstArticleId: typeof articles[0]?.id === "string" ? articles[0].id : undefined,
      firstArticleTitle: typeof articles[0]?.title === "string" ? articles[0].title : undefined,
      warningCount: Array.isArray(body.warnings) ? body.warnings.length : 0,
      thresholds: {
        minArticles: ARTICLE_MIN_COUNT,
        minThumbnails: ARTICLE_MIN_THUMBNAILS,
        minTopics: ARTICLE_MIN_TOPICS,
        minExternalSources: ARTICLE_MIN_EXTERNAL_SOURCES,
      },
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

async function probeAutopostApi(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      signal: AbortSignal.timeout(20000),
    })
    const body = await response.json().catch(() => ({}))
    const autopost = body.autopost && typeof body.autopost === "object" ? body.autopost : {}
    const readiness = body.readiness && typeof body.readiness === "object" ? body.readiness : {}
    const sourcePack = Array.isArray(autopost.sourcePack) ? autopost.sourcePack : []
    const headlineVariants = Array.isArray(autopost.headlineVariants) ? autopost.headlineVariants : []
    const xThread = Array.isArray(autopost.xThread) ? autopost.xThread : []
    const imagePrompts = Array.isArray(autopost.imagePrompts) ? autopost.imagePrompts : []
    const links = autopost.links && typeof autopost.links === "object" ? autopost.links : {}
    const primaryPost = typeof autopost.primaryPost === "string" ? autopost.primaryPost : ""
    const canonicalUrl = typeof autopost.canonicalUrl === "string" ? autopost.canonicalUrl : ""
    const distributionText = [primaryPost, ...headlineVariants, ...xThread].join("\n")

    return {
      url,
      status: response.status,
      ok: response.ok,
      sourceMode: body.sourceMode,
      packetStatus: typeof body.status === "string" ? body.status : undefined,
      readinessReady: Boolean(readiness.ready),
      canonicalUrl,
      sourcePackCount: Number(readiness.sourcePackCount || sourcePack.length || 0),
      headlineVariantCount: Number(readiness.headlineVariantCount || headlineVariants.length || 0),
      xThreadCount: Number(readiness.xThreadCount || xThread.length || 0),
      imagePromptCount: Number(readiness.imagePromptCount || imagePrompts.length || 0),
      articleLinkCount: Number(readiness.articleLinkCount || (Array.isArray(links.articles) ? links.articles.length : 0)),
      dossierLinkCount: Number(readiness.dossierLinkCount || (Array.isArray(links.dossiers) ? links.dossiers.length : 0)),
      xSignalLinkCount: Number(readiness.xSignalLinkCount || (Array.isArray(links.xSignals) ? links.xSignals.length : 0)),
      archiveVideoLinkCount: Number(readiness.archiveVideoLinkCount || (Array.isArray(links.archiveVideos) ? links.archiveVideos.length : 0)),
      hasGuardrails: Array.isArray(autopost.guardrails) && autopost.guardrails.length >= 3,
      hasPrimaryPost: primaryPost.length >= 80 && /^https?:\/\//i.test(canonicalUrl),
      noWarmupLanguage: !/warming|warm up|placeholder|coming soon|not configured/i.test(distributionText),
      thresholds: {
        minSources: AUTOPOST_MIN_SOURCES,
        minHeadlines: AUTOPOST_MIN_HEADLINES,
        minThreadPosts: AUTOPOST_MIN_THREAD_POSTS,
        minImagePrompts: AUTOPOST_MIN_IMAGES,
      },
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

async function probeStoryChatApi(url, message) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "InvertedWorldCutoverReadiness/1.0",
      },
      body: JSON.stringify({
        message,
        contextOnly: true,
        persist: false,
      }),
      signal: AbortSignal.timeout(20000),
    })
    const body = await response.json().catch(() => ({}))
    const answer = typeof body.response === "string" ? body.response : ""

    return {
      url,
      status: response.status,
      ok: response.ok,
      mode: typeof body.mode === "string" ? body.mode : undefined,
      stored: Boolean(body.stored),
      responseLength: answer.length,
      hasMarkdown: /\*\*[^*]+\*\*/.test(answer) && /^- /m.test(answer),
      hasSourceLinks: /\]\(https?:\/\//.test(answer),
      hasArchiveLinks: /\]\(\/archive\//.test(answer),
      hasNoDeadEndLanguage: !/not configured|unavailable|failed|error/i.test(answer),
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

async function probeReleaseApi(url) {
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
      name: typeof body.name === "string" ? body.name : undefined,
      release: typeof body.release === "string" ? body.release : undefined,
      worldwireJsonbPayloads:
        body.features && typeof body.features.worldwireJsonbPayloads === "string"
          ? body.features.worldwireJsonbPayloads
          : undefined,
      pipelineSnapshotFallback: Boolean(body.features?.pipelineSnapshotFallback),
      dnsCutoverRequiresCustomDomainProof: Boolean(body.features?.dnsCutoverRequiresCustomDomainProof),
      deployment:
        body.deployment && typeof body.deployment === "object"
          ? {
              buildId: typeof body.deployment.buildId === "string" ? body.deployment.buildId : undefined,
              sourceRevision:
                typeof body.deployment.sourceRevision === "string" ? body.deployment.sourceRevision : undefined,
              sourceRevisionSource:
                typeof body.deployment.sourceRevisionSource === "string" ? body.deployment.sourceRevisionSource : undefined,
              recursivDeploymentId:
                typeof body.deployment.recursivDeploymentId === "string" ? body.deployment.recursivDeploymentId : undefined,
            }
          : undefined,
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

async function probePipelineApi(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      signal: AbortSignal.timeout(20000),
    })
    const body = await response.json().catch(() => ({}))
    const latest = body.latest && typeof body.latest === "object" ? body.latest : {}
    const readHealth = body.readHealth && typeof body.readHealth === "object" ? body.readHealth : {}
    const latestCompletedAt = typeof latest.completedAt === "string" ? latest.completedAt : undefined

    return {
      url,
      status: response.status,
      ok: response.ok,
      sourceMode: body.sourceMode,
      count: Number(body.count || 0),
      latestJobName: typeof latest.jobName === "string" ? latest.jobName : undefined,
      latestStatus: typeof latest.status === "string" ? latest.status : undefined,
      latestStepCount: Number(latest.stepCount || 0),
      latestCompletedAt,
      latestAgeMinutes: ageMinutes(latestCompletedAt),
      readHealthStatus: typeof readHealth.status === "string" ? readHealth.status : undefined,
      readHealthLastErrorStatus: readHealth.lastErrorStatus,
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

async function probeFrontPageApi(url) {
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "InvertedWorldCutoverReadiness/1.0" },
      signal: AbortSignal.timeout(20000),
    })
    const body = await response.json().catch(() => ({}))
    const edition = body.edition && typeof body.edition === "object" ? body.edition : {}
    const breakingItems = Array.isArray(body.breakingItems) ? body.breakingItems : []
    const pipeline = body.pipeline && typeof body.pipeline === "object" ? body.pipeline : {}
    const hrefs = breakingItems.map((item) => (typeof item?.href === "string" ? item.href : ""))
    const editionPublishedAt = typeof edition.publishedAt === "string" ? edition.publishedAt : undefined
    const pipelineCompletedAt = typeof pipeline.completedAt === "string" ? pipeline.completedAt : undefined
    const freshnessTimestamp = editionPublishedAt && editionPublishedAt.includes("T") ? editionPublishedAt : pipelineCompletedAt || editionPublishedAt

    return {
      url,
      status: response.status,
      ok: response.ok,
      sourceMode: body.sourceMode,
      hasEdition: Boolean(edition && typeof edition.headline === "string" && edition.headline.trim()),
      headline: typeof edition.headline === "string" ? edition.headline : undefined,
      editionPublishedAt,
      pipelineCompletedAt,
      freshnessTimestamp,
      freshnessAgeMinutes: ageMinutes(freshnessTimestamp),
      breakingItemCount: breakingItems.length,
      hasNewsLinks: hrefs.some((href) => href.startsWith("/news/")),
      hasInternalXLinks: hrefs.some((href) => href.startsWith("/x/")),
      hasArchiveLinks: hrefs.some((href) => href.startsWith("/archive/")),
      pipelineJobName: typeof pipeline.jobName === "string" ? pipeline.jobName : undefined,
      pipelineStatus: typeof pipeline.status === "string" ? pipeline.status : undefined,
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

  const publicOnly = process.argv.includes("--public-only") || process.env.CUTOVER_PUBLIC_ONLY === "1"
  const outputPath = readArgValue("output") || process.env.CUTOVER_READINESS_OUTPUT || ""
  const expectedReleaseCommit = process.env.RECURSIV_EXPECTED_RELEASE_COMMIT || currentCommitHash()
  const apiKey = readRecursivKey()
  const projectId = process.env.RECURSIV_PROJECT_ID
  const databaseName = process.env.RECURSIV_DATABASE_NAME || DEFAULT_DATABASE_NAME
  const recursivUrl = process.env.INVERTED_WORLD_SITE_URL || DEFAULT_SITE_URL
  const customDomainUrl = process.env.INVERTED_WORLD_CUSTOM_DOMAIN || DEFAULT_CUSTOM_DOMAIN
  const customHostname = new URL(customDomainUrl).hostname
  const recursivHostname = new URL(recursivUrl).hostname
  const releaseApiUrl = new URL("/api/release", recursivUrl).toString()
  const newsPageUrl = new URL("/news", recursivUrl).toString()
  const articleStoryPageUrl = new URL(`/news/${ARTICLE_CHAT_PROOF_SLUG}`, recursivUrl).toString()
  const xSignalPageUrl = new URL(`/x/${X_SIGNAL_PROOF_TOPIC}`, recursivUrl).toString()
  const xSignalApiUrl = new URL(`/api/x/${X_SIGNAL_PROOF_TOPIC}?limit=24`, recursivUrl).toString()
  const archiveApiUrl = new URL("/api/archive?limit=1000", recursivUrl).toString()
  const articlesApiUrl = new URL("/api/articles", recursivUrl).toString()
  const documentsPageUrl = new URL("/documents", recursivUrl).toString()
  const documentsApiUrl = new URL("/api/documents", recursivUrl).toString()
  const pipelineApiUrl = new URL("/api/pipeline?limit=1", recursivUrl).toString()
  const frontPageApiUrl = new URL("/api/front-page", recursivUrl).toString()
  const autopostApiUrl = new URL("/api/autopost/daily", recursivUrl).toString()
  const mediaPageUrl = new URL("/media", recursivUrl).toString()
  const mediaApiUrl = new URL("/api/media", recursivUrl).toString()
  const dossierChatApiUrl = new URL(`/api/dossiers/${DOSSIER_CHAT_PROOF_SLUG}/chat`, recursivUrl).toString()
  const articleChatApiUrl = new URL(`/api/articles/${ARTICLE_CHAT_PROOF_SLUG}/chat`, recursivUrl).toString()
  const readinessWarnings = []
  const publicProviderAudit = runPublicProviderAudit()
  const recursivManifestAudit = runRecursivManifestAudit()

  if (publicOnly) {
    readinessWarnings.push("Public-only mode skipped Recursiv project, deployment, job, provider-health, and pipeline database checks.")
  } else if (!apiKey || !projectId) {
    throw new Error("Missing Recursiv project id or API key for cutover readiness")
  }

  const sdk = publicOnly
    ? null
    : new Recursiv({
        apiKey,
        baseUrl: process.env.RECURSIV_BASE_URL || DEFAULT_BASE_URL,
        timeout: READINESS_TIMEOUT_MS,
        maxRetries: 0,
      })

  const [
    project,
    deploymentsResponse,
    jobsResponse,
    recursivHttp,
    newsPage,
    articleStoryPage,
    xSignalPage,
    xSignalApi,
    releaseApi,
    archiveApi,
    articlesApi,
    documentsPage,
    documentsApi,
    pipelineApi,
    frontPageApi,
    autopostApi,
    mediaPage,
    mediaApi,
    dossierChatApi,
    articleChatApi,
    customHttp,
    customDns,
    providerHealth,
    pipelineRuns,
  ] = await Promise.all([
      publicOnly
        ? Promise.resolve(null)
        : withTimeout(
            sdk.projects.get(projectId).then((response) => response.data),
            "Recursiv project lookup",
            null,
            readinessWarnings,
          ),
      publicOnly
        ? Promise.resolve(null)
        : withTimeout(
            sdk.deployments.list({ project_id: projectId }).then((response) => response.data),
            "Recursiv deployment list",
            null,
            readinessWarnings,
          ),
      publicOnly
        ? Promise.resolve(null)
        : withTimeout(
            sdk.jobs.list().then((response) => response.data),
            "Recursiv jobs list",
            null,
            readinessWarnings,
          ),
      probeHttp(recursivUrl),
      probeNewsPage(newsPageUrl),
      probeArticleStoryPage(articleStoryPageUrl),
      probeXSignalPage(xSignalPageUrl),
      probeXSignalApi(xSignalApiUrl),
      probeReleaseApi(releaseApiUrl),
      probeArchiveApi(archiveApiUrl),
      probeArticlesApi(articlesApiUrl),
      probeRemovedRoute(documentsPageUrl),
      probeRemovedRoute(documentsApiUrl),
      probePipelineApi(pipelineApiUrl),
      probeFrontPageApi(frontPageApiUrl),
      probeAutopostApi(autopostApiUrl),
      probeRemovedRoute(mediaPageUrl),
      probeRemovedRoute(mediaApiUrl),
      probeStoryChatApi(dossierChatApiUrl, DOSSIER_CHAT_PROOF_QUESTION),
      probeStoryChatApi(articleChatApiUrl, ARTICLE_CHAT_PROOF_QUESTION),
      probeHttp(customDomainUrl),
      probeDns(customHostname),
      publicOnly
        ? Promise.resolve(null)
        : withTimeout(fetchProviderHealth(sdk, projectId, databaseName), "provider-health database query", null, readinessWarnings),
      publicOnly
        ? Promise.resolve([])
        : withTimeout(fetchPipelineSummary(sdk, projectId, databaseName), "pipeline summary database query", [], readinessWarnings),
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
  const releaseProofReady = Boolean(
    releaseApi.ok &&
      releaseApi.name === "inverted-world" &&
      releaseApi.release === "worldwire-persistence-v2" &&
      releaseApi.worldwireJsonbPayloads === "dollar-quoted-sql-literals" &&
      releaseApi.pipelineSnapshotFallback &&
      releaseApi.dnsCutoverRequiresCustomDomainProof,
  )
  const newsPageReady = Boolean(
    newsPage.ok &&
      newsPage.hasSourceSheet &&
      newsPage.hasNewsMetrics &&
      !newsPage.hasEmptyState &&
      Number(newsPage.externalSourceLinks || 0) >= 20 &&
      Number(newsPage.contextLinks || 0) >= 3,
  )
  const articleStoryPageReady = Boolean(
    articleStoryPage.ok &&
      articleStoryPage.hasSources &&
      articleStoryPage.hasTalesContext &&
      articleStoryPage.hasAskThisStory &&
      articleStoryPage.hasArticleChatEndpoint &&
      !articleStoryPage.hasKeepReadingFallback &&
      Number(articleStoryPage.externalSourceLinks || 0) >= 3 &&
      Number(articleStoryPage.archiveLinks || 0) >= 1,
  )
  const xSignalPageReady = Boolean(
    xSignalPage.ok &&
      xSignalPage.hasLiveStream &&
      xSignalPage.hasRankedPosts &&
      xSignalPage.hasOpenSearch &&
      !xSignalPage.hasEmptyState &&
      Number(xSignalPage.outboundXLinks || 0) >= 6 &&
      Number(xSignalPage.postAnchors || 0) >= 6 &&
      Number(xSignalPage.tickerAnchorLinks || 0) >= 6,
  )
  const xSignalApiFresh = xSignalApi.latestPostAgeMinutes !== null && Number(xSignalApi.latestPostAgeMinutes) <= X_SIGNAL_MAX_AGE_HOURS * 60
  const xSignalApiReady = Boolean(
    xSignalApi.ok &&
      xSignalApi.topicId === X_SIGNAL_PROOF_TOPIC &&
      Number(xSignalApi.postCount || 0) >= X_SIGNAL_MIN_POSTS &&
      Number(xSignalApi.xLinkCount || 0) >= X_SIGNAL_MIN_POSTS &&
      Number(xSignalApi.sourceCount || 0) >= 2 &&
      xSignalApiFresh,
  )
  const releaseRevision = releaseRevisionProof(releaseApi, latestDeployment, deploymentLookupAvailable)
  const releaseCommitMatch = commitsMatch(releaseRevision.value, expectedReleaseCommit)
  const releaseCommitReady = releaseCommitMatch === true
  const publicProviderFallbackAuditReady = Boolean(publicProviderAudit.ok)
  const recursivManifestAuditReady = Boolean(recursivManifestAudit.ok)
  const recursivDeploymentCompleted = Boolean(latestDeployment?.status === "completed")
  const recursivHostingProven = Boolean(recursivHostedUrlProven && recursivDeploymentCompleted)
  const archiveTopicCoverageReady = Boolean(
    archiveApi.ok &&
      Number(archiveApi.topicCount || 0) >= ARCHIVE_REQUIRED_TOPIC_IDS.length &&
      Number(archiveApi.minRequiredTopicCount || 0) >= ARCHIVE_MIN_TOPIC_COUNT &&
      Number(archiveApi.dominantTopicShare || 0) <= ARCHIVE_MAX_DOMINANT_TOPIC_SHARE,
  )
  const recursivArchiveDataReady = Boolean(
    archiveApi.ok &&
      RECURSIV_BACKED_SOURCE_MODES.has(archiveApi.sourceMode) &&
      Number(archiveApi.totalCount || 0) >= ARCHIVE_MIN_TOTAL_COUNT &&
      Number(archiveApi.warningCount || 0) === 0 &&
      archiveTopicCoverageReady,
  )
  const recursivArchiveLiveDatabaseReady = Boolean(archiveApi.ok && archiveApi.sourceMode === "recursiv-database")
  const recursivArchiveSnapshotReady = Boolean(archiveApi.ok && archiveApi.sourceMode === "recursiv-snapshot")
  const articlesApiReady = Boolean(
    articlesApi.ok &&
      RECURSIV_BACKED_SOURCE_MODES.has(articlesApi.sourceMode) &&
      Number(articlesApi.articleCount || articlesApi.count || 0) >= ARTICLE_MIN_COUNT &&
      Number(articlesApi.topicCount || 0) >= ARTICLE_MIN_TOPICS &&
      Number(articlesApi.thumbnailCount || 0) >= ARTICLE_MIN_THUMBNAILS &&
      Number(articlesApi.externalSourceCount || 0) >= ARTICLE_MIN_EXTERNAL_SOURCES &&
      Number(articlesApi.repeatedLanePrefixCount || 0) === 0 &&
      Number(articlesApi.templatedArticleCount || 0) === 0 &&
      Number(articlesApi.warningCount || 0) === 0,
  )
  const pipelineApiFresh = pipelineApi.latestAgeMinutes !== null && Number(pipelineApi.latestAgeMinutes) <= PIPELINE_MAX_AGE_HOURS * 60
  const pipelineApiReady = Boolean(
    pipelineApi.ok &&
      RECURSIV_BACKED_SOURCE_MODES.has(pipelineApi.sourceMode) &&
      Number(pipelineApi.count || 0) >= 1 &&
      pipelineApi.latestJobName === "full-pipeline" &&
      pipelineApi.latestStatus === "succeeded" &&
      pipelineApiFresh,
  )
  const frontPageApiFresh =
    frontPageApi.freshnessAgeMinutes !== null && Number(frontPageApi.freshnessAgeMinutes) <= PIPELINE_MAX_AGE_HOURS * 60
  const frontPageApiReady = Boolean(
    frontPageApi.ok &&
      RECURSIV_BACKED_SOURCE_MODES.has(frontPageApi.sourceMode) &&
      frontPageApi.hasEdition &&
      frontPageApiFresh &&
      Number(frontPageApi.breakingItemCount || 0) >= 8 &&
      frontPageApi.hasNewsLinks &&
      frontPageApi.hasInternalXLinks &&
      frontPageApi.hasArchiveLinks,
  )
  const autopostApiReady = Boolean(
    autopostApi.ok &&
      RECURSIV_BACKED_SOURCE_MODES.has(autopostApi.sourceMode) &&
      autopostApi.packetStatus === "ready" &&
      autopostApi.readinessReady &&
      autopostApi.hasPrimaryPost &&
      autopostApi.noWarmupLanguage &&
      Number(autopostApi.sourcePackCount || 0) >= AUTOPOST_MIN_SOURCES &&
      Number(autopostApi.headlineVariantCount || 0) >= AUTOPOST_MIN_HEADLINES &&
      Number(autopostApi.xThreadCount || 0) >= AUTOPOST_MIN_THREAD_POSTS &&
      Number(autopostApi.imagePromptCount || 0) >= AUTOPOST_MIN_IMAGES &&
      Number(autopostApi.articleLinkCount || 0) >= 3 &&
      Number(autopostApi.xSignalLinkCount || 0) >= 3 &&
      Number(autopostApi.archiveVideoLinkCount || 0) >= 2 &&
      autopostApi.hasGuardrails,
  )
  const publicSourceShelfRemoved = Boolean(documentsPage.removed && documentsApi.removed)
  const publicMediaSurfaceRemoved = Boolean(mediaPage.removed && mediaApi.removed)
  const dossierChatApiReady = Boolean(
    dossierChatApi.ok &&
      dossierChatApi.mode === "context-fallback" &&
      dossierChatApi.stored === false &&
      Number(dossierChatApi.responseLength || 0) >= 500 &&
      dossierChatApi.hasMarkdown &&
      dossierChatApi.hasSourceLinks &&
      dossierChatApi.hasArchiveLinks &&
      dossierChatApi.hasNoDeadEndLanguage,
  )
  const articleChatApiReady = Boolean(
    articleChatApi.ok &&
      articleChatApi.mode === "context-fallback" &&
      articleChatApi.stored === false &&
      Number(articleChatApi.responseLength || 0) >= 500 &&
      articleChatApi.hasMarkdown &&
      articleChatApi.hasSourceLinks &&
      articleChatApi.hasArchiveLinks &&
      articleChatApi.hasNoDeadEndLanguage,
  )
  const providerHealthAvailable = Boolean(providerHealth)
  const providerBlocking = providerHealth?.blockingProviders || REQUIRED_PROVIDERS
  const providerHealthFresh = providerHealth?.ageMinutes !== null && Number(providerHealth?.ageMinutes) <= 360
  const scheduledJobsReady = jobsLookupAvailable && missingJobs.length === 0
  const deploymentHostnames = parseDeploymentHostnames(latestDeployment)
  const recursivDeploymentIncludesSlugHost = deploymentHostnames.includes(recursivHostname)
  const customDomainBindingConfigured = deploymentHostnames.includes(customHostname)
  const publicHostingReady =
    recursivHostingProven &&
    newsPageReady &&
    articleStoryPageReady &&
    xSignalPageReady &&
    xSignalApiReady &&
    releaseProofReady &&
    releaseCommitReady &&
    publicProviderFallbackAuditReady &&
    recursivManifestAuditReady &&
    recursivArchiveDataReady &&
    articlesApiReady &&
    pipelineApiReady &&
    frontPageApiReady &&
    autopostApiReady &&
    publicSourceShelfRemoved &&
    publicMediaSurfaceRemoved &&
    dossierChatApiReady &&
    articleChatApiReady &&
    scheduledJobsReady &&
    providerHealthFresh
  const fullAiProductReady = publicHostingReady && providerBlocking.length === 0
  const customDomainRecursivProven = Boolean(customHttp.ok && !customLooksVercel && customHttp.contentSignals?.hasCoreProductCopy)
  const dnsChangeReady = publicHostingReady && customDomainBindingConfigured
  const dnsCutoverReady = publicHostingReady && customDomainRecursivProven
  const keepDnsOnVercel = !dnsCutoverReady

  const checks = {
    recursivHostedUrl: statusText(recursivHostedUrlProven),
    newsPage: statusText(newsPageReady),
    articleStoryPage: statusText(articleStoryPageReady),
    xSignalPage: statusText(xSignalPageReady),
    xSignalApi: statusText(xSignalApiReady),
    xSignalFreshness: statusText(xSignalApiFresh),
    recursivDeploymentCompleted: deploymentLookupAvailable ? statusText(recursivDeploymentCompleted) : "unknown",
    recursivHosting: statusText(recursivHostingProven),
    releaseProof: statusText(releaseProofReady),
    releaseCommit: releaseCommitMatch === null ? "unknown" : statusText(releaseCommitMatch),
    publicProviderFallbackAudit: statusText(publicProviderFallbackAuditReady),
    recursivManifestAudit: statusText(recursivManifestAuditReady),
    recursivArchiveData: statusText(recursivArchiveDataReady),
    recursivArchiveTopicCoverage: statusText(archiveTopicCoverageReady),
    recursivArchiveLiveDatabase: statusText(recursivArchiveLiveDatabaseReady),
    recursivArchiveSnapshot: statusText(recursivArchiveSnapshotReady),
    articlesApi: statusText(articlesApiReady),
    publicSourceShelfRemoved: statusText(publicSourceShelfRemoved),
    pipelineApi: statusText(pipelineApiReady),
    pipelineFreshness: statusText(pipelineApiFresh),
    frontPageApi: statusText(frontPageApiReady),
    frontPageFreshness: statusText(frontPageApiFresh),
    autopostApi: statusText(autopostApiReady),
    publicMediaSurfaceRemoved: statusText(publicMediaSurfaceRemoved),
    dossierChatApi: statusText(dossierChatApiReady),
    articleChatApi: statusText(articleChatApiReady),
    providerHealthFresh: providerHealthAvailable ? statusText(providerHealthFresh) : "unknown",
    fullAiProviders: providerHealthAvailable ? statusText(providerBlocking.length === 0) : "unknown",
    scheduledJobs: jobsLookupAvailable ? statusText(scheduledJobsReady) : "unknown",
    recursivDeploymentIncludesSlugHost: deploymentLookupAvailable ? statusText(recursivDeploymentIncludesSlugHost) : "unknown",
    customDomainBindingConfigured: deploymentLookupAvailable ? statusText(customDomainBindingConfigured) : "unknown",
    publicHostingReady: statusText(publicHostingReady),
    customDomainRecursivProven: statusTextOrUnknown(customDomainRecursivProven),
    dnsChangeReady: statusText(dnsChangeReady),
    customDomainStillLegacy: customLooksVercel ? "pass" : "unknown",
    dnsCutoverReady: statusText(dnsCutoverReady),
  }

  const nextActions = []
  if (!recursivHostedUrlProven) nextActions.push("Do not touch DNS until invertedworld.on.recursiv.io returns the expected app.")
  if (!newsPageReady) {
    nextActions.push("Do not touch DNS until /news renders the source-board page with direct external source links and internal Inverted World context links.")
  }
  if (!articleStoryPageReady) {
    nextActions.push("Do not touch DNS until representative article pages render source links, Tales archive context, and Ask This Story without falling back to a generic keep-reading panel.")
  }
  if (!xSignalPageReady) {
    nextActions.push(`Do not touch DNS until /x/${X_SIGNAL_PROOF_TOPIC} renders ranked X posts with anchored post cards and outbound X links.`)
  }
  if (!xSignalApiReady) {
    nextActions.push(
      `Do not touch DNS until /api/x/${X_SIGNAL_PROOF_TOPIC} returns at least ${X_SIGNAL_MIN_POSTS} recent X posts from multiple source modes with a latest post inside ${X_SIGNAL_MAX_AGE_HOURS} hours.`,
    )
  }
  if (!releaseProofReady) {
    nextActions.push("Do not touch DNS until /api/release returns the current Recursiv feature marker for the deployed backend.")
  }
  if (releaseCommitMatch === false) {
    nextActions.push(
      `Do not touch DNS until /api/release source revision matches the expected deployed commit ${expectedReleaseCommit}.`,
    )
  } else if (releaseCommitMatch === null) {
    nextActions.push("Do not touch DNS until /api/release or Recursiv deployment metadata exposes a source revision for the deployed build.")
  }
  if (!publicProviderFallbackAuditReady) {
    nextActions.push("Do not touch DNS until pnpm audit:public-providers passes with no public provider fallback findings.")
  }
  if (!recursivManifestAuditReady) {
    nextActions.push("Do not touch DNS until pnpm recursiv:manifest:audit passes, proving schema, scheduled jobs, cutover expectations, and route files are aligned.")
  }
  if (recursivHostedUrlProven && !recursivDeploymentCompleted) {
    nextActions.push("HTTP proof for invertedworld.on.recursiv.io is green, but Recursiv deployment completion could not be proven; rerun cutover after the Recursiv API key is healthy.")
  }
  if (!recursivArchiveDataReady) {
    nextActions.push("Do not touch DNS until /api/archive is reading Recursiv-backed data, either live database or Recursiv-exported snapshot, with a complete-enough archive and no warnings.")
  }
  if (archiveApi.ok && !archiveTopicCoverageReady) {
    nextActions.push(
      `Do not touch DNS until /api/archive has at least ${ARCHIVE_MIN_TOPIC_COUNT} videos in each core topic and no topic above ${Math.round(
        ARCHIVE_MAX_DOMINANT_TOPIC_SHARE * 100,
      )}% of the archive.`,
    )
  }
  if (recursivArchiveSnapshotReady && !recursivArchiveLiveDatabaseReady) {
    nextActions.push("Public archive data is Recursiv-backed through an exported snapshot while the runtime database key is unhealthy; fix the Recursiv runtime key before calling the full product live-database ready.")
  }
  if (!articlesApiReady) {
    nextActions.push(
      `Do not touch DNS until /api/articles returns at least ${ARTICLE_MIN_COUNT} Recursiv-backed full-story articles across ${ARTICLE_MIN_TOPICS} topics with generated thumbnails, ${ARTICLE_MIN_EXTERNAL_SOURCES} direct external source links, and clean non-templated titles and bodies.`,
    )
  }
  if (!publicSourceShelfRemoved) {
    nextActions.push("Do not touch DNS until the removed public source shelf is gone from the hosted build: /documents and /api/documents must both return 404.")
  }
  if (!pipelineApiReady) {
    nextActions.push(
      `Do not touch DNS until /api/pipeline returns a succeeded full-pipeline run from Recursiv database or Recursiv snapshot data completed inside ${PIPELINE_MAX_AGE_HOURS} hours.`,
    )
  }
  if (!frontPageApiReady) {
    nextActions.push(
      `Do not touch DNS until /api/front-page returns a Recursiv-backed edition from inside ${PIPELINE_MAX_AGE_HOURS} hours with direct news, X, and archive ticker targets.`,
    )
  }
  if (!autopostApiReady) {
    nextActions.push(
      `Do not touch DNS until /api/autopost/daily returns a Recursiv-backed daily publish packet with source pack, headline variants, X thread, image prompts, guardrails, and direct story/X/archive links.`,
    )
  }
  if (!publicMediaSurfaceRemoved) {
    nextActions.push("Do not touch DNS until the removed public media surface is gone from the hosted build: /media and /api/media must both return 404.")
  }
  if (!dossierChatApiReady) {
    nextActions.push("Do not touch DNS until Ask This Story returns sourced Markdown with source and archive links without requiring an agent write.")
  }
  if (!articleChatApiReady) {
    nextActions.push("Do not touch DNS until article pages can answer Ask This Story with sourced Markdown and archive links, even when no dossier slug is attached.")
  }
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
  if (publicOnly) nextActions.push("Public-only proof is not enough for DNS cutover; rerun full cutover after the Recursiv API key is healthy.")
  if (publicHostingReady && !customDomainBindingConfigured) {
    nextActions.push("Recursiv public hosting is ready for the custom-domain binding step; redeploy production with custom_domain=www.inverted.world before changing DNS.")
  } else if (dnsChangeReady && !customDomainRecursivProven) {
    nextActions.push("Recursiv custom-domain binding is configured; change only the www DNS record when ready, then prove HTTPS/content before removing the legacy Vercel binding.")
  } else if (dnsCutoverReady) {
    nextActions.push("Recursiv custom-domain proof is green; keep monitoring, then remove the legacy Vercel binding after HTTP proof stays green.")
  } else {
    nextActions.push("Keep www.inverted.world on the legacy host until the failed gates pass.")
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: {
      publicOnly,
    },
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
      newsPageReady,
      articleStoryPageReady,
      xSignalPageReady,
      xSignalApiReady,
      xSignalApiFresh,
      recursivDeploymentCompleted,
      releaseProofReady,
      releaseCommitReady,
      publicProviderFallbackAuditReady,
      recursivManifestAuditReady,
      recursivArchiveDataReady,
      archiveTopicCoverageReady,
      recursivArchiveLiveDatabaseReady,
      recursivArchiveSnapshotReady,
      articlesApiReady,
      pipelineApiFresh,
      pipelineApiReady,
      frontPageApiFresh,
      frontPageApiReady,
      autopostApiReady,
      publicSourceShelfRemoved,
      publicMediaSurfaceRemoved,
      dossierChatApiReady,
      articleChatApiReady,
      publicHostingReady,
      fullAiProductReady,
      recursivDeploymentIncludesSlugHost,
      customDomainBindingConfigured,
      dnsChangeReady,
      customDomainRecursivProven,
      dnsCutoverReady,
      keepDnsOnVercel,
    },
    recursivUrl: recursivHttp,
    newsPage,
    articleStoryPage,
    xSignalPage,
    xSignalApi,
    releaseApi,
    expectedReleaseCommit,
    releaseRevision,
    publicProviderAudit,
    recursivManifestAudit,
    recursivArchiveApi: archiveApi,
    recursivArchiveDataSource: dataSourceStatus(archiveApi.sourceMode),
    articlesApi,
    articlesDataSource: dataSourceStatus(articlesApi.sourceMode),
    removedSourceShelfRoutes: {
      page: documentsPage,
      api: documentsApi,
    },
    pipelineApi,
    pipelineDataSource: dataSourceStatus(pipelineApi.sourceMode),
    frontPageApi,
    frontPageDataSource: dataSourceStatus(frontPageApi.sourceMode),
    autopostApi,
    autopostDataSource: dataSourceStatus(autopostApi.sourceMode),
    removedMediaRoutes: {
      page: mediaPage,
      api: mediaApi,
    },
    dossierChatApi,
    articleChatApi,
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
          commitHash: deploymentCommitHash(latestDeployment) || undefined,
          hostnames: deploymentHostnames,
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
  }
  const output = JSON.stringify(report, null, 2)
  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true })
    fs.writeFileSync(outputPath, `${output}\n`)
  }
  console.log(output)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
