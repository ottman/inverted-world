#!/usr/bin/env node
// Seed / expand the independent-media X account list from who a seed account follows.
// Default seed is @Timcast (Tim Pool follows a wide, ideologically-mixed set of independent
// journalists/commentators — a ready-made candidate pool, left and right).
//
// Usage (run where the X bearer token is available, e.g. prod):
//   node scripts/seed-x-accounts-from-following.mjs [--account=Timcast] [--min-followers=50000] [--max=1000] [--json]
//
// It does NOT mutate the codebase — it prints curated CANDIDATES (username, name, followers, bio)
// sorted by reach so you can pick which to add to TOPIC_SOURCE_X_ACCOUNTS in lib/x-posts.ts.
//
// NOTE: GET /2/users/:id/following requires elevated X API access (Pro tier+). On Basic/Free it
// returns 403 — the script reports that clearly rather than failing silently.
import fs from "node:fs"

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}
loadEnv(".env")
loadEnv(".env.local")

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : dflt
}
const SEED = (arg("account", "Timcast") || "Timcast").replace(/^@/, "")
const MIN_FOLLOWERS = Math.max(0, Number(arg("min-followers", "50000")) || 0)
const MAX = Math.max(1, Math.min(Number(arg("max", "1000")) || 1000, 5000))
const AS_JSON = process.argv.includes("--json")

const TOKEN =
  process.env.X_BEARER_TOKEN ||
  process.env.X_API_BEARER_TOKEN ||
  process.env.TWITTER_BEARER_TOKEN ||
  process.env.TWITTER_API_BEARER_TOKEN
if (!TOKEN) {
  console.error("Missing X bearer token (X_BEARER_TOKEN / TWITTER_BEARER_TOKEN). Run where the token is configured (prod).")
  process.exit(1)
}

async function xGet(path, params = {}) {
  const url = new URL(`https://api.twitter.com/2/${path}`)
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v))
  const res = await fetch(url, { headers: { authorization: `Bearer ${TOKEN}` } })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text.slice(0, 300) }
  }
  if (!res.ok) {
    const detail = body?.detail || body?.title || body?.raw || `HTTP ${res.status}`
    const err = new Error(`X API ${res.status}: ${detail}`)
    err.status = res.status
    throw err
  }
  return body
}

async function main() {
  const userRes = await xGet(`users/by/username/${encodeURIComponent(SEED)}`)
  const seedId = userRes?.data?.id
  if (!seedId) throw new Error(`Could not resolve @${SEED}`)

  const candidates = []
  let token
  let fetched = 0
  do {
    const page = await xGet(`users/${seedId}/following`, {
      max_results: 1000,
      "user.fields": "public_metrics,description,verified,verified_type",
      pagination_token: token,
    })
    for (const u of page?.data || []) {
      fetched += 1
      const followers = u.public_metrics?.followers_count || 0
      if (followers >= MIN_FOLLOWERS) {
        candidates.push({
          username: u.username,
          name: u.name,
          followers,
          verified: u.verified || u.verified_type === "blue" || false,
          bio: (u.description || "").replace(/\s+/g, " ").trim().slice(0, 140),
        })
      }
    }
    token = page?.meta?.next_token
  } while (token && fetched < MAX)

  candidates.sort((a, b) => b.followers - a.followers)

  if (AS_JSON) {
    console.log(JSON.stringify({ seed: SEED, scanned: fetched, minFollowers: MIN_FOLLOWERS, candidates }, null, 2))
    return
  }
  console.log(`@${SEED} follows — ${candidates.length} candidates ≥ ${MIN_FOLLOWERS.toLocaleString()} followers (scanned ${fetched}):\n`)
  for (const c of candidates) {
    console.log(`  ${c.username.padEnd(22)} ${String(c.followers).padStart(10)}  ${c.name} — ${c.bio}`)
  }
  console.log(`\nCurate from these into TOPIC_SOURCE_X_ACCOUNTS in lib/x-posts.ts (keep the left/right balance).`)
}

main().catch((error) => {
  if (error?.status === 403) {
    console.error(
      "X API 403: the /2/users/:id/following endpoint needs elevated access (Pro tier+). " +
        "Either upgrade the API tier, or curate the list manually from x.com/" + SEED + "/following.",
    )
  } else {
    console.error(error instanceof Error ? error.message : String(error))
  }
  process.exit(1)
})
