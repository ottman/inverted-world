import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const TMP_DIR = "/private/tmp"
const LOCAL_PROOF_PREFIX = "inverted-world-local-readiness-"
const PUBLIC_PROOF_PREFIX = "inverted-world-public-readiness-"

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

function currentCommitHash() {
  return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim()
}

function runJson(command, args, options = {}) {
  const output = execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  })
  const jsonStart = output.indexOf("{")
  if (jsonStart === -1) throw new Error(`${command} ${args.join(" ")} did not print JSON`)
  return JSON.parse(output.slice(jsonStart))
}

function latestProofFile(prefix) {
  const explicit = readArgValue(prefix === LOCAL_PROOF_PREFIX ? "local-proof" : "public-proof")
  if (explicit) return explicit
  if (!fs.existsSync(TMP_DIR)) return null

  const candidates = fs
    .readdirSync(TMP_DIR)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(TMP_DIR, file)
      const stat = fs.statSync(fullPath)
      return { fullPath, mtimeMs: stat.mtimeMs }
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)

  return candidates[0]?.fullPath || null
}

function readProof(file) {
  if (!file || !fs.existsSync(file)) {
    return {
      file,
      exists: false,
    }
  }

  try {
    const proof = JSON.parse(fs.readFileSync(file, "utf8"))
    return {
      file,
      exists: true,
      generatedAt: proof.generatedAt,
      expectedReleaseCommit: proof.expectedReleaseCommit,
      checks: {
        releaseCommit: proof.checks?.releaseCommit,
        articleStoryPage: proof.checks?.articleStoryPage,
        articlesApi: proof.checks?.articlesApi,
        pipelineApi: proof.checks?.pipelineApi,
        frontPageApi: proof.checks?.frontPageApi,
        autopostApi: proof.checks?.autopostApi,
        publicSourceShelfRemoved: proof.checks?.publicSourceShelfRemoved,
        publicMediaSurfaceRemoved: proof.checks?.publicMediaSurfaceRemoved,
        dossierChatApi: proof.checks?.dossierChatApi,
        articleChatApi: proof.checks?.articleChatApi,
        publicHostingReady: proof.checks?.publicHostingReady,
        dnsChangeReady: proof.checks?.dnsChangeReady,
        dnsCutoverReady: proof.checks?.dnsCutoverReady,
      },
      decision: {
        publicHostingReady: Boolean(proof.decision?.publicHostingReady),
        dnsChangeReady: Boolean(proof.decision?.dnsChangeReady),
        dnsCutoverReady: Boolean(proof.decision?.dnsCutoverReady),
        keepDnsOnVercel: proof.decision?.keepDnsOnVercel !== false,
      },
      customDomain: {
        server: proof.customDomain?.http?.server,
        a: proof.customDomain?.dns?.a || [],
        cname: proof.customDomain?.dns?.cname || [],
      },
    }
  } catch (error) {
    return {
      file,
      exists: true,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function commitMatches(proof, commitHash) {
  if (!proof?.expectedReleaseCommit) return false
  return proof.expectedReleaseCommit.startsWith(commitHash) || commitHash.startsWith(proof.expectedReleaseCommit)
}

function timestampMs(value) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : null
}

function minutesBetween(left, right) {
  const leftMs = timestampMs(left)
  const rightMs = timestampMs(right)
  if (leftMs === null || rightMs === null) return null
  return Math.round((rightMs - leftMs) / 60000)
}

function snapshotDeployWindowFreshness(deployWindow, snapshotStatus) {
  const freshUntil = snapshotStatus.news?.latestFullPipeline?.freshUntil || null
  const nextAllowedAt = deployWindow.nextAllowedAt || null
  const freshUntilMs = timestampMs(freshUntil)
  const nextAllowedAtMs = timestampMs(nextAllowedAt)
  const nowMs = Date.now()
  const freshAtNextAllowedAt = freshUntilMs !== null && nextAllowedAtMs !== null ? freshUntilMs > nextAllowedAtMs : null

  return {
    freshUntil,
    nextAllowedAt,
    minutesUntilStale: freshUntilMs === null ? null : Math.round((freshUntilMs - nowMs) / 60000),
    nextAllowedInMinutes: nextAllowedAtMs === null ? null : Math.round((nextAllowedAtMs - nowMs) / 60000),
    freshAtNextAllowedAt,
    staleBeforeNextAllowedAt: freshAtNextAllowedAt === false,
    staleMinutesBeforeNextAllowedAt: freshAtNextAllowedAt === false ? minutesBetween(freshUntil, nextAllowedAt) : null,
  }
}

function recursivApiRepairAction(snapshotStatus) {
  const credentialsCode = snapshotStatus.recursivApi?.credentialsError?.code
  const queryCode = snapshotStatus.recursivApi?.queryError?.code
  if (credentialsCode === "credentials_not_found") {
    return "A Recursiv API key source exists and the database can be listed, but Recursiv database credentials are not available; repair the Recursiv Neon credentials path or add a protected direct database URL before refreshing snapshots."
  }
  if (queryCode === "query_failed") {
    return "A Recursiv API key source exists and the database can be listed, but SELECT 1 fails through /databases/query; repair the Recursiv database query/credentials path or add a protected direct database URL before refreshing snapshots."
  }
  return "A Recursiv API key source exists, but Recursiv database query is not proven usable; repair the database API/credentials path or add a protected direct database URL before refreshing snapshots."
}

function nextActions({ deployWindow, snapshotStatus, localProof, publicProof, commitHash }) {
  const actions = []
  const deployFreshness = snapshotDeployWindowFreshness(deployWindow, snapshotStatus)
  const directDatabaseAvailable = Boolean(snapshotStatus.databaseUrl?.available)
  const recursivApiKeyAvailable = Boolean(snapshotStatus.recursivApi?.keyAvailable ?? snapshotStatus.recursivApi?.available)
  const recursivApiUsableForSnapshot = Boolean(snapshotStatus.recursivApi?.usableForSnapshot || snapshotStatus.recursivApi?.queryAvailable)

  if (!deployWindow.ready) {
    actions.push(`Do not call Recursiv deploy/custom-domain APIs with this key until ${deployWindow.nextAllowedAt}, unless a healthy key is installed.`)
  }

  if (!snapshotStatus.ok) {
    actions.push("Refresh the committed Recursiv snapshot before relying on snapshot-backed readiness gates.")
  }

  if (!directDatabaseAvailable) {
    actions.push("No protected direct database URL is available; add it locally before running pnpm recursiv:snapshot.")
    if (recursivApiUsableForSnapshot) {
      actions.push("A Recursiv API key source is available; after API cooldown clears, pnpm recursiv:snapshot -- --source=recursiv-api can refresh without a direct database URL.")
    } else if (recursivApiKeyAvailable) {
      actions.push(recursivApiRepairAction(snapshotStatus))
    } else {
      actions.push("No Recursiv API key source is available for snapshot refresh; add a protected direct database URL or local Recursiv API key before continuing.")
    }
  }

  if (deployFreshness.staleBeforeNextAllowedAt) {
    actions.push(
      `The committed snapshot freshness gate expires ${deployFreshness.staleMinutesBeforeNextAllowedAt} minutes before the deploy cooldown clears; refresh the Recursiv snapshot before the next deployment proof.`,
    )
  }

  if (!localProof.exists || !commitMatches(localProof, commitHash)) {
    actions.push("Rebuild locally and rerun local public-only cutover proof for the current commit.")
  }

  if (!publicProof.exists || !commitMatches(publicProof, commitHash)) {
    actions.push("Run live public-only proof for the current commit target after pushing.")
  } else if (!publicProof.decision?.publicHostingReady) {
    actions.push("Deploy the current commit to Recursiv before expecting live public hosting gates to pass.")
  }

  if (deployWindow.ready && publicProof.exists && publicProof.decision?.publicHostingReady === false) {
    actions.push(deployWindow.nextCommand || "Run pnpm recursiv:deploy:custom-domain:wait")
  }

  if (!publicProof.decision?.dnsChangeReady || !publicProof.decision?.dnsCutoverReady) {
    actions.push("Keep www.inverted.world on Vercel until Recursiv custom-domain binding and custom-host proof are green.")
  }

  return [...new Set(actions)]
}

function errorCode(error) {
  return error?.code || null
}

function errorStatus(error) {
  return error?.status || null
}

function errorMessage(error) {
  return error?.message || null
}

async function main() {
  const outputPath = readArgValue("output")
  const commitHash = currentCommitHash()
  const deployWindow = runJson("node", ["scripts/deploy-recursiv.mjs", "--ready", "--custom-domain=www.inverted.world"])
  const snapshotStatus = runJson("node", ["scripts/export-recursiv-snapshots.mjs", "--status"])
  const localProof = readProof(latestProofFile(LOCAL_PROOF_PREFIX))
  const publicProof = readProof(latestProofFile(PUBLIC_PROOF_PREFIX))
  const snapshotDeployFreshness = snapshotDeployWindowFreshness(deployWindow, snapshotStatus)
  const status = {
    ok: Boolean(
      deployWindow.ok &&
        snapshotStatus.ok &&
        snapshotDeployFreshness.staleBeforeNextAllowedAt !== true &&
        localProof.exists &&
        commitMatches(localProof, commitHash) &&
        publicProof.exists &&
        commitMatches(publicProof, commitHash),
    ),
    generatedAt: new Date().toISOString(),
    commitHash,
    deployWindow: {
      ready: Boolean(deployWindow.ready),
      cooldownActive: Boolean(deployWindow.cooldownActive),
      nextAllowedAt: deployWindow.nextAllowedAt,
      nextCommand: deployWindow.nextCommand,
      customDomain: deployWindow.customDomain,
    },
    snapshot: {
      ok: Boolean(snapshotStatus.ok),
      databaseUrlAvailable: Boolean(snapshotStatus.databaseUrl?.available),
      recursivApiAvailable: Boolean(snapshotStatus.recursivApi?.keyAvailable ?? snapshotStatus.recursivApi?.available),
      recursivApiKeyAvailable: Boolean(snapshotStatus.recursivApi?.keyAvailable ?? snapshotStatus.recursivApi?.available),
      recursivApiDatabaseListAvailable: Boolean(snapshotStatus.recursivApi?.databaseListAvailable),
      recursivApiDatabaseReady: Boolean(snapshotStatus.recursivApi?.databaseReady),
      recursivApiQueryAvailable: Boolean(snapshotStatus.recursivApi?.queryAvailable),
      recursivApiCredentialsAvailable: Boolean(snapshotStatus.recursivApi?.credentialsAvailable),
      recursivApiUsableForSnapshot: Boolean(snapshotStatus.recursivApi?.usableForSnapshot || snapshotStatus.recursivApi?.queryAvailable),
      recursivApiSource: snapshotStatus.recursivApi?.source,
      recursivApiLastErrorStatus: snapshotStatus.recursivApi?.lastErrorStatus,
      recursivApiLastErrorCode: snapshotStatus.recursivApi?.lastErrorCode,
      recursivApiLastErrorMessage: snapshotStatus.recursivApi?.lastErrorMessage,
      recursivApiQueryErrorStatus: errorStatus(snapshotStatus.recursivApi?.queryError),
      recursivApiQueryErrorCode: errorCode(snapshotStatus.recursivApi?.queryError),
      recursivApiQueryErrorMessage: errorMessage(snapshotStatus.recursivApi?.queryError),
      recursivApiCredentialsErrorStatus: errorStatus(snapshotStatus.recursivApi?.credentialsError),
      recursivApiCredentialsErrorCode: errorCode(snapshotStatus.recursivApi?.credentialsError),
      recursivApiCredentialsErrorMessage: errorMessage(snapshotStatus.recursivApi?.credentialsError),
      snapshotRefreshPathAvailable: Boolean(
        snapshotStatus.databaseUrl?.available || snapshotStatus.recursivApi?.usableForSnapshot || snapshotStatus.recursivApi?.queryAvailable,
      ),
      latestFullPipeline: snapshotStatus.news?.latestFullPipeline,
      deployWindowFreshness: snapshotDeployFreshness,
      counts: {
        news: snapshotStatus.news?.counts || {},
        public: snapshotStatus.public?.counts || {},
      },
    },
    proof: {
      local: localProof,
      public: publicProof,
    },
    dns: {
      changeReady: Boolean(publicProof.decision?.dnsChangeReady),
      cutoverReady: Boolean(publicProof.decision?.dnsCutoverReady),
      keepDnsOnVercel: publicProof.decision?.keepDnsOnVercel !== false,
    },
    nextActions: nextActions({ deployWindow, snapshotStatus, localProof, publicProof, commitHash }),
  }

  const serialized = `${JSON.stringify(status, null, 2)}\n`
  if (outputPath) {
    fs.writeFileSync(outputPath, serialized)
  }
  process.stdout.write(serialized)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
