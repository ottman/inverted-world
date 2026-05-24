import { execFileSync } from "node:child_process"
import fs from "node:fs"

const DEFAULT_OUTPUT = "/private/tmp/inverted-world-release-resume.json"

function argValue(name) {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (exact) return exact.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) return process.argv[index + 1]
  return undefined
}

function currentCommitHash() {
  return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim()
}

function runJson(command, args) {
  const output = execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  const jsonStart = output.indexOf("{")
  if (jsonStart === -1) throw new Error(`${command} ${args.join(" ")} did not print JSON`)
  return JSON.parse(output.slice(jsonStart))
}

function statusText(value) {
  return value ? "pass" : "fail"
}

function phaseFor(status) {
  if (status.deployWindow?.cooldownActive) return "wait-for-recursiv-api-cooldown"
  if (!status.snapshot?.snapshotRefreshPathAvailable) return "repair-snapshot-refresh-path"
  if (status.snapshot?.deployWindowFreshness?.staleBeforeNextAllowedAt || status.snapshot?.latestFullPipeline?.fresh === false) {
    return "refresh-recursiv-snapshot"
  }
  if (!status.proof?.local?.exists || status.proof.local.expectedReleaseCommit !== status.commitHash) return "rebuild-and-prove-local"
  if (!status.proof?.public?.exists || status.proof.public.expectedReleaseCommit !== status.commitHash) return "run-public-proof"
  if (!status.proof.public.decision?.publicHostingReady) return "deploy-recursiv-slug"
  if (!status.proof.public.decision?.dnsChangeReady) return "bind-custom-domain"
  if (!status.proof.public.decision?.dnsCutoverReady) return "plan-dns-cutover"
  return "cutover-proven"
}

function command({
  id,
  run,
  why,
  when = "now",
  callsRecursivApi = false,
  touchesDns = false,
  requiresNetwork = false,
  manual = false,
}) {
  return { id, when, run, why, callsRecursivApi, requiresNetwork, touchesDns, manual }
}

function domainPreflightCommand({ shortCommit, bindingProven = false, requireMode = "hosted", outputLabel = "hosted" }) {
  return [
    "pnpm recursiv:domain:preflight --",
    "--slug=invertedworld.on.recursiv.io",
    "--custom-domain=www.inverted.world",
    '--expected-text="Inverted World"',
    '--path=/news::"Just in"',
    '--path=/x/secret-programs::"Live X Stream"',
    '--path=/api/release::"worldwire-persistence-v2"',
    "--status-check=/documents::404",
    "--status-check=/api/documents::404",
    "--status-check=/media::404",
    "--status-check=/api/media::404",
    "--json-check=/api/release::deployment.sourceRevision::exists",
    "--json-check=/api/articles::sourceMode::contains::recursiv",
    "--json-check=/api/articles::count::gte::12",
    "--json-check=/api/front-page::sourceMode::contains::recursiv",
    "--json-check=/api/front-page::breakingItems.length::gte::8",
    bindingProven ? "--binding-proven" : "",
    `--output=/private/tmp/inverted-world-domain-preflight-${outputLabel}-${shortCommit}.json`,
    `--require=${requireMode}`,
  ]
    .filter(Boolean)
    .join(" ")
}

