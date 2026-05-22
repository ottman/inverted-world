import fs from "node:fs"
import { Recursiv } from "@recursiv/sdk"

const DEFAULT_BASE_URL = "https://api.recursiv.io/api/v1"

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  const content = fs.readFileSync(file, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    process.env[key] = rawValue.replace(/^["']|["']$/g, "")
  }
}

function requireEnv(name, fallback) {
  const value = process.env[name] || fallback
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function readApiKeyFromFile() {
  const candidates = [process.env.RECURSIV_API_KEY_FILE, "/private/tmp/inverted-world-recursiv-key"].filter(Boolean)
  for (const file of candidates) {
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim()
  }
  return undefined
}

async function main() {
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const baseUrl = process.env.RECURSIV_BASE_URL || DEFAULT_BASE_URL
  const apiKey =
    readApiKeyFromFile() ||
    process.env.RECURSIV_SERVER_API_KEY ||
    process.env.RECURSIV_API_KEY ||
    process.env.SOCIAL_DEV_API_KEY
  const projectId = requireEnv("RECURSIV_PROJECT_ID")
  const branch = process.env.RECURSIV_DEPLOY_BRANCH || "main"
  if (!apiKey) throw new Error("Missing RECURSIV_SERVER_API_KEY or RECURSIV_API_KEY")

  const sdk = new Recursiv({ apiKey, baseUrl, timeout: 120000, maxRetries: 2 })

  if (process.argv.includes("--update-project")) {
    await sdk.projects.update(projectId, {
      name: "Inverted World",
      slug: process.env.RECURSIV_PROJECT_SLUG || "invertedworld",
      description: "Recursiv-hosted AI news/archive product for Tales From the Inverted World.",
      repo_url: "https://github.com/ottman/inverted-world.git",
    })
    console.log("Project metadata updated for Recursiv hosting.")
  }

  const { data } = await sdk.deployments.deploy({
    project_id: projectId,
    branch,
    commit_message: `Deploy inverted-world ${branch}`,
  })

  console.log(
    JSON.stringify(
      {
        deployment_id: data.deployment_id,
        deployment_url: data.deployment_url,
        coolify_app_uuid: data.coolify_app_uuid,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(
      JSON.stringify({
        message: error.message,
        name: error.name,
        cause: error.cause
          ? {
              code: error.cause.code,
              host: error.cause.hostname,
              message: error.cause.message,
            }
          : undefined,
      }),
    )
  } else {
    console.error(String(error))
  }
  process.exit(1)
})