function commandPlan(status) {
  const commit = status.commitHash || currentCommitHash()
  const shortCommit = commit.slice(0, 7)
  const afterCooldown = status.deployWindow?.nextAllowedAt
    ? `after ${status.deployWindow.nextAllowedAt}`
    : "after Recursiv API health is confirmed"
  const snapshotCommand = status.snapshot?.databaseUrlAvailable
    ? "pnpm recursiv:snapshot"
    : status.snapshot?.recursivApiUsableForSnapshot
      ? "pnpm recursiv:snapshot -- --source=recursiv-api"
      : "Repair Recursiv database query/credentials or add /private/tmp/inverted-world-database-url before running pnpm recursiv:snapshot."
  const commands = [
    command({
      id: "status",
      run: `pnpm recursiv:migration:status -- --output=/private/tmp/inverted-world-migration-status-${shortCommit}.json`,
      why: "Refresh the no-secret operator packet before taking action.",
      callsRecursivApi: true,
      requiresNetwork: true,
    }),
  ]

  if (status.deployWindow?.cooldownActive) {
    commands.push(
      command({
        id: "wait",
        run: `Do not call Recursiv deploy/custom-domain APIs with this key until ${status.deployWindow.nextAllowedAt}.`,
        why: "The local cooldown guard still reflects a Recursiv API rate limit.",
        manual: true,
      }),
    )
  }

  commands.push(
    command({
      id: "refresh-snapshot",
      run: snapshotCommand,
      when: afterCooldown,
      why:
        status.snapshot?.deployWindowFreshness?.staleBeforeNextAllowedAt
          ? "The current snapshot will be stale before deploy is allowed, so refresh persisted Recursiv rows before release proof."
          : "Refresh persisted Recursiv rows before deploy proof if the current snapshot is stale.",
      callsRecursivApi: Boolean(!status.snapshot?.databaseUrlAvailable && status.snapshot?.recursivApiUsableForSnapshot),
      requiresNetwork: Boolean(!status.snapshot?.databaseUrlAvailable && status.snapshot?.recursivApiUsableForSnapshot),
      manual: !status.snapshot?.snapshotRefreshPathAvailable,
    }),
    command({
      id: "verify-snapshot",
      run: "pnpm recursiv:snapshot:status",
      when: "after refresh-snapshot",
      why: "Confirm the full-pipeline freshness window and public row counts before deploying.",
      callsRecursivApi: true,
      requiresNetwork: true,
    }),
    command({
      id: "build",
      run: "pnpm build",
      when: "after verify-snapshot",
      why: "Bake the current commit into the Next build id so /api/release can prove the deployed source revision.",
    }),
    command({
      id: "deploy-slug",
      run: "pnpm recursiv:deploy -- --wait",
      when: "after build and Recursiv API cooldown clears",
      why: "Deploy the pushed commit to the Recursiv slug host first; this still does not bind or move DNS.",
      callsRecursivApi: true,
      requiresNetwork: true,
    }),
    command({
      id: "preflight-slug",
      run: domainPreflightCommand({ shortCommit }),
      when: "after deploy-slug",
      why: "No-secret hosted-route proof should pass before spending Recursiv API budget on the full cutover audit.",
      requiresNetwork: true,
    }),
    command({
      id: "prove-slug",
      run: `CUTOVER_READINESS_OUTPUT=/private/tmp/inverted-world-public-readiness-${shortCommit}.json pnpm recursiv:cutover`,
      when: "after preflight-slug",
      why: "Full proof must show hosted deployment status, release commit, jobs, provider health, Recursiv-backed data, and public routes.",
      callsRecursivApi: true,
      requiresNetwork: true,
    }),
    command({
      id: "bind-custom-domain",
      run: "pnpm recursiv:deploy:custom-domain:wait",
      when: "only after prove-slug passes publicHostingReady",
      why: "Create/prove the Recursiv custom-domain binding before any DNS record changes.",
      callsRecursivApi: true,
      requiresNetwork: true,
    }),
    command({
      id: "preflight-binding",
      run: domainPreflightCommand({ shortCommit, bindingProven: true, requireMode: "dns-change", outputLabel: "binding" }),
      when: "after bind-custom-domain",
      why: "No-secret proof should show the Recursiv host is ready and the binding is asserted before full binding proof or DNS planning.",
      requiresNetwork: true,
    }),
    command({
      id: "prove-binding",
      run: `pnpm recursiv:cutover -- --output=/private/tmp/inverted-world-cutover-binding-${shortCommit}.json`,
      when: "after preflight-binding",
      why: "Require customDomainBindingConfigured and dnsChangeReady before planning the DNS record edit.",
      callsRecursivApi: true,
      requiresNetwork: true,
    }),
    command({
      id: "dns-cutover",
      run: "Plan the www.inverted.world DNS record change only after prove-binding reports dnsChangeReady=true.",
      when: "last",
      why: "DNS cutover is the final step, after the Recursiv custom-host binding is proven.",
      touchesDns: true,
      manual: true,
    }),
  )

  return commands
}

function blockers(status) {
  const items = []
  if (status.deployWindow?.cooldownActive) {
    items.push({
      id: "recursiv-api-cooldown",
      detail: `Deploy/custom-domain API cooldown active until ${status.deployWindow.nextAllowedAt}.`,
    })
  }
  if (status.snapshot?.deployWindowFreshness?.staleBeforeNextAllowedAt) {
    items.push({
      id: "snapshot-stale-before-deploy",
      detail: `Snapshot freshness expires ${status.snapshot.deployWindowFreshness.staleMinutesBeforeNextAllowedAt} minutes before deploy cooldown clears.`,
    })
  }
  if (!status.snapshot?.snapshotRefreshPathAvailable) {
    items.push({
      id: "snapshot-refresh-path-unavailable",
      detail:
        status.snapshot?.recursivApiKeyAvailable
          ? "A Recursiv API key source exists, but database query is not proven usable; repair the Recursiv database API/credentials path or add a protected direct database URL."
          : "Neither a protected direct database URL nor a usable Recursiv API database query path is available.",
    })
  }
  if (status.dns?.keepDnsOnVercel) {
    items.push({
      id: "dns-not-ready",
      detail: "www.inverted.world must stay on Vercel until custom-domain binding and custom-host proof are green.",
    })
  }
  return items
}

async function main() {
  const outputPath = argValue("--output") || DEFAULT_OUTPUT
  const status = runJson("node", ["scripts/recursiv-migration-status.mjs"])
  const phase = phaseFor(status)
  const plan = {
    ok: phase === "cutover-proven",
    generatedAt: new Date().toISOString(),
    commitHash: status.commitHash,
    phase,
    gates: {
      deployWindowReady: statusText(status.deployWindow?.ready),
      snapshotRefreshPathAvailable: statusText(status.snapshot?.snapshotRefreshPathAvailable),
      snapshotFreshAtNextDeployWindow: statusText(status.snapshot?.deployWindowFreshness?.freshAtNextAllowedAt),
      localProofCurrent: statusText(status.proof?.local?.exists && status.proof.local.expectedReleaseCommit === status.commitHash),
      publicProofCurrent: statusText(status.proof?.public?.exists && status.proof.public.expectedReleaseCommit === status.commitHash),
      publicHostingReady: statusText(status.proof?.public?.decision?.publicHostingReady),
      dnsChangeReady: statusText(status.dns?.changeReady),
      dnsCutoverReady: statusText(status.dns?.cutoverReady),
    },
    blockers: blockers(status),
    commands: commandPlan(status),
    dnsPolicy: {
      touchDnsNow: false,
      keepDnsOnVercel: status.dns?.keepDnsOnVercel !== false,
      rule: "Do not change DNS until full cutover proof reports customDomainBindingConfigured=true and dnsChangeReady=true.",
    },
  }
  const serialized = `${JSON.stringify(plan, null, 2)}\n`
  if (outputPath) fs.writeFileSync(outputPath, serialized)
  process.stdout.write(serialized)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
